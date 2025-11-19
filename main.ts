#!/usr/bin/env -S deno run --allow-run --allow-read --allow-env

import { Command } from "@cliffy/command";
import { Secret } from "@cliffy/prompt";
import { readAll } from "@std/io";
import { basename } from "@std/path";
import chalk from "chalk";
import { Effect, pipe } from "effect";
import pkg from "./deno.json" with { type: "json" };
import { initVmFile, mergeConfig, parseVmFile } from "./src/config.ts";
import { CONFIG_FILE_NAME } from "./src/constants.ts";
import { getImage } from "./src/images.ts";
import { constructCoreOSImageURL } from "./src/mod.ts";
import { createBridgeNetworkIfNeeded } from "./src/network.ts";
import { getImageArchivePath } from "./src/oras.ts";
import images from "./src/subcommands/images.ts";
import inspect from "./src/subcommands/inspect.ts";
import login from "./src/subcommands/login.ts";
import logout from "./src/subcommands/logout.ts";
import logs from "./src/subcommands/logs.ts";
import ps from "./src/subcommands/ps.ts";
import pull from "./src/subcommands/pull.ts";
import push from "./src/subcommands/push.ts";
import restart from "./src/subcommands/restart.ts";
import rm from "./src/subcommands/rm.ts";
import rmi from "./src/subcommands/rmi.ts";
import run from "./src/subcommands/run.ts";
import serve from "./src/subcommands/serve.ts";
import start from "./src/subcommands/start.ts";
import stop from "./src/subcommands/stop.ts";
import tag from "./src/subcommands/tag.ts";
import * as volumes from "./src/subcommands/volume.ts";
import {
  constructNixOSImageURL,
  createDriveImageIfNeeded,
  downloadIso,
  emptyDiskImage,
  extractXz,
  fileExists,
  isValidISOurl,
  NoSuchFileError,
  type Options,
  runQemu,
} from "./src/utils.ts";

export * from "./src/mod.ts";

