import { Data, Effect, pipe } from "effect";
import type { VirtualMachine } from "../db.ts";
import { getInstanceState, removeInstanceState } from "../state.ts";

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

const logRemoving = (vm: VirtualMachine) =>
  Effect.sync(() => {
    console.log(`Removing virtual machine ${vm.name} (ID: ${vm.id})...`);
  });

const removeVm = (name: string, vm: VirtualMachine) =>
  pipe(
    removeInstanceState(name),
    Effect.map(() => vm),
  );

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

const removeEffect = (name: string) =>
  pipe(
    findVm(name),
    Effect.tap(logRemoving),
    Effect.flatMap((vm) => removeVm(name, vm)),
    Effect.catchAll(handleError),
  );

export default async function (name: string) {
  await Effect.runPromise(removeEffect(name));
}
