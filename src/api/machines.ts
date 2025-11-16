import { Hono } from "hono";
import { Data, Effect, pipe } from "effect";
import {
  createVolumeIfNeeded,
  handleError,
  parseCreateMachineRequest,
  parseParams,
  parseQueryParams,
  parseStartRequest,
  presentation,
} from "./utils.ts";
import { DEFAULT_VERSION, getInstanceState } from "../mod.ts";
import {
  listInstances,
  removeInstanceState,
  saveInstanceState,
} from "../state.ts";
import { findVm, killProcess, updateToStopped } from "../subcommands/stop.ts";
import {
  buildQemuArgs,
  createLogsDir,
  failIfVMRunning,
  setupFirmware,
  startDetachedQemu,
} from "../subcommands/start.ts";
import type { NewMachine } from "../types.ts";
import { createId } from "@paralleldrive/cuid2";
import { generateRandomMacAddress } from "../network.ts";
import Moniker from "moniker";
import { getImage } from "../images.ts";

export class ImageNotFoundError extends Data.TaggedError("ImageNotFoundError")<{
  id: string;
}> {}

export class RemoveRunningVmError extends Data.TaggedError(
  "RemoveRunningVmError",
)<{
  id: string;
}> {}

const app = new Hono();

app.get("/", (c) =>
  Effect.runPromise(
    pipe(
      parseQueryParams(c),
      Effect.flatMap((params) =>
        listInstances(
          params.all === "true" || params.all === "1",
        )
      ),
      presentation(c),
    ),
  ));

app.post("/", (c) =>
  Effect.runPromise(
    pipe(
      parseCreateMachineRequest(c),
      Effect.flatMap((params: NewMachine) =>
        Effect.gen(function* () {
          const image = yield* getImage(params.image);
          if (!image) {
            return yield* Effect.fail(
              new ImageNotFoundError({ id: params.image }),
            );
          }

          const volume = params.volume
            ? yield* createVolumeIfNeeded(image, params.volume)
            : undefined;

          const macAddress = yield* generateRandomMacAddress();
          const id = createId();
          yield* saveInstanceState({
            id,
            name: Moniker.choose(),
            bridge: params.bridge,
            macAddress,
            memory: params.memory || "2G",
            cpus: params.cpus || 8,
            cpu: params.cpu || "host",
            diskSize: "20G",
            diskFormat: volume ? "qcow2" : "raw",
            portForward: params.portForward
              ? params.portForward.join(",")
              : undefined,
            drivePath: volume ? volume.path : image.path,
            version: image.tag ?? DEFAULT_VERSION,
            status: "STOPPED",
            pid: 0,
          });

          const createdVm = yield* findVm(id);
          return createdVm;
        })
      ),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

app.get("/:id", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => getInstanceState(id)),
      presentation(c),
    ),
  ));

app.delete("/:id", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => findVm(id)),
      Effect.flatMap((vm) =>
        vm.status === "RUNNING"
          ? Effect.fail(new RemoveRunningVmError({ id: vm.id }))
          : Effect.succeed(vm)
      ),
      Effect.flatMap((vm) =>
        Effect.gen(function* () {
          yield* removeInstanceState(vm.id);
          return vm;
        })
      ),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

app.post("/:id/start", (c) =>
  Effect.runPromise(
    pipe(
      Effect.all([parseParams(c), parseStartRequest(c)]),
      Effect.flatMap((
        [{ id }, startRequest],
      ) => Effect.all([findVm(id), Effect.succeed(startRequest)])),
      Effect.flatMap(([vm, startRequest]) =>
        Effect.gen(function* () {
          yield* failIfVMRunning(vm);
          const firmwareArgs = yield* setupFirmware();
          const qemuArgs = yield* buildQemuArgs({
            ...vm,
            cpu: String(startRequest.cpu ?? vm.cpu),
            cpus: startRequest.cpus ?? vm.cpus,
            memory: startRequest.memory ?? vm.memory,
            portForward: startRequest.portForward
              ? startRequest.portForward.join(",")
              : vm.portForward,
          }, firmwareArgs);
          yield* createLogsDir();
          yield* startDetachedQemu(vm.id, vm, qemuArgs);
          return { ...vm, status: "RUNNING" };
        })
      ),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

app.post("/:id/stop", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => findVm(id)),
      Effect.flatMap(killProcess),
      Effect.flatMap(updateToStopped),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

app.post("/:id/restart", (c) =>
  Effect.runPromise(
    pipe(
      parseParams(c),
      Effect.flatMap(({ id }) => findVm(id)),
      Effect.flatMap(killProcess),
      Effect.flatMap(updateToStopped),
      Effect.flatMap(() => Effect.all([parseParams(c), parseStartRequest(c)])),
      Effect.flatMap((
        [{ id }, startRequest],
      ) => Effect.all([findVm(id), Effect.succeed(startRequest)])),
      Effect.flatMap(([vm, startRequest]) =>
        Effect.gen(function* () {
          const firmwareArgs = yield* setupFirmware();
          const qemuArgs = yield* buildQemuArgs({
            ...vm,
            cpu: String(startRequest.cpus ?? vm.cpu),
            memory: startRequest.memory ?? vm.memory,
            portForward: startRequest.portForward
              ? startRequest.portForward.join(",")
              : vm.portForward,
          }, firmwareArgs);
          yield* createLogsDir();
          yield* startDetachedQemu(vm.id, vm, qemuArgs);
          return { ...vm, status: "RUNNING" };
        })
      ),
      presentation(c),
      Effect.catchAll((error) => handleError(error, c)),
    ),
  ));

export default app;
