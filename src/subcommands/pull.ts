import { Effect, pipe } from "effect";
import { pullImage, setupOrasBinary } from "../oras.ts";
import { validateImage } from "../utils.ts";

export default async function (image: string): Promise<void> {
  await Effect.runPromise(
    pipe(
      Effect.promise(() => setupOrasBinary()),
      Effect.tap(() => validateImage(image)),
      Effect.tap(() => pullImage(image)),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`Failed to pull image: ${error.cause}`);
          Deno.exit(1);
        })
      ),
    ),
  );
}
