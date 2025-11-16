import {
  type Kysely,
  type Migration,
  type MigrationProvider,
  Migrator,
  sql,
} from "kysely";
import type { Database } from "./db.ts";

const migrations: Record<string, Migration> = {};

const migrationProvider: MigrationProvider = {
  // deno-lint-ignore require-await
  async getMigrations() {
    return migrations;
  },
};

migrations["001"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("virtual_machines")
      .addColumn("id", "varchar", (col) => col.primaryKey())
      .addColumn("name", "varchar", (col) => col.notNull().unique())
      .addColumn("bridge", "varchar")
      .addColumn("macAddress", "varchar", (col) => col.notNull().unique())
      .addColumn("memory", "varchar", (col) => col.notNull())
      .addColumn("cpus", "integer", (col) => col.notNull())
      .addColumn("cpu", "varchar", (col) => col.notNull())
      .addColumn("diskSize", "varchar", (col) => col.notNull())
      .addColumn("drivePath", "varchar")
      .addColumn("version", "varchar", (col) => col.notNull())
      .addColumn("diskFormat", "varchar")
      .addColumn("isoPath", "varchar")
      .addColumn("status", "varchar", (col) => col.notNull())
      .addColumn("pid", "integer")
      .addColumn(
        "createdAt",
        "varchar",
        (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .addColumn(
        "updatedAt",
        "varchar",
        (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("virtual_machines").execute();
  },
};

migrations["002"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("virtual_machines")
      .addColumn("portForward", "varchar")
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("virtual_machines")
      .dropColumn("portForward")
      .execute();
  },
};

migrations["003"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("images")
      .addColumn("id", "varchar", (col) => col.primaryKey())
      .addColumn("repository", "varchar", (col) => col.notNull())
      .addColumn("tag", "varchar", (col) => col.notNull())
      .addColumn("size", "integer", (col) => col.notNull())
      .addColumn("path", "varchar", (col) => col.notNull())
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("images").execute();
  },
};

migrations["004"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("images")
      .addColumn("format", "varchar", (col) => col.notNull().defaultTo("qcow2"))
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("images")
      .dropColumn("format")
      .execute();
  },
};

migrations["005"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("images_new")
      .addColumn("id", "varchar", (col) => col.primaryKey())
      .addColumn("repository", "varchar", (col) => col.notNull())
      .addColumn("tag", "varchar", (col) => col.notNull())
      .addColumn("size", "integer", (col) => col.notNull())
      .addColumn("path", "varchar", (col) => col.notNull())
      .addColumn("format", "varchar", (col) => col.notNull().defaultTo("qcow2"))
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .addUniqueConstraint("images_repository_tag_unique", [
        "repository",
        "tag",
      ])
      .execute();

    await sql`
      INSERT INTO images_new (id, repository, tag, size, path, format, createdAt)
      SELECT id, repository, tag, size, path, format, createdAt FROM images
    `.execute(db);

    await db.schema.dropTable("images").execute();
    await sql`ALTER TABLE images_new RENAME TO images`.execute(db);
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("images_old")
      .addColumn("id", "varchar", (col) => col.primaryKey())
      .addColumn("repository", "varchar", (col) => col.notNull())
      .addColumn("tag", "varchar", (col) => col.notNull())
      .addColumn("size", "integer", (col) => col.notNull())
      .addColumn("path", "varchar", (col) => col.notNull())
      .addColumn("format", "varchar", (col) => col.notNull().defaultTo("qcow2"))
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .execute();

    await sql`
      INSERT INTO images_old (id, repository, tag, size, path, format, createdAt)
      SELECT id, repository, tag, size, path, format, createdAt FROM images
    `.execute(db);

    await db.schema.dropTable("images").execute();
    await sql`ALTER TABLE images_old RENAME TO images`.execute(db);
  },
};

migrations["006"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("images_new")
      .addColumn("id", "varchar", (col) => col.primaryKey())
      .addColumn("repository", "varchar", (col) => col.notNull())
      .addColumn("tag", "varchar", (col) => col.notNull())
      .addColumn("size", "integer", (col) => col.notNull())
      .addColumn("path", "varchar", (col) => col.notNull())
      .addColumn("format", "varchar", (col) => col.notNull().defaultTo("qcow2"))
      .addColumn(
        "createdAt",
        "varchar",
        (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .addUniqueConstraint("images_repository_tag_unique", [
        "repository",
        "tag",
      ])
      .execute();

    await sql`
      INSERT INTO images_new (id, repository, tag, size, path, format, createdAt)
      SELECT id, repository, tag, size, path, format, createdAt FROM images
    `.execute(db);

    await db.schema.dropTable("images").execute();
    await sql`ALTER TABLE images_new RENAME TO images`.execute(db);
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("images_old")
      .addColumn("id", "varchar", (col) => col.primaryKey())
      .addColumn("repository", "varchar", (col) => col.notNull())
      .addColumn("tag", "varchar", (col) => col.notNull())
      .addColumn("size", "integer", (col) => col.notNull())
      .addColumn("path", "varchar", (col) => col.notNull())
      .addColumn("format", "varchar", (col) => col.notNull().defaultTo("qcow2"))
      .addColumn("createdAt", "varchar", (col) => col.notNull())
      .addUniqueConstraint("images_repository_tag_unique", [
        "repository",
        "tag",
      ])
      .execute();

    await sql`
      INSERT INTO images_old (id, repository, tag, size, path, format, createdAt)
      SELECT id, repository, tag, size, path, format, createdAt FROM images
    `.execute(db);
  },
};

migrations["007"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("images")
      .addColumn("digest", "varchar")
      .execute();
  },
  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("images")
      .dropColumn("digest")
      .execute();
  },
};

migrations["008"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("volumes")
      .addColumn("id", "varchar", (col) => col.primaryKey())
      .addColumn("name", "varchar", (col) => col.notNull().unique())
      .addColumn(
        "baseImageId",
        "varchar",
        (col) => col.notNull().references("images.id").onDelete("cascade"),
      )
      .addColumn("path", "varchar", (col) => col.notNull())
      .addColumn(
        "createdAt",
        "varchar",
        (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("volumes").execute();
  },
};

migrations["009"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("volumes_new")
      .addColumn("id", "varchar", (col) => col.primaryKey())
      .addColumn("name", "varchar", (col) => col.notNull().unique())
      .addColumn(
        "baseImageId",
        "varchar",
        (col) => col.notNull().references("images.id").onDelete("cascade"),
      )
      .addColumn("path", "varchar", (col) => col.notNull())
      .addColumn(
        "createdAt",
        "varchar",
        (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute();

    await sql`
      INSERT INTO volumes_new (id, name, baseImageId, path, createdAt)
      SELECT id, name, baseImageId, path, createdAt FROM volumes
    `.execute(db);

    await db.schema.dropTable("volumes").execute();
    await sql`ALTER TABLE volumes_new RENAME TO volumes`.execute(db);
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("volumes").execute();
  },
};

migrations["010"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("virtual_machines")
      .addColumn("volume", "varchar")
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("virtual_machines")
      .dropColumn("volume")
      .execute();
  },
};

export const migrateToLatest = async (db: Database): Promise<void> => {
  const migrator = new Migrator({ db, provider: migrationProvider });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
};
