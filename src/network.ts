import chalk from "chalk";
import { Data, Effect } from "effect";

export class NetworkError extends Data.TaggedError("NetworkError")<{
  cause?: unknown;
}> {}

export class BridgeSetupError extends Data.TaggedError("BridgeSetupError")<{
  cause?: unknown;
}> {}

export const setupQemuBridge = (bridgeName: string) =>
  Effect.tryPromise({
    try: async () => {
      const bridgeConfPath = "/etc/qemu/bridge.conf";
      const bridgeConfContent = await Deno.readTextFile(bridgeConfPath).catch(
        () => "",
      );
      if (bridgeConfContent.includes(`allow ${bridgeName}`)) {
        console.log(
          chalk.greenBright(
            `QEMU bridge configuration for ${bridgeName} already exists.`,
          ),
        );
        return;
      }

      console.log(
        chalk.blueBright(
          `Adding QEMU bridge configuration for ${bridgeName}...`,
        ),
      );

      const cmd = new Deno.Command("sudo", {
        args: [
          "sh",
          "-c",
          `mkdir -p /etc/qemu && echo "allow ${bridgeName}" >> ${bridgeConfPath}`,
        ],
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      const status = await cmd.spawn().status;

      if (!status.success) {
        console.error(
          chalk.redBright(
            `Failed to add QEMU bridge configuration for ${bridgeName}.`,
          ),
        );
        Deno.exit(status.code);
      }

      console.log(
        chalk.greenBright(
          `QEMU bridge configuration for ${bridgeName} added successfully.`,
        ),
      );
    },
    catch: (error) => new BridgeSetupError({ cause: error }),
  });

export const createBridgeNetworkIfNeeded = (
  bridgeName: string,
) =>
  Effect.tryPromise({
    try: async () => {
      const bridgeExistsCmd = new Deno.Command("ip", {
        args: ["link", "show", bridgeName],
        stdout: "null",
        stderr: "null",
      });

      const bridgeExistsStatus = await bridgeExistsCmd.spawn().status;
      if (bridgeExistsStatus.success) {
        console.log(
          chalk.greenBright(`Network bridge ${bridgeName} already exists.`),
        );
        await setupQemuBridge(bridgeName);
        return;
      }

      console.log(chalk.blueBright(`Creating network bridge ${bridgeName}...`));
      const createBridgeCmd = new Deno.Command("sudo", {
        args: ["ip", "link", "add", bridgeName, "type", "bridge"],
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });

      let status = await createBridgeCmd.spawn().status;
      if (!status.success) {
        console.error(
          chalk.redBright(`Failed to create network bridge ${bridgeName}.`),
        );
        Deno.exit(status.code);
      }

      const bringUpBridgeCmd = new Deno.Command("sudo", {
        args: ["ip", "link", "set", "dev", bridgeName, "up"],
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      status = await bringUpBridgeCmd.spawn().status;
      if (!status.success) {
        console.error(
          chalk.redBright(`Failed to bring up network bridge ${bridgeName}.`),
        );
        Deno.exit(status.code);
      }

      console.log(
        chalk.greenBright(`Network bridge ${bridgeName} created and up.`),
      );

      await setupQemuBridge(bridgeName);
    },
    catch: (error) => new NetworkError({ cause: error }),
  });

export const generateRandomMacAddress = () =>
  Effect.sync(() => {
    const hexDigits = "0123456789ABCDEF";
    let macAddress = "52:54:00";

    for (let i = 0; i < 3; i++) {
      macAddress += ":";
      for (let j = 0; j < 2; j++) {
        macAddress += hexDigits.charAt(
          Math.floor(Math.random() * hexDigits.length),
        );
      }
    }

    return macAddress;
  });
