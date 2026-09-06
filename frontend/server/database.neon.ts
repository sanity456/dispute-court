import migration from "./postgres-schema.sql?raw";
import { createPostgresDatabase } from "./postgres-database";
import type { Database } from "./database-types";
import deployment from "../lib/deployment.json";
import { product } from "../lib/product.ts";
import { releaseDataSchema, initializeReleaseData } from "./release-data.ts";
let database: Database | undefined;
export function binding(): Database {
  if (!database) {
    const connection = process.env.DATABASE_URL;
    if (!connection)
      throw new Error(
        "Durable storage is unavailable. No transaction has been sent.",
      );
    if ((deployment as { protocolVersion?: number }).protocolVersion !== 4)
      throw new Error("A verified v4 deployment is required for this release.");
    const schema = releaseDataSchema(product.id, deployment.contractAddress);
    const db = createPostgresDatabase(connection, schema);
    database = {
      ...db,
      async initialize() {
        await initializeReleaseData(db, schema, migration);
      },
    };
  }
  return database;
}
