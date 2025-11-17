import _ from "@es-toolkit/es-toolkit/compat";
import { createId } from "@paralleldrive/cuid2";
import chalk from "chalk";
import { Data, Effect, pipe } from "effect";
import Moniker from "moniker";
import {
  EMPTY_DISK_THRESHOLD_KB,
  FEDORA_COREOS_DEFAULT_VERSION,
  FEDORA_COREOS_IMG_URL,
  LOGS_DIR,
} from "./constants.ts";
import type { Image } from "./db.ts";
import { generateRandomMacAddress } from "./network.ts";
import { saveInstanceState, updateInstanceState } from "./state.ts";

export const DEFAULT_VERSION = "14.3-RELEASE";

export interface Options {
  output?: string;
  cpu: string;
  cpus: number;
  memory: string;
  image?: string;
  diskFormat?: string;
  size?: string;
  bridge?: string;
  portForward?: string;
  detach?: boolean;
  install?: boolean;
  volume?: string;
}

class LogCommandError extends Data.TaggedError("LogCommandError")<{
  cause?: unknown;
}> {}

class InvalidImageNameError extends Data.TaggedError("InvalidImageNameError")<{
  image: string;
  cause?: unknown;
}> {}

class NoSuchImageError extends Data.TaggedError("NoSuchImageError")<{
  cause: string;
}> {}

export class NoSuchFileError extends Data.TaggedError("NoSuchFileError")<{
  cause: string;
}> {}

export const getCurrentArch = (): string => {
  switch (Deno.build.arch) {
    case "x86_64":
      return "amd64";
    case "aarch64":
      return "arm64";
    default:
      return Deno.build.arch;
  }
};

export const isValidISOurl = (url?: string): boolean => {
  return Boolean(
    (url?.startsWith("http://") || url?.startsWith("https://")) &&
      url?.endsWith(".iso")
  );
};

export const humanFileSize = (blocks: number) =>
  Effect.sync(() => {
    const blockSize = 512; // bytes per block
    let bytes = blocks * blockSize;
    const thresh = 1024;

    if (Math.abs(bytes) < thresh) {
      return `${bytes}B`;
    }

    const units = ["KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    let u = -1;

    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);

    return `${bytes.toFixed(1)}${units[u]}`;
  });

export const validateImage = (
  image: string
): Effect.Effect<string, InvalidImageNameError, never> => {
  const regex =
    /^(?:[a-zA-Z0-9.-]+(?:\.[a-zA-Z0-9.-]+)*\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-zA-Z0-9._-]+)?$/;

  if (!regex.test(image)) {
    return Effect.fail(
      new InvalidImageNameError({
        image,
        cause:
          "Image name does not conform to expected format. Should be in the format 'repository/name:tag'.",
      })
    );
  }
  return Effect.succeed(image);
};

export const extractTag = (name: string) =>
  pipe(
    validateImage(name),
    Effect.flatMap((image) => Effect.succeed(image.split(":")[1] || "latest"))
  );

export const failOnMissingImage = (
  image: Image | undefined
): Effect.Effect<Image, Error, never> =>
  image
    ? Effect.succeed(image)
    : Effect.fail(new NoSuchImageError({ cause: "No such image" }));

export const du = (
  path: string
): Effect.Effect<number, LogCommandError, never> =>
  Effect.tryPromise({
    try: async () => {
      const cmd = new Deno.Command("du", {
        args: [path],
        stdout: "piped",
        stderr: "inherit",
      });

      const { stdout } = await cmd.spawn().output();
      const output = new TextDecoder().decode(stdout).trim();
      const size = parseInt(output.split("\t")[0], 10);
      return size;
    },
    catch: (error) => new LogCommandError({ cause: error }),
  });

export const emptyDiskImage = (path: string) =>
  Effect.tryPromise({
    try: async () => {
      if (!(await Deno.stat(path).catch(() => false))) {
        return true;
      }
      return false;
    },
    catch: (error) => new LogCommandError({ cause: error }),
  }).pipe(
    Effect.flatMap((exists) =>
      exists
        ? Effect.succeed(true)
        : du(path).pipe(Effect.map((size) => size < EMPTY_DISK_THRESHOLD_KB))
    )
  );

