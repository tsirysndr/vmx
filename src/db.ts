import { Database as Sqlite } from "@db/sqlite";
import { DenoSqlite3Dialect } from "@soapbox/kysely-deno-sqlite";
import { Kysely } from "kysely";
import { CONFIG_DIR } from "./constants.ts";
import type { STATUS } from "./types.ts";

export const createDb = (location: string): Database => {
  Deno.mkdirSync(CONFIG_DIR, { recursive: true });
  return new Kysely<DatabaseSchema>({
    dialect: new DenoSqlite3Dialect({
      database: new Sqlite(location),
    }),
  });
};

export type DatabaseSchema = {
  virtual_machines: VirtualMachine;
  images: Image;
  volumes: Volume;
};

export type VirtualMachine = {
  id: string;
  name: string;
  bridge?: string;
  macAddress: string;
  memory: string;
  cpus: number;
  cpu: string;
  diskSize: string;
  drivePath?: string;
  diskFormat: string;
  isoPath?: string;
  portForward?: string;
  version: string;
  status: STATUS;
  pid: number;
  volume?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Image = {
  id: string;
  repository: string;
  tag: string;
  size: number;
  path: string;
  format: string;
  digest?: string;
  createdAt?: string;
};

export type Volume = {
  id: string;
  name: string;
  baseImageId: string;
  path: string;
  size?: string;
  createdAt?: string;
};

export type Database = Kysely<DatabaseSchema>;
