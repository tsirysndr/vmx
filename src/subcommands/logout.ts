import { setupOrasBinary } from "../oras.ts";

export default async function (registry: string) {
  await setupOrasBinary();

  const cmd = new Deno.Command("oras", {
    args: ["logout", registry],
    stderr: "inherit",
    stdout: "inherit",
  });

  const process = cmd.spawn();

  const status = await process.status;

  if (!status.success) {
    Deno.exit(status.code);
  }
}
