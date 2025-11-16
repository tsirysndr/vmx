import { setupOrasBinary } from "../oras.ts";

export default async function (
  username: string,
  password: string,
  reqistry: string,
) {
  await setupOrasBinary();

  const cmd = new Deno.Command("oras", {
    args: [
      "login",
      "--username",
      username,
      "--password-stdin",
      reqistry,
    ],
    stdin: "piped",
    stderr: "inherit",
    stdout: "inherit",
  });

  const process = cmd.spawn();
  if (process.stdin) {
    const writer = process.stdin.getWriter();
    await writer.write(new TextEncoder().encode(password + "\n"));
    writer.close();
  }

  const status = await process.status;

  if (!status.success) {
    Deno.exit(status.code);
  }
}
