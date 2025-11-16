import { createId } from "@paralleldrive/cuid2";
import { basename, dirname } from "@std/path";
import chalk from "chalk";
import { Data, Effect, pipe } from "effect";
import { IMAGE_DIR } from "./constants.ts";
import { getImage, saveImage } from "./images.ts";
import { CONFIG_DIR, failOnMissingImage } from "./mod.ts";
import { du, getCurrentArch } from "./utils.ts";

const DEFAULT_ORAS_VERSION = "1.3.0";

export class PushImageError extends Data.TaggedError("PushImageError")<{
  cause?: unknown;
}> {}

export class PullImageError extends Data.TaggedError("PullImageError")<{
  cause?: unknown;
}> {}

export class CreateDirectoryError
  extends Data.TaggedError("CreateDirectoryError")<{
    cause?: unknown;
  }> {}

export class ImageAlreadyPulledError
  extends Data.TaggedError("ImageAlreadyPulledError")<{
    name: string;
  }> {}

export async function setupOrasBinary(): Promise<void> {
  Deno.env.set(
    "PATH",
    `${CONFIG_DIR}/bin:${Deno.env.get("PATH")}`,
  );

  const oras = new Deno.Command("which", {
    args: ["oras"],
    stdout: "null",
    stderr: "null",
  })
    .spawn();

  const orasStatus = await oras.status;
  if (orasStatus.success) {
    return;
  }

  const version = Deno.env.get("ORAS_VERSION") || DEFAULT_ORAS_VERSION;

  console.log(`Downloading ORAS version ${version}...`);

  const os = Deno.build.os;
  let arch = "amd64";

  if (Deno.build.arch === "aarch64") {
    arch = "arm64";
  }

  if (os !== "linux" && os !== "darwin") {
    console.error("Unsupported OS. Please download ORAS manually.");
    Deno.exit(1);
  }

  // https://github.com/oras-project/oras/releases/download/v1.3.0/oras_1.3.0_darwin_amd64.tar.gz
  const downloadUrl =
    `https://github.com/oras-project/oras/releases/download/v${version}/oras_${version}_${os}_${arch}.tar.gz`;

  console.log(`Downloading ORAS from ${chalk.greenBright(downloadUrl)}`);

  const downloadProcess = new Deno.Command("curl", {
    args: ["-L", downloadUrl, "-o", `oras_${version}_${os}_${arch}.tar.gz`],
    stdout: "inherit",
    stderr: "inherit",
    cwd: "/tmp",
  })
    .spawn();

  const status = await downloadProcess.status;
  if (!status.success) {
    console.error("Failed to download ORAS binary.");
    Deno.exit(1);
  }

  console.log("Extracting ORAS binary...");

  const extractProcess = new Deno.Command("tar", {
    args: [
      "-xzf",
      `oras_${version}_${os}_${arch}.tar.gz`,
      "-C",
      "./",
    ],
    stdout: "inherit",
    stderr: "inherit",
    cwd: "/tmp",
  })
    .spawn();

  const extractStatus = await extractProcess.status;
  if (!extractStatus.success) {
    console.error("Failed to extract ORAS binary.");
    Deno.exit(1);
  }

  await Deno.remove(`/tmp/oras_${version}_${os}_${arch}.tar.gz`);

  await Deno.mkdir(`${CONFIG_DIR}/bin`, { recursive: true });

  await Deno.rename(
    `/tmp/oras`,
    `${CONFIG_DIR}/bin/oras`,
  );
  await Deno.chmod(`${CONFIG_DIR}/bin/oras`, 0o755);

  console.log(
    `ORAS binary installed at ${
      chalk.greenBright(
        `${CONFIG_DIR}/bin/oras`,
      )
    }`,
  );
}

