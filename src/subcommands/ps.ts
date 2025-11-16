import { Table } from "@cliffy/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import utc from "dayjs/plugin/utc.js";
import { Data, Effect, pipe } from "effect";
import { ctx } from "../context.ts";
import type { VirtualMachine } from "../db.ts";

dayjs.extend(relativeTime);
dayjs.extend(utc);

class DbQueryError extends Data.TaggedError("DbQueryError")<{
  cause?: unknown;
}> {}

const fetchVMs = (all: boolean) =>
  Effect.tryPromise({
    try: () =>
      ctx.db.selectFrom("virtual_machines")
        .selectAll()
        .where((eb) => {
          if (all) {
            return eb("id", "!=", "");
          }
          return eb("status", "=", "RUNNING");
        })
        .execute(),
    catch: (error) => new DbQueryError({ cause: error }),
  });

const createTable = () =>
  Effect.succeed(
    new Table(
      ["NAME", "VCPU", "MEMORY", "STATUS", "PID", "BRIDGE", "PORTS", "CREATED"],
    ),
  );

const populateTable = (table: Table, vms: VirtualMachine[]) =>
  Effect.sync(() => {
    for (const vm of vms) {
      table.push([
        vm.name,
        vm.cpus.toString(),
        vm.memory,
        formatStatus(vm),
        vm.pid?.toString() ?? "-",
        vm.bridge ?? "-",
        formatPorts(vm.portForward),
        dayjs.utc(vm.createdAt).local().fromNow(),
      ]);
    }
    return table;
  });

const displayTable = (table: Table) =>
  Effect.sync(() => {
    console.log(table.padding(2).toString());
  });

const handleError = (error: DbQueryError | Error) =>
  Effect.sync(() => {
    console.error(`Failed to fetch virtual machines: ${error}`);
    Deno.exit(1);
  });

const psEffect = (all: boolean) =>
  pipe(
    Effect.all([fetchVMs(all), createTable()]),
    Effect.flatMap(([vms, table]) => populateTable(table, vms)),
    Effect.flatMap(displayTable),
    Effect.catchAll(handleError),
  );

export default async function (all: boolean) {
  await Effect.runPromise(psEffect(all));
}

function formatStatus(vm: VirtualMachine) {
  switch (vm.status) {
    case "RUNNING":
      return `Up ${
        dayjs.utc(vm.updatedAt).local().fromNow().replace("ago", "")
      }`;
    case "STOPPED":
      return `Exited ${dayjs.utc(vm.updatedAt).local().fromNow()}`;
    default:
      return vm.status;
  }
}

function formatPorts(portForward?: string) {
  if (!portForward) {
    return "-";
  }

  const mappings = portForward.split(",");
  return mappings.map((mapping) => {
    const [hostPort, guestPort] = mapping.split(":");
    return `${hostPort}->${guestPort}`;
  }).join(", ");
}
