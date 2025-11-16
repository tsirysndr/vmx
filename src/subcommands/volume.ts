import { Table } from "@cliffy/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import utc from "dayjs/plugin/utc.js";
import { Effect, pipe } from "effect";
import type { Volume } from "../db.ts";
import type { DbError } from "../mod.ts";
import { deleteVolume, getVolume, listVolumes } from "../volumes.ts";

dayjs.extend(relativeTime);
dayjs.extend(utc);

const createTable = () =>
  Effect.succeed(
    new Table(
      ["NAME", "VOLUME ID", "CREATED"],
    ),
  );

const populateTable = (table: Table, volumes: Volume[]) =>
  Effect.sync(() => {
    for (const volume of volumes) {
      table.push([
        volume.name,
        volume.id,
        dayjs.utc(volume.createdAt).local().fromNow(),
      ]);
    }
    return table;
  });

const displayTable = (table: Table) =>
  Effect.sync(() => {
    console.log(table.padding(2).toString());
  });

const handleError = (error: DbError | Error) =>
  Effect.sync(() => {
    console.error(`Failed to fetch volumes: ${error}`);
    Deno.exit(1);
  });

const lsEffect = () =>
  pipe(
    Effect.all([listVolumes(), createTable()]),
    Effect.flatMap(([volumes, table]) => populateTable(table, volumes)),
    Effect.flatMap(displayTable),
    Effect.catchAll(handleError),
  );

export async function list() {
  await Effect.runPromise(lsEffect());
}

export async function remove(name: string) {
  await Effect.runPromise(
    pipe(
      getVolume(name),
      Effect.flatMap((volume) =>
        volume
          ? deleteVolume(volume.id)
          : Effect.fail(new Error(`Volume with name or ID ${name} not found.`))
      ),
      Effect.tap(() =>
        Effect.sync(() => {
          console.log(`Volume ${name} deleted successfully.`);
        })
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`An error occurred: ${error}`);
          Deno.exit(1);
        })
      ),
    ),
  );
}

export async function inspect(name: string) {
  await Effect.runPromise(
    pipe(
      getVolume(name),
      Effect.flatMap((volume) =>
        volume
          ? Effect.sync(() => {
            console.log(volume);
          })
          : Effect.fail(new Error(`Volume with name or ID ${name} not found.`))
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error(`An error occurred: ${error}`);
          Deno.exit(1);
        })
      ),
    ),
  );
}
