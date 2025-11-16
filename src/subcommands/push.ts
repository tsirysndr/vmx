import { Effect, pipe } from "effect";
import { pushImage, setupOrasBinary } from "../oras.ts";
import { validateImage } from "../utils.ts";

export default async function (image: string): Promise<void> {
  await Effect.runPromise(
    pipe(
      Effect.promise(() => setupOrasBinary()),
      Effect.tap(() => validateImage(image)),
      Effect.tap(() => pushImage(image)),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`Failed to push image: ${error.cause}`);
          Deno.exit(1);
        })
      ),
    ),
  );
}
