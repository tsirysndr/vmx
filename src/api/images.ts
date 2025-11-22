import { createId } from "@paralleldrive/cuid2";
import { Effect, pipe } from "effect";
import { Hono } from "hono";
import type { VirtualMachine } from "../db.ts";
import { ImageNotFoundError, VmNotFoundError } from "../errors.ts";
import { deleteImage, getImage, listImages, saveImage } from "../images.ts";
import { getInstanceState } from "../state.ts";
import { du, extractTag } from "../utils.ts";
import {
  handleError,
  parseCreateImageRequest,
  parseParams,
  presentation,
} from "./utils.ts";

const app = new Hono();

const failIfNoVM = ([vm, tag]: [VirtualMachine | undefined, string]) =>
  Effect.gen(function* () {
    if (!vm) {
      return yield* Effect.fail(new VmNotFoundError({ name: "unknown" }));
    }
    if (!vm.drivePath) {
      return yield* Effect.fail(new ImageNotFoundError({ id: "unknown" }));
    }

    const size = yield* du(vm.drivePath);

    return [vm, tag, size] as [VirtualMachine, string, number];
  });

app.get("/", (c) =>
  Effect.runPromise(
    pipe(
      listImages(),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

app.get("/:id", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => getImage(id)),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

app.post("/", (c) =>
  Effect.runPromise(
    pipe(
      parseCreateImageRequest(c),
      Effect.flatMap(({ from, image }) =>
        Effect.gen(function* () {
          return yield* pipe(
            Effect.all([getInstanceState(from), extractTag(image)]),
            Effect.flatMap(failIfNoVM),
            Effect.flatMap(([vm, tag, size]) =>
              saveImage({
                id: createId(),
                repository: image.split(":")[0],
                tag,
                size,
                path: vm.drivePath!,
                format: vm.diskFormat,
              })
            ),
            Effect.flatMap(() => getImage(image)),
          );
        })
      ),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

app.delete("/:id", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => deleteImage(id)),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

export default app;
