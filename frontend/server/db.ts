import { binding } from "@product/database";
import migration from "../drizzle/0000_product_base.sql?raw";
import argsMigration from "../drizzle/0001_transaction_args.sql?raw";
import walletMigration from "../drizzle/0002_wallet_auth.sql?raw";
import { schemaStatements } from "./schema-statements.ts";
import type { Database } from "./database-types";
import { releaseById } from "../lib/releases.ts";
const databases = new Map<string, Promise<Database>>();
export async function getDb(releaseId = "v4"): Promise<Database> {
  releaseById(releaseId);
  const existing = databases.get(releaseId);
  if (existing) return existing;
  const initialized = (async () => {
    const db = binding(releaseId);
    if (db.initialize) {
      await db.initialize();
      return db;
    }
    await db.batch(
      schemaStatements(migration).map((statement) => db.prepare(statement)),
    );
    const columns = await db
      .prepare("PRAGMA table_info(transactions)")
      .all<{ name: string }>();
    if (!columns.results.some((column) => column.name === "args_json"))
      await db.batch(
        schemaStatements(argsMigration).map((statement) =>
          db.prepare(statement),
        ),
      );
    await db.batch(
      schemaStatements(walletMigration).map((statement) =>
        db.prepare(statement),
      ),
    );
    return db;
  })().catch((error) => {
    databases.delete(releaseId);
    throw error;
  });
  databases.set(releaseId, initialized);
  return initialized;
}
