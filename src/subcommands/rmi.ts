import { Effect, pipe } from "effect";
import { deleteImage, getImage } from "../images.ts";
import { failOnMissingImage } from "../utils.ts";

export default async function (id: string) {
  await Effect.runPromise(
    pipe(
      getImage(id),
      Effect.flatMap(failOnMissingImage),
      Effect.tap(() => deleteImage(id)),
      Effect.tap(() => console.log(`Image ${id} removed successfully.`)),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`Failed to remove image: ${error.message}`);
          Deno.exit(1);
        })
      ),
    ),
  );
}
