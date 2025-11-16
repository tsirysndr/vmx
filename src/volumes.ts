import { createId } from "@paralleldrive/cuid2";
import { Data, Effect } from "effect";
import type { DeleteResult, InsertResult } from "kysely";
import { VOLUME_DIR } from "./constants.ts";
import { ctx } from "./context.ts";
import type { Image, Volume } from "./db.ts";

export class VolumeError extends Data.TaggedError("VolumeError")<{
  message?: unknown;
}> {}

export const listVolumes = () =>
  Effect.tryPromise({
    try: () => ctx.db.selectFrom("volumes").selectAll().execute(),
    catch: (error) =>
      new VolumeError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });

export const getVolume = (
  id: string,
): Effect.Effect<Volume | undefined, VolumeError, never> =>
  Effect.tryPromise({
    try: () =>
      ctx.db
        .selectFrom("volumes")
        .selectAll()
        .where((eb) =>
          eb.or([
            eb("name", "=", id),
            eb("id", "=", id),
            eb("path", "=", id),
          ])
        )
        .executeTakeFirst(),
    catch: (error) =>
      new VolumeError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });

export const saveVolume = (
  volume: Volume,
): Effect.Effect<InsertResult[], VolumeError, never> =>
  Effect.tryPromise({
    try: () =>
      ctx.db.insertInto("volumes")
        .values(volume)
        .execute(),
    catch: (error) =>
      new VolumeError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });

export const deleteVolume = (
  id: string,
): Effect.Effect<DeleteResult[], VolumeError, never> =>
  Effect.tryPromise({
    try: () =>
      ctx.db.deleteFrom("volumes").where((eb) =>
        eb.or([
          eb("name", "=", id),
          eb("id", "=", id),
        ])
      ).execute(),
    catch: (error) =>
      new VolumeError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });

export const createVolume = (
  name: string,
  baseImage: Image,
  size?: string,
): Effect.Effect<Volume, VolumeError, never> =>
  Effect.tryPromise({
    try: async () => {
      const path = `${VOLUME_DIR}/${name}.qcow2`;

      if (!(await Deno.stat(path).catch(() => false))) {
        await Deno.mkdir(VOLUME_DIR, { recursive: true });
        const qemu = new Deno.Command("qemu-img", {
          args: [
            "create",
            "-F",
            "raw",
            "-f",
            "qcow2",
            "-b",
            baseImage.path,
            path,
            ...(size ? [size] : []),
          ],
          stdout: "inherit",
          stderr: "inherit",
        })
          .spawn();
        const status = await qemu.status;
        if (!status.success) {
          throw new Error(
            `Failed to create volume: qemu-img exited with code ${status.code}`,
          );
        }
      }

      ctx.db.insertInto("volumes").values({
        id: createId(),
        name,
        path,
        baseImageId: baseImage.id,
      }).execute();
      const volume = await ctx.db
        .selectFrom("volumes")
        .selectAll()
        .where("name", "=", name)
        .executeTakeFirst();
      if (!volume) {
        throw new Error("Failed to create volume");
      }
      return volume;
    },
    catch: (error) =>
      new VolumeError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });
