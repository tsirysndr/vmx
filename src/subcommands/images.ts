import { Table } from "@cliffy/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import utc from "dayjs/plugin/utc.js";
import { Effect, pipe } from "effect";
import type { Image } from "../db.ts";
import { type DbError, listImages } from "../images.ts";
import { humanFileSize } from "../utils.ts";

dayjs.extend(relativeTime);
dayjs.extend(utc);

const createTable = () =>
  Effect.succeed(
    new Table(
      ["REPOSITORY", "TAG", "IMAGE ID", "CREATED", "SIZE"],
    ),
  );

const populateTable = (table: Table, images: Image[]) =>
  Effect.gen(function* () {
    for (const image of images) {
      table.push([
        image.repository,
        image.tag,
        image.id,
        dayjs.utc(image.createdAt).local().fromNow(),
        yield* humanFileSize(image.size),
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
    console.error(`Failed to fetch virtual machines: ${error}`);
    Deno.exit(1);
  });

const lsEffect = () =>
  pipe(
    Effect.all([listImages(), createTable()]),
    Effect.flatMap(([images, table]) => populateTable(table, images)),
    Effect.flatMap(displayTable),
    Effect.catchAll(handleError),
  );

export default async function () {
  await Effect.runPromise(lsEffect());
}
