import { createId } from "@paralleldrive/cuid2";
import { Effect, pipe } from "effect";
import { saveImage } from "../images.ts";
import { getInstanceState, type VirtualMachine } from "../mod.ts";
import { du, extractTag } from "../utils.ts";

const failIfNoVM = (
  [vm, tag]: [VirtualMachine | undefined, string],
) =>
  Effect.gen(function* () {
    if (!vm) {
      throw new Error(`VM with name ${name} not found`);
    }
    if (!vm.drivePath) {
      throw new Error(`VM with name ${name} has no drive attached`);
    }

    const size = yield* du(vm.drivePath);

    return [vm, tag, size] as [VirtualMachine, string, number];
  });

export default async function (name: string, image: string) {
  await Effect.runPromise(
    pipe(
      Effect.all([getInstanceState(name), extractTag(image)]),
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
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`Failed to tag image: ${error.cause}`);
          Deno.exit(1);
        })
      ),
    ),
  );
}
