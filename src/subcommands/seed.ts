import { Input } from "@cliffy/prompt";
import { Effect } from "effect";
import { createSeedIso } from "../xorriso.ts";

const seed = Effect.gen(function* () {
  const { instanceId, localHostname, name, shell, sudo, sshAuthorizedKeys } =
    yield* Effect.promise(async () => {
      const instanceId: string = await Input.prompt({
        message: "Instance ID",
        minLength: 5,
      });

      const localHostname: string = await Input.prompt({
        message: "Local Hostname",
        minLength: 3,
      });

      const name = await Input.prompt({
        message: "Default User",
        minLength: 3,
      });

      const shell = await Input.prompt({
        message: "User Shell",
        default: "/bin/bash",
      });

      const sudo = await Input.prompt({
        message: "Sudo",
        default: "ALL=(ALL) NOPASSWD:ALL",
      });

      const sshAuthorizedKeys = await Input.prompt({
        message: "SSH Authorized Keys (comma separated)",
      });

      return {
        instanceId,
        localHostname,
        name,
        shell,
        sudo,
        sshAuthorizedKeys,
      };
    });
  yield* createSeedIso({
    metaData: {
      instanceId,
      localHostname,
    },
    userData: {
      users: [
        {
          name,
          shell,
          sudo: [sudo],
          sshAuthorizedKeys: sshAuthorizedKeys
            .split(",")
            .map((key) => key.trim()),
        },
      ],
      sshPwauth: false,
    },
  });
});

export default async function () {
  await Effect.runPromise(seed);
}
