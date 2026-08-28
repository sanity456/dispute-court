import migration from "./postgres-schema.sql?raw";
import { createPostgresDatabase } from "./postgres-database";
import { schemaStatements } from "./schema-statements";
import type { Database } from "./database-types";
let database: Database | undefined;
export function binding(): Database {
  if (!database) {
    const connection = process.env.DATABASE_URL;
    if (!connection)
      throw new Error(
        "Durable storage is unavailable. No transaction has been sent.",
      );
    const db = createPostgresDatabase(connection);
    database = {
      ...db,
      async initialize() {
        // An advisory transaction lock serializes concurrent serverless cold starts.
        await db.batch([
          db.prepare("SELECT pg_advisory_xact_lock(619990028)"),
          ...schemaStatements(migration).map((sql) => db.prepare(sql)),
        ]);
      },
    };
  }
  return database;
}
