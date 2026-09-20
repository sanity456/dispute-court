import migration from "./postgres-schema.sql?raw";
import { createPostgresDatabase } from "./postgres-database";
import type { Database } from "./database-types";
import { releaseById } from "../lib/releases.ts";
import { product } from "../lib/product.ts";
import { releaseDataSchema, initializeReleaseData } from "./release-data.ts";
const databases = new Map<string, Database>();
export function binding(releaseId = "v4"): Database {
  const deployment = releaseById(releaseId).core;
  let database = databases.get(releaseId);
  if (!database) {
    const connection = process.env.DATABASE_URL;
    if (!connection)
      throw new Error(
        "Durable storage is unavailable. No transaction has been sent.",
      );
    const schema = releaseDataSchema(product.id, deployment.contractAddress);
    const db = createPostgresDatabase(connection, schema);
    database = {
      ...db,
      async initialize() {
        await initializeReleaseData(db, schema, migration);
      },
    };
    databases.set(releaseId, database);
  }
  return database;
}
