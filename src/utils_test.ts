import { assertEquals } from "@std/assert";
import { Effect, pipe } from "effect";
import {
  FEDORA_COREOS_IMG_URL,
  GENTOO_IMG_URL,
  NIXOS_ISO_URL,
} from "./constants.ts";
import {
  constructCoreOSImageURL,
  constructDebianImageURL,
  constructGentooImageURL,
  constructNixOSImageURL,
} from "./utils.ts";

Deno.test("Test Default Fedora CoreOS Image URL", () => {
  const url = Effect.runSync(
    pipe(
      constructCoreOSImageURL("fedora-coreos"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(url, FEDORA_COREOS_IMG_URL);
});

Deno.test("Test Default Fedora CoreOS Image URL", () => {
  const url = Effect.runSync(
    pipe(
      constructCoreOSImageURL("coreos"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(url, FEDORA_COREOS_IMG_URL);
});

Deno.test("Test Specific Fedora CoreOS Version", () => {
  const url = Effect.runSync(
    pipe(
      constructCoreOSImageURL("fedora-coreos-43.20251024.2.0"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(
    url,
    "https://builds.coreos.fedoraproject.org/prod/streams/stable/builds/43.20251024.2.0/" +
      `${Deno.build.arch}/fedora-coreos-43.20251024.2.0-qemu.${Deno.build.arch}.qcow2.xz`,
  );
});

Deno.test("Test invalid Fedora CoreOS Image Name", () => {
  const url = Effect.runSync(
    pipe(
      constructCoreOSImageURL("fedora-coreos-latest"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(url, null);
});

Deno.test("Test Default NixOS Image URL", () => {
  const url = Effect.runSync(
    pipe(
      constructNixOSImageURL("nixos"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(url, NIXOS_ISO_URL);
});

Deno.test("Test Specific NixOS Version", () => {
  const url = Effect.runSync(
    pipe(
      constructNixOSImageURL("nixos-24.05"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(
    url,
    `https://channels.nixos.org/nixos-24.05/latest-nixos-minimal-${Deno.build.arch}-linux.iso`,
  );
});

Deno.test("Test invalid NixOS Image Name", () => {
  const url = Effect.runSync(
    pipe(
      constructNixOSImageURL("nixos-latest"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(url, null);
});

Deno.test("Test valid Gentoo Image Name", () => {
  const url = Effect.runSync(
    pipe(
      constructGentooImageURL("gentoo-20251116T161545Z"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  const arch = Deno.build.arch === "aarch64" ? "arm64" : "amd64";
  assertEquals(
    url,
    `https://distfiles.gentoo.org/releases/${arch}/autobuilds/20251116T161545Z/di-${arch}-console-20251116T161545Z.qcow2`,
  );
});

Deno.test("Test valid Gentoo Image Name", () => {
  const url = Effect.runSync(
    pipe(
      constructGentooImageURL("gentoo"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(url, GENTOO_IMG_URL);
});

Deno.test("Test invalid Gentoo Image Name", () => {
  const url = Effect.runSync(
    pipe(
      constructGentooImageURL("gentoo-latest"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(url, null);
});

Deno.test("Test valid Debian Image Name", () => {
  const url = Effect.runSync(
    pipe(
      constructDebianImageURL("debian-13.2.0"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  const arch = Deno.build.arch === "aarch64" ? "arm64" : "amd64";
  assertEquals(
    url,
    `https://cdimage.debian.org/debian-cd/current/${arch}/iso-cd/debian-13.2.0-${arch}-netinst.iso`,
  );
});

Deno.test("Test valid Debian Image Name", () => {
  const url = Effect.runSync(
    pipe(
      constructDebianImageURL("debian"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  const arch = Deno.build.arch === "aarch64" ? "arm64" : "amd64";
  assertEquals(
    url,
    `https://cdimage.debian.org/debian-cd/current/${arch}/iso-cd/debian-13.2.0-${arch}-netinst.iso`,
  );
});

Deno.test("Test invalid Debian Image Name", () => {
  const url = Effect.runSync(
    pipe(
      constructDebianImageURL("debian-latest"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null)),
    ),
  );

  assertEquals(url, null);
});