export const downloadIso = (url: string, options: Options) =>
  Effect.gen(function* () {
    const filename = url.split("/").pop()!;
    const outputPath = options.output ?? filename;

    if (options.image) {
      const imageExists = yield* Effect.tryPromise({
        try: () =>
          Deno.stat(options.image!)
            .then(() => true)
            .catch(() => false),
        catch: (error) => new LogCommandError({ cause: error }),
      });

      if (imageExists) {
        const driveSize = yield* du(options.image);
        if (driveSize > EMPTY_DISK_THRESHOLD_KB) {
          console.log(
            chalk.yellowBright(
              `Drive image ${options.image} is not empty (size: ${driveSize} KB), skipping ISO download to avoid overwriting existing data.`
            )
          );
          return null;
        }
      }
    }

    const outputExists = yield* Effect.tryPromise({
      try: () =>
        Deno.stat(outputPath)
          .then(() => true)
          .catch(() => false),
      catch: (error) => new LogCommandError({ cause: error }),
    });

    if (outputExists) {
      console.log(
        chalk.yellowBright(
          `File ${outputPath} already exists, skipping download.`
        )
      );
      return outputPath;
    }

    yield* Effect.tryPromise({
      try: async () => {
        console.log(chalk.blueBright(`Downloading ISO from ${url}...`));
        const cmd = new Deno.Command("curl", {
          args: ["-L", "-o", outputPath, url],
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        });

        const status = await cmd.spawn().status;
        if (!status.success) {
          console.error(chalk.redBright("Failed to download ISO image."));
          Deno.exit(status.code);
        }
      },
      catch: (error) => new LogCommandError({ cause: error }),
    });

    console.log(chalk.greenBright(`Downloaded ISO to ${outputPath}`));
    return outputPath;
  });

export const setupFirmwareFilesIfNeeded = () =>
  Effect.gen(function* () {
    if (Deno.build.arch !== "aarch64") {
      return [];
    }

    const { stdout, success } = yield* Effect.tryPromise({
      try: async () => {
        const brewCmd = new Deno.Command("brew", {
          args: ["--prefix", "qemu"],
          stdout: "piped",
          stderr: "inherit",
        });
        return await brewCmd.spawn().output();
      },
      catch: (error) => new LogCommandError({ cause: error }),
    });

    if (!success) {
      console.error(
        chalk.redBright(
          "Failed to get QEMU prefix from Homebrew. Ensure QEMU is installed via Homebrew."
        )
      );
      Deno.exit(1);
    }

    const brewPrefix = new TextDecoder().decode(stdout).trim();
    const edk2Aarch64 = `${brewPrefix}/share/qemu/edk2-aarch64-code.fd`;
    const edk2VarsAarch64 = "./edk2-arm-vars.fd";

    yield* Effect.tryPromise({
      try: () =>
        Deno.copyFile(
          `${brewPrefix}/share/qemu/edk2-arm-vars.fd`,
          edk2VarsAarch64
        ),
      catch: (error) => new LogCommandError({ cause: error }),
    });

    return [
      "-drive",
      `if=pflash,format=raw,file=${edk2Aarch64},readonly=on`,
      "-drive",
      `if=pflash,format=raw,file=${edk2VarsAarch64}`,
    ];
  });

export function setupPortForwardingArgs(portForward?: string): string {
  if (!portForward) {
    return "";
  }

  const forwards = portForward.split(",").map((pair) => {
    const [hostPort, guestPort] = pair.split(":");
    return `hostfwd=tcp::${hostPort}-:${guestPort}`;
  });

  return forwards.join(",");
}

export function setupNATNetworkArgs(portForward?: string): string {
  if (!portForward) {
    return "user,id=net0";
  }

  const portForwarding = setupPortForwardingArgs(portForward);
  return `user,id=net0,${portForwarding}`;
}

