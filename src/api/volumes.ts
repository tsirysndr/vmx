import { Hono } from "hono";
import { Effect, pipe } from "effect";
import {
  createVolumeIfNeeded,
  handleError,
  parseCreateVolumeRequest,
  parseParams,
  presentation,
} from "./utils.ts";
import { listVolumes } from "../mod.ts";
import { deleteVolume, getVolume } from "../volumes.ts";
import type { NewVolume } from "../types.ts";
import { getImage } from "../images.ts";
import { ImageNotFoundError } from "./machines.ts";

const app = new Hono();

app.get("/", (c) =>
  Effect.runPromise(
    pipe(
      listVolumes(),
      presentation(c),
    ),
  ));

app.get("/:id", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => getVolume(id)),
      presentation(c),
    ),
  ));

app.delete("/:id", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) =>
        Effect.gen(function* () {
          const volume = yield* getVolume(id);
          yield* deleteVolume(id);
          return volume;
        })
      ),
      presentation(c),
    ),
  ));

app.post("/", (c) =>
  Effect.runPromise(
    pipe(
      parseCreateVolumeRequest(c),
      Effect.flatMap((params: NewVolume) =>
        Effect.gen(function* () {
          const image = yield* getImage(params.baseImage);
          if (!image) {
            return yield* Effect.fail(
              new ImageNotFoundError({ id: params.baseImage }),
            );
          }

          return yield* createVolumeIfNeeded(image, params.name, params.size);
        })
      ),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

export default app;
