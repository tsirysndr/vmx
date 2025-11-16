import { parseFlags } from "@cliffy/flags";
import _ from "@es-toolkit/es-toolkit/compat";
import { Data, Effect, pipe } from "effect";
import { LOGS_DIR } from "../constants.ts";
import type { VirtualMachine, Volume } from "../db.ts";
import { getImage } from "../images.ts";
import { getInstanceState, updateInstanceState } from "../state.ts";
import { setupFirmwareFilesIfNeeded, setupNATNetworkArgs } from "../utils.ts";
import { createVolume, getVolume } from "../volumes.ts";

export class VmNotFoundError extends Data.TaggedError("VmNotFoundError")<{
  name: string;
}> {}

export class VmAlreadyRunningError
  extends Data.TaggedError("VmAlreadyRunningError")<{
    name: string;
  }> {}

export class CommandError extends Data.TaggedError("CommandError")<{
  cause?: unknown;
}> {}

const findVm = (name: string) =>
  pipe(
    getInstanceState(name),
    Effect.flatMap((vm) =>
      vm ? Effect.succeed(vm) : Effect.fail(new VmNotFoundError({ name }))
    ),
  );

const logStarting = (vm: VirtualMachine) =>
  Effect.sync(() => {
    console.log(`Starting virtual machine ${vm.name} (ID: ${vm.id})...`);
  });

const applyFlags = (vm: VirtualMachine) => Effect.succeed(mergeFlags(vm));

export const setupFirmware = () => setupFirmwareFilesIfNeeded();

export const buildQemuArgs = (vm: VirtualMachine, firmwareArgs: string[]) => {
  const qemu = Deno.build.arch === "aarch64"
    ? "qemu-system-aarch64"
    : "qemu-system-x86_64";

  return Effect.succeed([
    ..._.compact([vm.bridge && qemu]),
    ...Deno.build.os === "darwin" ? ["-accel", "hvf"] : ["-enable-kvm"],
    ...Deno.build.arch === "aarch64" ? ["-machine", "virt,highmem=on"] : [],
    "-cpu",
    vm.cpu,
    "-m",
    vm.memory,
    "-smp",
    vm.cpus.toString(),
    ..._.compact([vm.isoPath && "-cdrom", vm.isoPath]),
    "-netdev",
    vm.bridge
      ? `bridge,id=net0,br=${vm.bridge}`
      : setupNATNetworkArgs(vm.portForward),
    "-device",
    `e1000,netdev=net0,mac=${vm.macAddress}`,
    "-nographic",
    "-monitor",
    "none",
    "-chardev",
    "stdio,id=con0,signal=off",
    "-serial",
    "chardev:con0",
    ...firmwareArgs,
    ..._.compact(
      vm.drivePath && [
        "-drive",
        `file=${vm.drivePath},format=${vm.diskFormat},if=virtio`,
      ],
    ),
  ]);
};

export const createLogsDir = () =>
  Effect.tryPromise({
    try: () => Deno.mkdir(LOGS_DIR, { recursive: true }),
    catch: (error) => new CommandError({ cause: error }),
  });

export const startDetachedQemu = (
  name: string,
  vm: VirtualMachine,
  qemuArgs: string[],
) => {
  const qemu = Deno.build.arch === "aarch64"
    ? "qemu-system-aarch64"
    : "qemu-system-x86_64";

  const logPath = `${LOGS_DIR}/${vm.name}.log`;

  const fullCommand = vm.bridge
    ? `sudo ${qemu} ${
      qemuArgs.slice(1).join(" ")
    } >> "${logPath}" 2>&1 & echo $!`
    : `${qemu} ${qemuArgs.join(" ")} >> "${logPath}" 2>&1 & echo $!`;

  return Effect.tryPromise({
    try: async () => {
      const cmd = new Deno.Command("sh", {
        args: ["-c", fullCommand],
        stdin: "piped",
        stdout: "piped",
      })
        .spawn();

      // Wait 2 seconds and send "1" to boot normally
      setTimeout(async () => {
        try {
          const writer = cmd.stdin.getWriter();
          await writer.write(new TextEncoder().encode("1\n"));
          await writer.close();
        } catch {
          // Ignore errors if stdin is already closed
        }
      }, 2000);

      const { stdout } = await cmd.output();
      const qemuPid = parseInt(new TextDecoder().decode(stdout).trim(), 10);
      return { qemuPid, logPath };
    },
    catch: (error) => new CommandError({ cause: error }),
  }).pipe(
    Effect.flatMap(({ qemuPid, logPath }) =>
      pipe(
        updateInstanceState(name, "RUNNING", qemuPid),
        Effect.map(() => ({ vm, qemuPid, logPath })),
      )
    ),
  );
};

const logDetachedSuccess = (
  { vm, qemuPid, logPath }: {
    vm: VirtualMachine;
    qemuPid: number;
    logPath: string;
  },
) =>
  Effect.sync(() => {
    console.log(
      `Virtual machine ${vm.name} started in background (PID: ${qemuPid})`,
    );
    console.log(`Logs will be written to: ${logPath}`);
  });