export const runQemu = (isoPath: string | null, options: Options) =>
  Effect.gen(function* () {
    const macAddress = yield* generateRandomMacAddress();

    const qemu =
      Deno.build.arch === "aarch64"
        ? "qemu-system-aarch64"
        : "qemu-system-x86_64";

    const firmwareFiles = yield* setupFirmwareFilesIfNeeded();

    const qemuArgs = [
      ..._.compact([options.bridge && qemu]),
      ...(Deno.build.os === "darwin" ? ["-accel", "hvf"] : ["-enable-kvm"]),
      ...(Deno.build.arch === "aarch64" ? ["-machine", "virt,highmem=on"] : []),
      "-cpu",
      options.cpu,
      "-m",
      options.memory,
      "-smp",
      options.cpus.toString(),
      ...(isoPath && isoPath.endsWith(".iso") ? ["-cdrom", isoPath] : []),
      "-netdev",
      options.bridge
        ? `bridge,id=net0,br=${options.bridge}`
        : setupNATNetworkArgs(options.portForward),
      "-device",
      `e1000,netdev=net0,mac=${macAddress}`,
      ...(options.install ? [] : ["-snapshot"]),
      "-nographic",
      "-monitor",
      "none",
      "-chardev",
      "stdio,id=con0,signal=off",
      "-serial",
      "chardev:con0",
      ...firmwareFiles,
      ..._.compact(
        options.image && [
          "-drive",
          `file=${options.image},format=${options.diskFormat},if=virtio`,
        ]
      ),
    ];

    const name = Moniker.choose();

    if (options.detach) {
      yield* Effect.tryPromise({
        try: () => Deno.mkdir(LOGS_DIR, { recursive: true }),
        catch: (error) => new LogCommandError({ cause: error }),
      });

      const logPath = `${LOGS_DIR}/${name}.log`;

      const fullCommand = options.bridge
        ? `sudo ${qemu} ${qemuArgs
            .slice(1)
            .join(" ")} >> "${logPath}" 2>&1 & echo $!`
        : `${qemu} ${qemuArgs.join(" ")} >> "${logPath}" 2>&1 & echo $!`;

      const { stdout } = yield* Effect.tryPromise({
        try: async () => {
          const cmd = new Deno.Command("sh", {
            args: ["-c", fullCommand],
            stdin: "null",
            stdout: "piped",
          });
          return await cmd.spawn().output();
        },
        catch: (error) => new LogCommandError({ cause: error }),
      });

      const qemuPid = parseInt(new TextDecoder().decode(stdout).trim(), 10);

      yield* saveInstanceState({
        id: createId(),
        name,
        bridge: options.bridge,
        macAddress,
        memory: options.memory,
        cpus: options.cpus,
        cpu: options.cpu,
        diskSize: options.size || "20G",
        diskFormat: options.diskFormat || "raw",
        portForward: options.portForward,
        isoPath: isoPath ? Deno.realPathSync(isoPath) : undefined,
        drivePath: options.image ? Deno.realPathSync(options.image) : undefined,
        version: DEFAULT_VERSION,
        status: "RUNNING",
        pid: qemuPid,
      });

      console.log(
        `Virtual machine ${name} started in background (PID: ${qemuPid})`
      );
      console.log(`Logs will be written to: ${logPath}`);

      // Exit successfully while keeping VM running in background
      Deno.exit(0);
    } else {
      const cmd = new Deno.Command(options.bridge ? "sudo" : qemu, {
        args: qemuArgs,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }).spawn();

      yield* saveInstanceState({
        id: createId(),
        name,
        bridge: options.bridge,
        macAddress,
        memory: options.memory,
        cpus: options.cpus,
        cpu: options.cpu,
        diskSize: options.size || "20G",
        diskFormat: options.diskFormat || "raw",
        portForward: options.portForward,
        isoPath: isoPath ? Deno.realPathSync(isoPath) : undefined,
        drivePath: options.image ? Deno.realPathSync(options.image) : undefined,
        version: DEFAULT_VERSION,
        status: "RUNNING",
        pid: cmd.pid,
      });

      const status = yield* Effect.tryPromise({
        try: () => cmd.status,
        catch: (error) => new LogCommandError({ cause: error }),
      });

      yield* updateInstanceState(name, "STOPPED");

      if (!status.success) {
        Deno.exit(status.code);
      }
    }
  });

