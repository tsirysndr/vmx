import { assertEquals } from "@std/assert";
import { Effect, pipe } from "effect";
import { FEDORA_COREOS_IMG_URL } from "./constants.ts";
import { constructCoreOSImageURL } from "./utils.ts";

Deno.test("Test Default Fedora CoreOS Image URL", () => {
  const url = Effect.runSync(
    pipe(
      constructCoreOSImageURL("fedora-coreos"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null))
    )
  );

  assertEquals(url, FEDORA_COREOS_IMG_URL);
});

Deno.test("Test Default Fedora CoreOS Image URL", () => {
  const url = Effect.runSync(
    pipe(
      constructCoreOSImageURL("coreos"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null))
    )
  );

  assertEquals(url, FEDORA_COREOS_IMG_URL);
});

Deno.test("Test Specific Fedora CoreOS Version", () => {
  const url = Effect.runSync(
    pipe(
      constructCoreOSImageURL("fedora-coreos-43.20251024.2.0"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null))
    )
  );

  assertEquals(
    url,
    "https://builds.coreos.fedoraproject.org/prod/streams/stable/builds/43.20251024.2.0/" +
      `${Deno.build.arch}/fedora-coreos-43.20251024.2.0-qemu.${Deno.build.arch}.qcow2.xz`
  );
});

Deno.test("Test invalid Fedora CoreOS Image Name", () => {
  const url = Effect.runSync(
    pipe(
      constructCoreOSImageURL("fedora-coreos-latest"),
      Effect.catchAll((_error) => Effect.succeed(null as string | null))
    )
  );

  assertEquals(url, null);
});
