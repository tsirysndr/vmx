import { Data, Effect, pipe } from "effect";
import type { VirtualMachine } from "../db.ts";
import { getInstanceState } from "../state.ts";

class VmNotFoundError extends Data.TaggedError("VmNotFoundError")<{
  name: string;
}> {}

const findVm = (name: string) =>
  pipe(
    getInstanceState(name),
    Effect.flatMap((vm) =>
      vm ? Effect.succeed(vm) : Effect.fail(new VmNotFoundError({ name }))
    ),
  );

const displayVm = (vm: VirtualMachine) =>
  Effect.sync(() => {
    console.log(vm);
  });

const handleError = (error: VmNotFoundError | Error) =>
  Effect.sync(() => {
    if (error instanceof VmNotFoundError) {
      console.error(
        `Virtual machine with name or ID ${error.name} not found.`,
      );
    } else {
      console.error(`An error occurred: ${error}`);
    }
    Deno.exit(1);
  });

const inspectEffect = (name: string) =>
  pipe(
    findVm(name),
    Effect.flatMap(displayVm),
    Effect.catchAll(handleError),
  );

export default async function (name: string) {
  await Effect.runPromise(inspectEffect(name));
}