export const safeKillQemu = (pid: number, useSudo: boolean = false) =>
  Effect.gen(function* () {
    const killArgs = useSudo
      ? ["sudo", "kill", "-TERM", pid.toString()]
      : ["kill", "-TERM", pid.toString()];

    const termStatus = yield* Effect.tryPromise({
      try: async () => {
        const termCmd = new Deno.Command(killArgs[0], {
          args: killArgs.slice(1),
          stdout: "null",
          stderr: "null",
        });
        return await termCmd.spawn().status;
      },
      catch: (error) => new LogCommandError({ cause: error }),
    });

    if (termStatus.success) {
      yield* Effect.tryPromise({
        try: () => new Promise((resolve) => setTimeout(resolve, 3000)),
        catch: (error) => new LogCommandError({ cause: error }),
      });

      const checkStatus = yield* Effect.tryPromise({
        try: async () => {
          const checkCmd = new Deno.Command("kill", {
            args: ["-0", pid.toString()],
            stdout: "null",
            stderr: "null",
          });
          return await checkCmd.spawn().status;
        },
        catch: (error) => new LogCommandError({ cause: error }),
      });

      if (!checkStatus.success) {
        return true;
      }
    }

    const killKillArgs = useSudo
      ? ["sudo", "kill", "-KILL", pid.toString()]
      : ["kill", "-KILL", pid.toString()];

    const killStatus = yield* Effect.tryPromise({
      try: async () => {
        const killCmd = new Deno.Command(killKillArgs[0], {
          args: killKillArgs.slice(1),
          stdout: "null",
          stderr: "null",
        });
        return await killCmd.spawn().status;
      },
      catch: (error) => new LogCommandError({ cause: error }),
    });

    return killStatus.success;
  });

export const createDriveImageIfNeeded = ({
  image: path,
  diskFormat: format,
  size,
}: Options) =>
  Effect.gen(function* () {
    const pathExists = yield* Effect.tryPromise({
      try: () =>
        Deno.stat(path!)
          .then(() => true)
          .catch(() => false),
      catch: (error) => new LogCommandError({ cause: error }),
    });

    if (pathExists) {
      console.log(
        chalk.yellowBright(
          `Drive image ${path} already exists, skipping creation.`
        )
      );
      return;
    }

    const status = yield* Effect.tryPromise({
      try: async () => {
        const cmd = new Deno.Command("qemu-img", {
          args: ["create", "-f", format || "raw", path!, size!],
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        });
        return await cmd.spawn().status;
      },
      catch: (error) => new LogCommandError({ cause: error }),
    });

    if (!status.success) {
      console.error(chalk.redBright("Failed to create drive image."));
      Deno.exit(status.code);
    }

    console.log(chalk.greenBright(`Created drive image at ${path}`));
  });

export const fileExists = (
  path: string
): Effect.Effect<void, NoSuchFileError, never> =>
  Effect.tryPromise({
    try: () => Deno.stat(path),
    catch: (error) => new NoSuchFileError({ cause: String(error) }),
  });

export const constructCoreOSImageURL = (
  image: string
): Effect.Effect<string, InvalidImageNameError, never> => {
  // detect with regex if image matches coreos pattern: fedora-coreos or fedora-coreos-<version> or coreos or coreos-<version>
  const coreosRegex = /^(fedora-coreos|coreos)(-(\d+\.\d+\.\d+\.\d+))?$/;
  const match = image.match(coreosRegex);
  if (match) {
    const version = match[3] || FEDORA_COREOS_DEFAULT_VERSION;
    return Effect.succeed(
      FEDORA_COREOS_IMG_URL.replaceAll(FEDORA_COREOS_DEFAULT_VERSION, version)
    );
  }

  return Effect.fail(
    new InvalidImageNameError({
      image,
      cause: "Image name does not match CoreOS naming conventions.",
    })
  );
};
