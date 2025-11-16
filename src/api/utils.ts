import { Data, Effect } from "effect";
import type { Context } from "hono";
import {
  type CommandError,
  StopCommandError,
  VmNotFoundError,
} from "../subcommands/stop.ts";
import { VmAlreadyRunningError } from "../subcommands/start.ts";
import {
  MachineParamsSchema,
  NewMachineSchema,
  NewVolumeSchema,
} from "../types.ts";
import type { Image, Volume } from "../db.ts";
import { createVolume, getVolume } from "../volumes.ts";
import { ImageNotFoundError, RemoveRunningVmError } from "./machines.ts";

export const parseQueryParams = (c: Context) => Effect.succeed(c.req.query());

export const parseParams = (c: Context) => Effect.succeed(c.req.param());

export const presentation = (c: Context) =>
  Effect.flatMap((data) => Effect.succeed(c.json(data)));

export class ParseRequestError extends Data.TaggedError("ParseRequestError")<{
  cause?: unknown;
  message: string;
}> {}

export const handleError = (
  error:
    | VmNotFoundError
    | StopCommandError
    | CommandError
    | ParseRequestError
    | VmAlreadyRunningError
    | ImageNotFoundError
    | RemoveRunningVmError
    | Error,
  c: Context,
) =>
  Effect.sync(() => {
    if (error instanceof VmNotFoundError) {
      return c.json(
        { message: "VM not found", code: "VM_NOT_FOUND" },
        404,
      );
    }
    if (error instanceof StopCommandError) {
      return c.json(
        {
          message: error.message ||
            `Failed to stop VM ${error.vmName}`,
          code: "STOP_COMMAND_ERROR",
        },
        500,
      );
    }

    if (error instanceof ParseRequestError) {
      return c.json(
        {
          message: error.message || "Failed to parse request body",
          code: "PARSE_BODY_ERROR",
        },
        400,
      );
    }

    if (error instanceof VmAlreadyRunningError) {
      return c.json(
        {
          message: `VM ${error.name} is already running`,
          code: "VM_ALREADY_RUNNING",
        },
        400,
      );
    }

    if (error instanceof ImageNotFoundError) {
      return c.json(
        {
          message: `Image ${error.id} not found`,
          code: "IMAGE_NOT_FOUND",
        },
        404,
      );
    }

    if (error instanceof RemoveRunningVmError) {
      return c.json(
        {
          message:
            `Cannot remove running VM with ID ${error.id}. Please stop it first.`,
          code: "REMOVE_RUNNING_VM_ERROR",
        },
        400,
      );
    }

    return c.json(
      { message: error instanceof Error ? error.message : String(error) },
      500,
    );
  });

export const parseStartRequest = (c: Context) =>
  Effect.tryPromise({
    try: async () => {
      const body = await c.req.json();
      return MachineParamsSchema.parse(body);
    },
    catch: (error) =>
      new ParseRequestError({
        cause: error,
        message: error instanceof Error ? error.message : String(error),
      }),
  });

export const parseCreateMachineRequest = (c: Context) =>
  Effect.tryPromise({
    try: async () => {
      const body = await c.req.json();
      return NewMachineSchema.parse(body);
    },
    catch: (error) =>
      new ParseRequestError({
        cause: error,
        message: error instanceof Error ? error.message : String(error),
      }),
  });

export const createVolumeIfNeeded = (
  image: Image,
  volumeName: string,
  size?: string,
): Effect.Effect<Volume, Error, never> =>
  Effect.gen(function* () {
    const volume = yield* getVolume(volumeName);
    if (volume) {
      return volume;
    }

    return yield* createVolume(volumeName, image, size);
  });

export const parseCreateVolumeRequest = (c: Context) =>
  Effect.tryPromise({
    try: async () => {
      const body = await c.req.json();
      return NewVolumeSchema.parse(body);
    },
    catch: (error) =>
      new ParseRequestError({
        cause: error,
        message: error instanceof Error ? error.message : String(error),
      }),
  });
