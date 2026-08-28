import { binding } from "@product/database";
import migration from "../drizzle/0000_product_base.sql?raw";
import argsMigration from "../drizzle/0001_transaction_args.sql?raw";
import walletMigration from "../drizzle/0002_wallet_auth.sql?raw";
import { schemaStatements } from "./schema-statements.ts";
import type { Database } from "./database-types";
let initialized: Promise<Database> | undefined;
export async function getDb(): Promise<Database> {
  initialized ??= (async () => {
    const db = binding();
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
    initialized = undefined;
    throw error;
  });
  return initialized;
}
