import { parseFlags } from "@cliffy/flags";
import _ from "@es-toolkit/es-toolkit/compat";
import * as toml from "@std/toml";
import z from "@zod/zod";
import { Data, Effect } from "effect";
import type { Options } from "./utils.ts";
import { UBUNTU_ISO_URL } from "./constants.ts";

export const VmConfigSchema = z.object({
  vm: z
    .object({
      iso: z.string(),
      output: z.string(),
      cpu: z.string(),
      cpus: z.number(),
      memory: z.string(),
      image: z.string(),
      disk_format: z.enum(["qcow2", "raw"]),
      size: z.string(),
    })
    .partial(),
  network: z
    .object({
      bridge: z.string(),
      port_forward: z.string(),
    })
    .partial(),
  options: z
    .object({
      detach: z.boolean(),
    })
    .partial(),
});

export type VmConfig = z.infer<typeof VmConfigSchema>;

class VmConfigError extends Data.TaggedError("VmConfigError")<{
  cause?: string;
}> {}

export const initVmFile = (
  path: string,
): Effect.Effect<void, VmConfigError, never> =>
  Effect.tryPromise({
    try: async () => {
      const defaultConfig: VmConfig = {
        vm: {
          iso: UBUNTU_ISO_URL,
          cpu: "host",
          cpus: 2,
          memory: "2G",
        },
        network: {
          port_forward: "2222:22",
        },
        options: {
          detach: false,
        },
      };
      const tomlString = toml.stringify(defaultConfig);
      await Deno.writeTextFile(path, tomlString);
    },
    catch: (error) => new VmConfigError({ cause: String(error) }),
  });

export const parseVmFile = (
  path: string,
): Effect.Effect<VmConfig, VmConfigError, never> =>
  Effect.tryPromise({
    try: async () => {
      const fileContent = await Deno.readTextFile(path);
      const parsedToml = toml.parse(fileContent);
      return VmConfigSchema.parse(parsedToml);
    },
    catch: (error) => new VmConfigError({ cause: String(error) }),
  });

export const mergeConfig = (
  config: VmConfig | null,
  options: Options,
): Effect.Effect<Options, never, never> => {
  const { flags } = parseFlags(Deno.args);
  flags.image = flags.i || flags.image;
  flags.memory = flags.m || flags.memory;
  flags.cpus = flags.C || flags.cpus;
  flags.cpu = flags.c || flags.cpu;
  flags.portForward = flags.p || flags.portForward;
  flags.bridge = flags.b || flags.bridge;
  flags.size = flags.s || flags.size;

  const defaultConfig: VmConfig = {
    vm: {
      iso: _.get(config, "vm.iso"),
      cpu: _.get(config, "vm.cpu", "host"),
      cpus: _.get(config, "vm.cpus", 2),
      memory: _.get(config, "vm.memory", "2G"),
      image: _.get(config, "vm.image", options.image),
      disk_format: _.get(config, "vm.disk_format", "raw"),
      size: _.get(config, "vm.size", "20G"),
    },
    network: {
      bridge: _.get(config, "network.bridge"),
      port_forward: _.get(config, "network.port_forward", "2222:22"),
    },
    options: {
      detach: _.get(config, "options.detach", false),
    },
  };
  return Effect.succeed({
    memory: _.get(flags, "memory", defaultConfig.vm.memory!) as string,
    cpus: _.get(flags, "cpus", defaultConfig.vm.cpus!) as number,
    cpu: _.get(flags, "cpu", defaultConfig.vm.cpu!) as string,
    diskFormat: _.get(
      flags,
      "diskFormat",
      defaultConfig.vm.disk_format!,
    ) as string,
    portForward: _.get(
      flags,
      "portForward",
      defaultConfig.network.port_forward!,
    ) as string,
    image: _.get(flags, "image", defaultConfig.vm.image!) as string,
    bridge: _.get(flags, "bridge", defaultConfig.network.bridge!) as string,
    size: _.get(flags, "size", defaultConfig.vm.size!) as string,
    install: flags.install,
  });
};
