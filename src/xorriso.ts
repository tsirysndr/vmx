import _ from "@es-toolkit/es-toolkit/compat";
import { stringify } from "@std/yaml";
import chalk from "chalk";
import { Effect, pipe } from "effect";

export type Seed = {
  metaData: {
    instanceId: string;
    localHostname: string;
    hostname?: string;
  };
  userData: {
    users: Array<{
      name: string;
      shell?: string;
      sudo: string[];
      sshAuthorizedKeys: string[];
    }>;
    sshPwauth: boolean;
    packages?: string[];
  };
};

export class FileSystemError {
  readonly _tag = "FileSystemError";
  constructor(readonly error: unknown) {}
}

export class XorrisoError {
  readonly _tag = "XorrisoError";
  constructor(readonly code: number | null, readonly message: string) {}
}

export const snakeCase = (obj: unknown): unknown => {
  if (Array.isArray(obj)) {
    return obj.map(snakeCase);
  } else if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        _.snakeCase(key),
        snakeCase(value),
      ])
    );
  }
  return obj;
};

const createSeedDirectory = Effect.tryPromise({
  try: () => Deno.mkdir("seed", { recursive: true }),
  catch: (error) => new FileSystemError(error),
});

const writeMetaData = (seed: Seed, outputPath: string) =>
  Effect.tryPromise({
    try: () =>
      Deno.writeTextFile(
        outputPath,
        stringify(snakeCase(seed.metaData), {
          flowLevel: -1,
          lineWidth: -1,
        })
      ),
    catch: (error) => new FileSystemError(error),
  });

const writeUserData = (seed: Seed, outputPath: string) =>
  Effect.tryPromise({
    try: () =>
      Deno.writeTextFile(
        outputPath,
        `#cloud-config\n${stringify(snakeCase(seed.userData), {
          flowLevel: -1,
          lineWidth: -1,
        })}`
      ),
    catch: (error) => new FileSystemError(error),
  });

const runXorriso = (outputPath: string, seedDir: string) =>
  Effect.tryPromise({
    try: async () => {
      const xorriso = new Deno.Command("xorriso", {
        args: [
          "-as",
          "mkisofs",
          "-o",
          outputPath,
          "-V",
          "cidata",
          "-J",
          "-R",
          seedDir,
        ],
        stdout: "inherit",
        stderr: "inherit",
      }).spawn();

      const status = await xorriso.status;

      if (!status.success) {
        throw new XorrisoError(
          status.code,
          `xorriso failed with code ${status.code}. Please ensure ${chalk.green(
            "xorriso"
          )} is installed and accessible in your PATH.`
        );
      }

      return status;
    },
    catch: (error) => {
      if (error instanceof XorrisoError) return error;
      return new XorrisoError(
        null,
        `Unexpected error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    },
  });

const runGenisoimage = (outputPath: string, seedDir: string) =>
  Effect.tryPromise({
    try: async () => {
      const genisoimage = new Deno.Command("genisoimage", {
        args: [
          "-output",
          outputPath,
          "-volid",
          "cidata",
          "-joliet",
          "-rock",
          seedDir,
        ],
        stdout: "inherit",
        stderr: "inherit",
      }).spawn();

      const status = await genisoimage.status;

      if (!status.success) {
        throw new XorrisoError(
          status.code,
          `genisoimage failed with code ${
            status.code
          }. Please ensure ${chalk.green(
            "genisoimage"
          )} is installed and accessible in your PATH.`
        );
      }

      return status;
    },
    catch: (error) => {
      if (error instanceof XorrisoError) return error;
      return new XorrisoError(
        null,
        `Unexpected error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    },
  });

export const createSeedIso = (
  outputPath: string,
  seed: Seed,
  seedDir: string = "seed"
) =>
  pipe(
    createSeedDirectory,
    Effect.flatMap(() =>
      Effect.all([
        writeMetaData(seed, `${seedDir}/meta-data`),
        writeUserData(seed, `${seedDir}/user-data`),
      ])
    ),
    Effect.flatMap(() =>
      Deno.build.os === "linux"
        ? runGenisoimage(outputPath, seedDir)
        : runXorriso(outputPath, seedDir)
    )
  );

export default (outputPath: string, seed: Seed, seedDir: string = "seed") =>
  Effect.runPromise(createSeedIso(outputPath, seed, seedDir));
