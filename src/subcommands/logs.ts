import { Data, Effect, pipe } from "effect";
import { LOGS_DIR } from "../constants.ts";

class LogCommandError extends Data.TaggedError("LogCommandError")<{
  vmName: string;
  exitCode: number;
}> {}

class CommandError extends Data.TaggedError("CommandError")<{
  cause?: unknown;
}> {}

const createLogsDir = () =>
  Effect.tryPromise({
    try: () => Deno.mkdir(LOGS_DIR, { recursive: true }),
    catch: (error) => new CommandError({ cause: error }),
  });

const buildLogPath = (name: string) =>
  Effect.succeed(`${LOGS_DIR}/${name}.log`);

const viewLogs = (name: string, follow: boolean, logPath: string) =>
  Effect.tryPromise({
    try: async () => {
      const cmd = new Deno.Command(follow ? "tail" : "cat", {
        args: [
          ...(follow ? ["-n", "100", "-f"] : []),
          logPath,
        ],
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });

      const status = await cmd.spawn().status;
      return { name, status };
    },
    catch: (error) => new CommandError({ cause: error }),
  }).pipe(
    Effect.flatMap(({ name, status }) =>
      status.success ? Effect.succeed(undefined) : Effect.fail(
        new LogCommandError({
          vmName: name,
          exitCode: status.code || 1,
        }),
      )
    ),
  );

const handleError = (error: LogCommandError | CommandError | Error) =>
  Effect.sync(() => {
    if (error instanceof LogCommandError) {
      console.error(`Failed to view logs for virtual machine ${error.vmName}.`);
      Deno.exit(error.exitCode);
    } else {
      console.error(`An error occurred: ${error}`);
      Deno.exit(1);
    }
  });

const logsEffect = (name: string, follow: boolean) =>
  pipe(
    createLogsDir(),
    Effect.flatMap(() => buildLogPath(name)),
    Effect.flatMap((logPath) => viewLogs(name, follow, logPath)),
    Effect.catchAll(handleError),
  );

export default async function (name: string, follow: boolean) {
  await Effect.runPromise(logsEffect(name, follow));
}