if (import.meta.main) {
  await new Command()
    .name("vmx")
    .version(pkg.version)
    .description("Manage and run headless VMs using QEMU")
    .arguments(
      "[path-or-url-to-iso:string]",
    )
    .option("-o, --output <path:string>", "Output path for downloaded ISO")
    .option("-c, --cpu <type:string>", "Type of CPU to emulate", {
      default: "host",
    })
    .option("-C, --cpus <number:number>", "Number of CPU cores", {
      default: 2,
    })
    .option("-m, --memory <size:string>", "Amount of memory for the VM", {
      default: "2G",
    })
    .option("-i, --image <path:string>", "Path to VM disk image")
    .option(
      "--disk-format <format:string>",
      "Disk image format (e.g., qcow2, raw)",
      {
        default: "raw",
      },
    )
    .option(
      "-s, --size <size:string>",
      "Size of the disk image to create if it doesn't exist (e.g., 20G)",
      {
        default: "20G",
      },
    )
    .option(
      "-b, --bridge <name:string>",
      "Name of the network bridge to use for networking (e.g., br0)",
    )
    .option(
      "-d, --detach",
      "Run VM in the background and print VM name",
    )
    .option(
      "-p, --port-forward <mappings:string>",
      "Port forwarding rules in the format hostPort:guestPort (comma-separated for multiple)",
    )
    .option(
      "--install",
      "Persist changes to the VM disk image",
    )
    .example(
      "Create a default VM configuration file",
      "vmx init",
    )
    .example(
      "Local ISO file",
      "vmx /path/to/image.iso",
    )
    .example(
      "Download URL",
      "vmx https://cdimage.ubuntu.com/releases/24.04/release/ubuntu-24.04.3-live-server-arm64.iso",
    )
    .example(
      "From OCI Registry",
      "vmx ghcr.io/tsirysndr/ubuntu:24.04",
    )
    .example(
      "List running VMs",
      "vmx ps",
    )
    .example(
      "List all VMs",
      "vmx ps --all",
    )
    .example(
      "Start a VM",
      "vmx start my-vm",
    )
    .example(
      "Stop a VM",
      "vmx stop my-vm",
    )
    .example(
      "Inspect a VM",
      "vmx inspect my-vm",
    )
    .action(async (options: Options, input?: string) => {
      const program = Effect.gen(function* () {
        let isoPath: string | null = null;

        if (input) {
          const [image, archivePath] = yield* Effect.all([
            getImage(input),
            pipe(
              getImageArchivePath(input),
              Effect.catchAll(() => Effect.succeed(null)),
            ),
          ]);

          if (image || archivePath) {
            yield* Effect.tryPromise({
              try: () => run(input),
              catch: () => {},
            });
            return;
          }

          if (isValidISOurl(input)) {
            isoPath = yield* downloadIso(input, options);
          }

          if (
            yield* pipe(
              fileExists(input),
              Effect.map(() => true),
              Effect.catchAll(() => Effect.succeed(false)),
            )
          ) {
            if (input.endsWith(".iso")) {
              isoPath = input;
            }
          }

          const coreOSImageURL = yield* pipe(
            constructCoreOSImageURL(input),
            Effect.catchAll(() => Effect.succeed(null)),
          );

          if (coreOSImageURL) {
            const cached = yield* pipe(
              basename(coreOSImageURL).replace(".xz", ""),
              fileExists,
              Effect.flatMap(() => Effect.succeed(true)),
              Effect.catchAll(() => Effect.succeed(false)),
            );
            if (!cached) {
              isoPath = yield* pipe(
                downloadIso(coreOSImageURL, options),
                Effect.flatMap((xz) => extractXz(xz)),
              );
            } else {
              isoPath = basename(coreOSImageURL).replace(".xz", "");
            }
          }

          const nixOSIsoURL = yield* pipe(
            constructNixOSImageURL(input),
            Effect.catchAll(() => Effect.succeed(null)),
          );

          if (nixOSIsoURL) {
            isoPath = yield* downloadIso(nixOSIsoURL, options);
          }
        }

        const config = yield* pipe(
          fileExists(CONFIG_FILE_NAME),
          Effect.flatMap(() => parseVmFile(CONFIG_FILE_NAME)),
          Effect.tap(() => Effect.log("Parsed VM configuration file.")),
          Effect.catchAll((error) => {
            if (error instanceof NoSuchFileError) {
              console.log(
                chalk.yellowBright(`No vmconfig.toml file found, please run:`),
                chalk.greenBright("vmx init"),
              );
              Deno.exit(1);
            }
            return Effect.fail(error);
          }),
        );

        if (!input && (isValidISOurl(config?.vm?.iso))) {
          isoPath = yield* downloadIso(config!.vm!.iso!, options);
        }

        if (!input && config?.vm?.iso) {
          const coreOSImageURL = yield* pipe(
            constructCoreOSImageURL(config.vm.iso),
            Effect.catchAll(() => Effect.succeed(null)),
          );

          if (coreOSImageURL) {
            const cached = yield* pipe(
              basename(coreOSImageURL).replace(".xz", ""),
              fileExists,
              Effect.flatMap(() => Effect.succeed(true)),
              Effect.catchAll(() => Effect.succeed(false)),
            );
            if (!cached) {
              const xz = yield* downloadIso(coreOSImageURL, options);
              isoPath = yield* extractXz(xz);
            } else {
              isoPath = basename(coreOSImageURL).replace(".xz", "");
            }
          }
        }

        options = yield* mergeConfig(config, options);

        if (options.image) {
          yield* createDriveImageIfNeeded(options);
        }

        if (!input && options.image) {
          const isEmpty = yield* emptyDiskImage(options.image);
          if (!isEmpty) {
            isoPath = null;
          }
        }

        if (options.bridge) {
          yield* createBridgeNetworkIfNeeded(options.bridge);
        }

        if (!input && !config?.vm?.iso && isValidISOurl(isoPath!)) {
          isoPath = null;
        }

        yield* runQemu(isoPath, options);
      });

      await Effect.runPromise(program);
    })
    .command("ps", "List all virtual machines")
    .option("--all, -a", "Show all virtual machines, including stopped ones")
    .action(async (options: { all?: unknown }) => {
      await ps(Boolean(options.all));
    })
    .command("start", "Start a virtual machine")
    .arguments("<vm-name:string>")
    .option("-c, --cpu <type:string>", "Type of CPU to emulate", {
      default: "host",
    })
    .option("-C, --cpus <number:number>", "Number of CPU cores", {
      default: 2,
    })
    .option("-m, --memory <size:string>", "Amount of memory for the VM", {
      default: "2G",
    })
    .option("-i, --image <path:string>", "Path to VM disk image")
    .option(
      "--disk-format <format:string>",
      "Disk image format (e.g., qcow2, raw)",
      {
        default: "raw",
      },
    )
    .option(
      "--size <size:string>",
      "Size of the VM disk image to create if it doesn't exist (e.g., 20G)",
      {
        default: "20G",
      },
    )
    .option(
      "-b, --bridge <name:string>",
      "Name of the network bridge to use for networking (e.g., br0)",
    )
    .option(
      "-d, --detach",
      "Run VM in the background and print VM name",
    )
    .option(
      "-p, --port-forward <mappings:string>",
      "Port forwarding rules in the format hostPort:guestPort (comma-separated for multiple)",
    )
    .option(
      "-v, --volume <name:string>",
      "Name of the volume to attach to the VM, will be created if it doesn't exist",
    )
    .action(async (options: unknown, vmName: string) => {
      await start(vmName, Boolean((options as { detach: boolean }).detach));
    })
    .command("stop", "Stop a virtual machine")
    .arguments("<vm-name:string>")
    .action(async (_options: unknown, vmName: string) => {
      await stop(vmName);
    })
    .command("inspect", "Inspect a virtual machine")
    .arguments("<vm-name:string>")
    .action(async (_options: unknown, vmName: string) => {
      await inspect(vmName);
    })
    .command("rm", "Remove a virtual machine")
    .arguments("<vm-name:string>")
    .action(async (_options: unknown, vmName: string) => {
      await rm(vmName);
    })
    .command("logs", "View logs of a virtual machine")
    .option("--follow, -f", "Follow log output")
    .arguments("<vm-name:string>")
    .action(async (options: unknown, vmName: string) => {
      await logs(vmName, Boolean((options as { follow: boolean }).follow));
    })
    .command("restart", "Restart a virtual machine")
    .arguments("<vm-name:string>")
    .action(async (_options: unknown, vmName: string) => {
      await restart(vmName);
    })
    .command("init", "Initialize a default VM configuration file")
    .action(async () => {
      await Effect.runPromise(initVmFile(CONFIG_FILE_NAME));
      console.log(
        `New VM configuration file created at ${
          chalk.greenBright("./") +
          chalk.greenBright(CONFIG_FILE_NAME)
        }`,
      );
      console.log(
        `You can edit this file to customize your VM settings and then start the VM with:`,
      );
      console.log(`  ${chalk.greenBright(`vmx`)}`);
    })
    .command(
      "pull",
      "Pull VM image from an OCI-compliant registry, e.g., ghcr.io, docker hub",
    )
    .arguments("<image:string>")
    .action(async (_options: unknown, image: string) => {
      await pull(image);
    })
    .command(
      "push",
      "Push VM image to an OCI-compliant registry, e.g., ghcr.io, docker hub",
    )
    .arguments("<image:string>")
    .action(async (_options: unknown, image: string) => {
      await push(image);
    })
    .command(
      "tag",
      "Create a tag 'image' that refers to the VM image of 'vm-name'",
    )
    .arguments("<vm-name:string> <image:string>")
    .action(async (_options: unknown, vmName: string, image: string) => {
      await tag(vmName, image);
    })
    .command(
      "login",
      "Authenticate to an OCI-compliant registry, e.g., ghcr.io, docker.io (docker hub), etc.",
    )
    .option("-u, --username <username:string>", "Registry username")
    .arguments("<registry:string>")
    .action(async (options: unknown, registry: string) => {
      const username = (options as { username: string }).username;

      let password: string | undefined;
      const stdinIsTTY = Deno.stdin.isTerminal();

      if (!stdinIsTTY) {
        const buffer = await readAll(Deno.stdin);
        password = new TextDecoder().decode(buffer).trim();
      } else {
        password = await Secret.prompt("Registry Password: ");
      }

      console.log(
        `Authenticating to registry ${chalk.greenBright(registry)} as ${
          chalk.greenBright(username)
        }...`,
      );
      await login(username, password, registry);
    })
    .command("logout", "Logout from an OCI-compliant registry")
    .arguments("<registry:string>")
    .action(async (_options: unknown, registry: string) => {
      await logout(registry);
    })
    .command("images", "List all local VM images")
    .action(async () => {
      await images();
    })
    .command("rmi", "Remove a local VM image")
    .arguments("<image:string>")
    .action(async (_options: unknown, image: string) => {
      await rmi(image);
    })
    .command("run", "Create and run a VM from an image")
    .arguments("<image:string>")
    .option("-c, --cpu <type:string>", "Type of CPU to emulate", {
      default: "host",
    })
    .option("-C, --cpus <number:number>", "Number of CPU cores", {
      default: 2,
    })
    .option("-m, --memory <size:string>", "Amount of memory for the VM", {
      default: "2G",
    })
    .option(
      "-b, --bridge <name:string>",
      "Name of the network bridge to use for networking (e.g., br0)",
    )
    .option(
      "-d, --detach",
      "Run VM in the background and print VM name",
    )
    .option(
      "-p, --port-forward <mappings:string>",
      "Port forwarding rules in the format hostPort:guestPort (comma-separated for multiple)",
    )
    .option(
      "-v, --volume <name:string>",
      "Name of the volume to attach to the VM, will be created if it doesn't exist",
    )
    .action(async (_options: unknown, image: string) => {
      await run(image);
    })
    .command("volumes", "List all volumes")
    .action(async () => {
      await volumes.list();
    })
    .command(
      "volume",
      new Command()
        .command("rm", "Remove a volume")
        .arguments("<volume-name:string>")
        .action(async (_options: unknown, volumeName: string) => {
          await volumes.remove(volumeName);
        })
        .command("inspect", "Inspect a volume")
        .arguments("<volume-name:string>")
        .action(async (_options: unknown, volumeName: string) => {
          await volumes.inspect(volumeName);
        }),
    )
    .description("Manage volumes")
    .command("serve", "Start the HTTP API server")
    .option("-p, --port <port:number>", "Port to listen on", { default: 8889 })
    .action(() => {
      serve();
    })
    .parse(Deno.args);
}