const archiveImage = (img: { path: string }) =>
  Effect.tryPromise({
    try: async () => {
      console.log("Archiving image for push...");
      const tarProcess = new Deno.Command("tar", {
        args: [
          "-cSzf",
          `${img.path}.tar.gz`,
          "-C",
          dirname(img.path),
          basename(img.path),
        ],
        stdout: "inherit",
        stderr: "inherit",
      }).spawn();

      const tarStatus = await tarProcess.status;
      if (!tarStatus.success) {
        throw new Error(`Failed to create tar archive for image`);
      }
      return `${img.path}.tar.gz`;
    },
    catch: (error: unknown) =>
      new PushImageError({
        cause: error instanceof Error ? error.message : String(error),
      }),
  });

// add docker.io/ if no registry is specified
const formatRepository = (repository: string) =>
  repository.match(/^[^\/]+\.[^\/]+\/.*/i)
    ? repository
    : `docker.io/${repository}`;

const pushToRegistry = (
  img: { repository: string; tag: string; path: string },
) =>
  Effect.tryPromise({
    try: async () => {
      console.log(`Pushing image ${formatRepository(img.repository)}...`);
      const process = new Deno.Command("oras", {
        args: [
          "push",
          `${formatRepository(img.repository)}:${img.tag}-${getCurrentArch()}`,
          "--artifact-type",
          "application/vnd.oci.image.layer.v1.tar",
          "--annotation",
          `org.opencontainers.image.architecture=${getCurrentArch()}`,
          "--annotation",
          "org.opencontainers.image.os=freebsd",
          "--annotation",
          "org.opencontainers.image.description=QEMU raw disk image of FreeBSD",
          basename(img.path),
        ],
        stdout: "inherit",
        stderr: "inherit",
        cwd: dirname(img.path),
      }).spawn();

      const { code } = await process.status;
      if (code !== 0) {
        throw new Error(`ORAS push failed with exit code ${code}`);
      }
      return img.path;
    },
    catch: (error: unknown) =>
      new PushImageError({
        cause: error instanceof Error ? error.message : String(error),
      }),
  });

const cleanup = (path: string) =>
  Effect.tryPromise({
    try: () => Deno.remove(path),
    catch: (error: unknown) =>
      new PushImageError({
        cause: error instanceof Error ? error.message : String(error),
      }),
  });

const createImageDirIfMissing = Effect.promise(() =>
  Deno.mkdir(IMAGE_DIR, { recursive: true })
);

const checkIfImageAlreadyPulled = (image: string) =>
  pipe(
    getImageDigest(image),
    Effect.flatMap(getImage),
    Effect.flatMap((img) => {
      if (img) {
        return Effect.fail(
          new ImageAlreadyPulledError({ name: image }),
        );
      }
      return Effect.succeed(void 0);
    }),
  );

export const pullFromRegistry = (image: string) =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        console.log(`Pulling image ${image}`);
        const repository = image.split(":")[0];
        const tag = image.split(":")[1] || "latest";
        console.log(
          "pull",
          `${formatRepository(repository)}:${tag}-${getCurrentArch()}`,
        );

        const process = new Deno.Command("oras", {
          args: [
            "pull",
            `${formatRepository(repository)}:${tag}-${getCurrentArch()}`,
          ],
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
          cwd: IMAGE_DIR,
        }).spawn();

        const { code } = await process.status;
        if (code !== 0) {
          throw new Error(`ORAS pull failed with exit code ${code}`);
        }
      },
      catch: (error: unknown) =>
        new PullImageError({
          cause: error instanceof Error ? error.message : String(error),
        }),
    }),
  );

export const getImageArchivePath = (image: string) =>
  Effect.tryPromise({
    try: async () => {
      const repository = image.split(":")[0];
      const tag = image.split(":")[1] || "latest";
      const process = new Deno.Command("oras", {
        args: [
          "manifest",
          "fetch",
          `${formatRepository(repository)}:${tag}-${getCurrentArch()}`,
        ],
        stdout: "piped",
        stderr: "inherit",
      }).spawn();

      const { code, stdout } = await process.output();
      if (code !== 0) {
        throw new Error(`ORAS manifest fetch failed with exit code ${code}`);
      }

      const manifest = JSON.parse(new TextDecoder().decode(stdout));
      const layers = manifest.layers;
      if (!layers || layers.length === 0) {
        throw new Error(`No layers found in manifest for image ${image}`);
      }

      if (
        !layers[0].annotations ||
        !layers[0].annotations["org.opencontainers.image.title"]
      ) {
        throw new Error(
          `No title annotation found for layer in image ${image}`,
        );
      }

      const path = `${IMAGE_DIR}/${
        layers[0].annotations["org.opencontainers.image.title"]
      }`;

      if (!(await Deno.stat(path).catch(() => false))) {
        throw new Error(`Image archive not found at expected path ${path}`);
      }

      return path;
    },
    catch: (error: unknown) =>
      new PullImageError({
        cause: error instanceof Error ? error.message : String(error),
      }),
  });

