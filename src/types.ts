import z from "@zod/zod";

export type STATUS = "RUNNING" | "STOPPED";

export const MachineParamsSchema = z.object({
  portForward: z.array(z.string().regex(/^\d+:\d+$/)).optional(),
  cpu: z.string().optional(),
  cpus: z.number().min(1).optional(),
  memory: z.string().regex(/^\d+(M|G)$/).optional(),
});

export type MachineParams = z.infer<typeof MachineParamsSchema>;

export const NewMachineSchema = MachineParamsSchema.extend({
  portForward: z.array(z.string().regex(/^\d+:\d+$/)).optional(),
  cpu: z.string().default("host").optional(),
  cpus: z.number().min(1).default(8).optional(),
  memory: z.string().regex(/^\d+(M|G)$/).default("2G").optional(),
  image: z.string().regex(
    /^([a-zA-Z0-9\-\.]+\/)?([a-zA-Z0-9\-\.]+\/)?[a-zA-Z0-9\-\.]+(:[\w\.\-]+)?$/,
  ),
  volume: z.string().optional(),
  bridge: z.string().optional(),
});

export type NewMachine = z.infer<typeof NewMachineSchema>;

export const NewVolumeSchema = z.object({
  name: z.string(),
  baseImage: z.string().regex(
    /^([a-zA-Z0-9\-\.]+\/)?([a-zA-Z0-9\-\.]+\/)?[a-zA-Z0-9\-\.]+(:[\w\.\-]+)?$/,
  ),
  size: z.string().regex(/^\d+(M|G|T)$/).optional(),
});

export type NewVolume = z.infer<typeof NewVolumeSchema>;
