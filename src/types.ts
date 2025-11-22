import z from "@zod/zod";

export type STATUS = "RUNNING" | "STOPPED";

export const MachineParamsSchema = z.object({
  portForward: z.array(z.string().regex(/^\d+:\d+$/)).optional(),
  cpu: z.string().optional(),
  cpus: z.number().min(1).optional(),
  memory: z
    .string()
    .regex(/^\d+(M|G)$/)
    .optional(),
});

export type MachineParams = z.infer<typeof MachineParamsSchema>;

export const NewMachineSchema = MachineParamsSchema.extend({
  portForward: z
    .array(
      z
        .string()
        .trim()
        .regex(/^\d+:\d+$/),
    )
    .optional(),
  cpu: z.string().trim().default("host").optional(),
  cpus: z.number().min(1).default(8).optional(),
  memory: z
    .string()
    .trim()
    .regex(/^\d+(M|G)$/)
    .default("2G")
    .optional(),
  image: z
    .string()
    .trim()
    .regex(
      /^([a-zA-Z0-9\-\.]+\/)?([a-zA-Z0-9\-\.]+\/)?[a-zA-Z0-9\-\.]+(:[\w\.\-]+)?$/,
    ),
  volume: z.string().trim().optional(),
  bridge: z.string().trim().optional(),
  seed: z.string().trim().optional(),
  users: z
    .array(
      z.object({
        name: z
          .string()
          .regex(/^[a-zA-Z0-9_-]+$/)
          .trim()
          .min(1),
        shell: z
          .string()
          .regex(
            /^\/(usr\/bin|bin|usr\/local\/bin|usr\/pkg\/bin)\/[a-zA-Z0-9_-]+$/,
          )
          .trim()
          .default("/bin/bash")
          .optional(),
        sudo: z
          .array(z.string())
          .optional()
          .default(["ALL=(ALL) NOPASSWD:ALL"]),
        sshAuthorizedKeys: z
          .array(
            z
              .string()
              .regex(
                /^(ssh-(rsa|ed25519|dss|ecdsa) AAAA[0-9A-Za-z+/]+[=]{0,3}( [^\n\r]*)?|ecdsa-sha2-nistp(256|384|521) AAAA[0-9A-Za-z+/]+[=]{0,3}( [^\n\r]*)?)$/,
              )
              .trim(),
          )
          .min(1),
      }),
    )
    .optional(),
  instanceId: z.string().trim().optional(),
  localHostname: z.string().trim().optional(),
  hostname: z.string().trim().optional(),
});

export type NewMachine = z.infer<typeof NewMachineSchema>;

export const NewVolumeSchema = z.object({
  name: z.string().trim(),
  baseImage: z
    .string()
    .trim()
    .regex(
      /^([a-zA-Z0-9\-\.]+\/)?([a-zA-Z0-9\-\.]+\/)?[a-zA-Z0-9\-\.]+(:[\w\.\-]+)?$/,
    ),
  size: z
    .string()
    .trim()
    .regex(/^\d+(M|G|T)$/)
    .optional(),
});

export type NewVolume = z.infer<typeof NewVolumeSchema>;

export const NewImageSchema = z.object({
  from: z.string().trim(),
  image: z
    .string()
    .trim()
    .regex(
      /^([a-zA-Z0-9\-\.]+\/)?([a-zA-Z0-9\-\.]+\/)?[a-zA-Z0-9\-\.]+(:[\w\.\-]+)?$/,
    ),
});

export type NewImage = z.infer<typeof NewImageSchema>;
