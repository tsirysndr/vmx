import z from "zod";

export const ProfileSchema = z.object({
  avatar_url: z.string().optional(),
  display_name: z.string().optional(),
  handle: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;
