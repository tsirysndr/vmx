import _ from "@es-toolkit/es-toolkit/compat";
import chalk from "chalk";
import { Data, Effect, pipe } from "effect";
import { LOGS_DIR } from "../constants.ts";
import type { VirtualMachine } from "../db.ts";
import { getInstanceState, updateInstanceState } from "../state.ts";
import {
  safeKillQemu,
  setupFirmwareFilesIfNeeded,
  setupNATNetworkArgs,
} from "../utils.ts";

class VmNotFoundError extends Data.TaggedError("VmNotFoundError")<{
  name: string;
}> {}

class KillQemuError extends Data.TaggedError("KillQemuError")<{
  vmName: string;
}> {}

class CommandError extends Data.TaggedError("CommandError")<{
  cause?: unknown;
}> {}

const findVm = (name: string) =>
  pipe(
    getInstanceState(name),
    Effect.flatMap((vm) =>
      vm ? Effect.succeed(vm) : Effect.fail(new VmNotFoundError({ name }))
    ),
  );

const killQemu = (vm: VirtualMachine) =>
  safeKillQemu(vm.pid, Boolean(vm.bridge)).pipe(
    Effect.flatMap((success) =>
      success
        ? Effect.succeed(vm)
        : Effect.fail(new KillQemuError({ vmName: vm.name }))
    ),
  );

const sleep = (ms: number) =>
  Effect.tryPromise({
    try: () => new Promise((resolve) => setTimeout(resolve, ms)),
    catch: (error) => new CommandError({ cause: error }),
  });

const createLogsDir = () =>
  Effect.tryPromise({
    try: () => Deno.mkdir(LOGS_DIR, { recursive: true }),
    catch: (error) => new CommandError({ cause: error }),
  });

const setupFirmware = () => setupFirmwareFilesIfNeeded();

const buildQemuArgs = (vm: VirtualMachine, firmwareArgs: string[]) => {
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

const startQemu = (vm: VirtualMachine, qemuArgs: string[]) => {
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
        stdin: "null",
        stdout: "piped",
      });

      const { stdout } = await cmd.spawn().output();
      const qemuPid = parseInt(new TextDecoder().decode(stdout).trim(), 10);
      return { qemuPid, logPath };
    },
    catch: (error) => new CommandError({ cause: error }),
  });
};

const logSuccess = (vm: VirtualMachine, qemuPid: number, logPath: string) =>
  Effect.sync(() => {
    console.log(
      `${chalk.greenBright(vm.name)} restarted with PID ${
        chalk.greenBright(qemuPid)
      }.`,
    );
    console.log(
      `Logs are being written to ${chalk.blueBright(logPath)}`,
    );
  });

const handleError = (
  error: VmNotFoundError | KillQemuError | CommandError | Error,
) =>
  Effect.sync(() => {
    if (error instanceof VmNotFoundError) {
      console.error(
        `Virtual machine with name or ID ${
          chalk.greenBright(error.name)
        } not found.`,
      );
    } else if (error instanceof KillQemuError) {
      console.error(
        `Failed to stop virtual machine ${chalk.greenBright(error.vmName)}.`,
      );
    } else {
      console.error(`An error occurred: ${error}`);
    }
    Deno.exit(1);
  });

const restartEffect = (name: string) =>
  pipe(
    findVm(name),
    Effect.tap((vm) => Effect.log(`Found VM: ${vm.name}`)),
    Effect.flatMap(killQemu),
    Effect.tap((vm) => updateInstanceState(vm.id, "STOPPED")),
    Effect.flatMap((vm) =>
      pipe(
        sleep(2000),
        Effect.flatMap(() => createLogsDir()),
        Effect.flatMap(() => setupFirmware()),
        Effect.flatMap((firmwareArgs) => buildQemuArgs(vm, firmwareArgs)),
        Effect.flatMap((qemuArgs) => startQemu(vm, qemuArgs)),
        Effect.tap(() => sleep(2000)),
        Effect.flatMap(({ qemuPid, logPath }) =>
          pipe(
            updateInstanceState(vm.id, "RUNNING", qemuPid),
            Effect.flatMap(() => logSuccess(vm, qemuPid, logPath)),
            Effect.flatMap(() => sleep(2000)),
          )
        ),
      )
    ),
    Effect.catchAll(handleError),
  );

export default async function (name: string) {
  await Effect.runPromise(restartEffect(name));
  Deno.exit(0);
}
