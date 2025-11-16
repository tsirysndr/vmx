import { parseFlags } from "@cliffy/flags";
import { Effect, pipe } from "effect";
import type { Image, Volume } from "../db.ts";
import { getImage } from "../images.ts";
import { createBridgeNetworkIfNeeded } from "../network.ts";
import { pullImage, PullImageError, setupOrasBinary } from "../oras.ts";
import { type Options, runQemu, validateImage } from "../utils.ts";
import { createVolume, getVolume } from "../volumes.ts";

const pullImageOnMissing = (
  name: string,
): Effect.Effect<Image, Error, never> =>
  pipe(
    getImage(name),
    Effect.flatMap((img) => {
      if (img) {
        return Effect.succeed(img);
      }
      console.log(`Image ${name} not found locally`);
      return pipe(
        pullImage(name),
        Effect.flatMap(() => getImage(name)),
        Effect.flatMap((pulledImg) =>
          pulledImg ? Effect.succeed(pulledImg) : Effect.fail(
            new PullImageError({ cause: "Failed to pull image" }),
          )
        ),
      );
    }),
  );

const createVolumeIfNeeded = (
  image: Image,
): Effect.Effect<[Image, Volume?], Error, never> =>
  parseFlags(Deno.args).flags.volume
    ? Effect.gen(function* () {
      const volumeName = parseFlags(Deno.args).flags.volume as string;
      const volume = yield* getVolume(volumeName);
      if (volume) {
        return [image, volume];
      }
      const newVolume = yield* createVolume(volumeName, image);
      return [image, newVolume];
    })
    : Effect.succeed([image]);

const runImage = ([image, volume]: [Image, Volume?]) =>
  Effect.gen(function* () {
    console.log(`Running image ${image.repository}...`);
    const options = mergeFlags(image);
    if (options.bridge) {
      yield* createBridgeNetworkIfNeeded(options.bridge);
    }

    if (volume) {
      options.image = volume.path;
      options.install = true;
      options.diskFormat = "qcow2";
    }

    yield* runQemu(null, options);
  });

export default async function (
  image: string,
): Promise<void> {
  await Effect.runPromise(
    pipe(
      Effect.promise(() => setupOrasBinary()),
      Effect.tap(() => validateImage(image)),
      Effect.flatMap(() => pullImageOnMissing(image)),
      Effect.flatMap(createVolumeIfNeeded),
      Effect.flatMap(runImage),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`Failed to run image: ${error.cause} ${image}`);
          Deno.exit(1);
        })
      ),
    ),
  );
}

function mergeFlags(image: Image): Options {
  const { flags } = parseFlags(Deno.args);
  return {
    cpu: (flags.cpu || flags.c) ? (flags.cpu || flags.c) : "host",
    cpus: (flags.cpus || flags.C) ? (flags.cpus || flags.C) : 2,
    memory: (flags.memory || flags.m) ? (flags.memory || flags.m) : "2G",
    image: image.path,
    bridge: flags.bridge || flags.b,
    portForward: flags.portForward || flags.p,
    detach: flags.detach || flags.d,
    install: false,
    diskFormat: image.format,
    volume: flags.volume || flags.v,
  };
}
