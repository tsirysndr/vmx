import _ from "@es-toolkit/es-toolkit/compat";
import { stringify } from "@std/yaml";
import chalk from "chalk";
import { Effect, pipe } from "effect";

export type Seed = {
  metaData: {
    instanceId: string;
    localHostname: string;
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

const writeMetaData = (seed: Seed) =>
  Effect.tryPromise({
    try: () =>
      Deno.writeTextFile(
        "seed/meta-data",
        stringify(snakeCase(seed.metaData), {
          flowLevel: -1,
          lineWidth: -1,
        })
      ),
    catch: (error) => new FileSystemError(error),
  });

const writeUserData = (seed: Seed) =>
  Effect.tryPromise({
    try: () =>
      Deno.writeTextFile(
        "seed/user-data",
        `#cloud-config\n${stringify(snakeCase(seed.userData), {
          flowLevel: -1,
          lineWidth: -1,
        })}`
      ),
    catch: (error) => new FileSystemError(error),
  });

const runXorriso = Effect.tryPromise({
  try: async () => {
    const xorriso = new Deno.Command("xorriso", {
      args: [
        "-as",
        "mkisofs",
        "-o",
        "seed.iso",
        "-V",
        "cidata",
        "-J",
        "-R",
        "seed",
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

export const createSeedIso = (seed: Seed) =>
  pipe(
    createSeedDirectory,
    Effect.flatMap(() =>
      Effect.all([writeMetaData(seed), writeUserData(seed)])
    ),
    Effect.flatMap(() => runXorriso)
  );

export default (seed: Seed) => Effect.runPromise(createSeedIso(seed));
