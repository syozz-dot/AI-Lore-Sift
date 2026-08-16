import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import {
  drizzle as drizzlePostgres,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export type DatabaseDriver = "postgres-js" | "neon-serverless";
export type Database = PostgresJsDatabase<typeof schema>;

type CreateDatabaseOptions = {
  driver?: DatabaseDriver;
};

export function createDatabase(
  databaseUrl = process.env.DATABASE_URL,
  options: CreateDatabaseOptions = {},
) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const driver =
    options.driver ??
    (process.env.DATABASE_DRIVER === "neon-serverless"
      ? "neon-serverless"
      : "postgres-js");

  if (driver === "neon-serverless") {
    const client = new Pool({
      connectionString: databaseUrl,
      max: 1,
    });

    return {
      client,
      // The two Drizzle PostgreSQL drivers expose the same query-builder API.
      // Keep one public type so callers stay independent of the runtime driver.
      db: drizzleNeon(client, { schema }) as unknown as Database,
    };
  }

  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });

  return {
    client,
    db: drizzlePostgres(client, { schema }),
  };
}