const getImageDigest = (image: string) =>
  Effect.tryPromise({
    try: async () => {
      const repository = image.split(":")[0];
      const tag = image.split(":")[1] || "latest";
      const process = new Deno.Command("oras", {
        args: [
          "manifest",
          "fetch",
          `${formatRepository(repository)}:${tag}-${getCurrentArch()}`,
        ],
        stdout: "piped",
        stderr: "inherit",
      }).spawn();

      const { code, stdout } = await process.output();
      if (code !== 0) {
        throw new Error(`ORAS manifest fetch failed with exit code ${code}`);
      }

      const manifest = JSON.parse(new TextDecoder().decode(stdout));
      if (!manifest.layers[0] || !manifest.layers[0].digest) {
        throw new Error(`No digest found in manifest for image ${image}`);
      }

      return manifest.layers[0].digest as string;
    },
    catch: (error: unknown) =>
      new PullImageError({
        cause: error instanceof Error ? error.message : String(error),
      }),
  });

const extractImage = (path: string) =>
  Effect.tryPromise({
    try: async () => {
      console.log("Extracting image archive...");
      const tarProcess = new Deno.Command("tar", {
        args: [
          "-xSzf",
          path,
          "-C",
          dirname(path),
        ],
        stdout: "inherit",
        stderr: "inherit",
        cwd: IMAGE_DIR,
      }).spawn();

      const tarStatus = await tarProcess.status;
      if (!tarStatus.success) {
        throw new Error(`Failed to extract tar archive for image`);
      }
      return path.replace(/\.tar\.gz$/, "");
    },
    catch: (error: unknown) =>
      new PullImageError({
        cause: error instanceof Error ? error.message : String(error),
      }),
  });

const savePulledImage = (
  imagePath: string,
  digest: string,
  name: string,
) =>
  Effect.gen(function* () {
    yield* saveImage({
      id: createId(),
      repository: name.split(":")[0],
      tag: name.split(":")[1] || "latest",
      size: yield* du(imagePath),
      path: imagePath,
      format: imagePath.endsWith(".qcow2") ? "qcow2" : "raw",
      digest,
    });
    return `${imagePath}.tar.gz`;
  });

export const pushImage = (image: string) =>
  pipe(
    getImage(image),
    Effect.flatMap(failOnMissingImage),
    Effect.flatMap((img) =>
      pipe(
        archiveImage(img),
        Effect.tap((archivedPath) => {
          img.path = archivedPath;
          return Effect.succeed(void 0);
        }),
        Effect.flatMap(() => pushToRegistry(img)),
        Effect.flatMap(cleanup),
      )
    ),
  );

export const pullImage = (image: string) =>
  pipe(
    Effect.all([createImageDirIfMissing, checkIfImageAlreadyPulled(image)]),
    Effect.flatMap(() => pullFromRegistry(image)),
    Effect.flatMap(() => getImageArchivePath(image)),
    Effect.flatMap(extractImage),
    Effect.flatMap((imagePath: string) =>
      Effect.all([
        Effect.succeed(imagePath),
        getImageDigest(image),
        Effect.succeed(image),
      ])
    ),
    Effect.flatMap(([imagePath, digest, image]) =>
      savePulledImage(imagePath, digest, image)
    ),
    Effect.flatMap(cleanup),
    Effect.catchTag("ImageAlreadyPulledError", () =>
      Effect.sync(() => console.log(`Image ${image} is already pulled.`))),
  );