const startInteractiveQemu = (
  name: string,
  vm: VirtualMachine,
  qemuArgs: string[],
) => {
  const qemu = Deno.build.arch === "aarch64"
    ? "qemu-system-aarch64"
    : "qemu-system-x86_64";

  return Effect.tryPromise({
    try: async () => {
      const cmd = new Deno.Command(vm.bridge ? "sudo" : qemu, {
        args: qemuArgs,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });

      const child = cmd.spawn();

      await Effect.runPromise(updateInstanceState(name, "RUNNING", child.pid));

      const status = await child.status;

      await Effect.runPromise(updateInstanceState(name, "STOPPED", child.pid));

      return status;
    },
    catch: (error) => new CommandError({ cause: error }),
  });
};

const handleError = (error: VmNotFoundError | CommandError | Error) =>
  Effect.sync(() => {
    if (error instanceof VmNotFoundError) {
      console.error(
        `Virtual machine with name or ID ${error.name} not found.`,
      );
    } else {
      console.error(`An error occurred: ${error}`);
    }
    Deno.exit(1);
  });

export const createVolumeIfNeeded = (
  vm: VirtualMachine,
): Effect.Effect<[VirtualMachine, Volume?], Error, never> =>
  Effect.gen(function* () {
    const { flags } = parseFlags(Deno.args);
    if (!flags.volume) {
      return [vm];
    }
    const volume = yield* getVolume(flags.volume as string);
    if (volume) {
      return [vm, volume];
    }

    if (!vm.drivePath) {
      throw new Error(
        `Cannot create volume: Virtual machine ${vm.name} has no drivePath defined.`,
      );
    }

    let image = yield* getImage(vm.drivePath);

    if (!image) {
      const volume = yield* getVolume(vm.drivePath);
      if (volume) {
        image = yield* getImage(volume.baseImageId);
      }
    }

    const newVolume = yield* createVolume(flags.volume as string, image!);
    return [vm, newVolume];
  });

export const failIfVMRunning = (vm: VirtualMachine) =>
  Effect.gen(function* () {
    if (vm.status === "RUNNING") {
      return yield* Effect.fail(
        new VmAlreadyRunningError({ name: vm.name }),
      );
    }
    return vm;
  });

const startDetachedEffect = (name: string) =>
  pipe(
    findVm(name),
    Effect.flatMap(failIfVMRunning),
    Effect.tap(logStarting),
    Effect.flatMap(applyFlags),
    Effect.flatMap(createVolumeIfNeeded),
    Effect.flatMap(([vm, volume]) =>
      pipe(
        setupFirmware(),
        Effect.flatMap((firmwareArgs) =>
          buildQemuArgs({
            ...vm,
            drivePath: volume ? volume.path : vm.drivePath,
            diskFormat: volume ? "qcow2" : vm.diskFormat,
          }, firmwareArgs)
        ),
        Effect.flatMap((qemuArgs) =>
          pipe(
            createLogsDir(),
            Effect.flatMap(() => startDetachedQemu(name, vm, qemuArgs)),
            Effect.tap(logDetachedSuccess),
            Effect.map(() => 0), // Exit code 0
          )
        ),
      )
    ),
    Effect.catchAll(handleError),
  );

const startInteractiveEffect = (name: string) =>
  pipe(
    findVm(name),
    Effect.flatMap(failIfVMRunning),
    Effect.tap(logStarting),
    Effect.flatMap(applyFlags),
    Effect.flatMap(createVolumeIfNeeded),
    Effect.flatMap(([vm, volume]) =>
      pipe(
        setupFirmware(),
        Effect.flatMap((firmwareArgs) =>
          buildQemuArgs({
            ...vm,
            drivePath: volume ? volume.path : vm.drivePath,
            diskFormat: volume ? "qcow2" : vm.diskFormat,
          }, firmwareArgs)
        ),
        Effect.flatMap((qemuArgs) => startInteractiveQemu(name, vm, qemuArgs)),
        Effect.map((status) => status.success ? 0 : (status.code || 1)),
      )
    ),
    Effect.catchAll(handleError),
  );

export default async function (name: string, detach: boolean = false) {
  const exitCode = await Effect.runPromise(
    detach ? startDetachedEffect(name) : startInteractiveEffect(name),
  );

  if (detach) {
    Deno.exit(exitCode);
  } else if (exitCode !== 0) {
    Deno.exit(exitCode);
  }
}

function mergeFlags(vm: VirtualMachine): VirtualMachine {
  const { flags } = parseFlags(Deno.args);
  return {
    ...vm,
    memory: (flags.memory || flags.m)
      ? String(flags.memory || flags.m)
      : vm.memory,
    cpus: (flags.cpus || flags.C) ? Number(flags.cpus || flags.C) : vm.cpus,
    cpu: (flags.cpu || flags.c) ? String(flags.cpu || flags.c) : vm.cpu,
    diskFormat: flags.diskFormat ? String(flags.diskFormat) : vm.diskFormat,
    portForward: (flags.portForward || flags.p)
      ? String(flags.portForward || flags.p)
      : vm.portForward,
    drivePath: (flags.image || flags.i)
      ? String(flags.image || flags.i)
      : vm.drivePath,
    bridge: (flags.bridge || flags.b)
      ? String(flags.bridge || flags.b)
      : vm.bridge,
    diskSize: (flags.size || flags.s)
      ? String(flags.size || flags.s)
      : vm.diskSize,
  };
}
