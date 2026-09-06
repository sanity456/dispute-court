import type { Database } from "./database-types";
import { schemaStatements } from "./schema-statements.ts";

export function releaseDataSchema(product: string, address: string): string {
  if (
    !["commitment-pools", "dispute-court"].includes(product) ||
    !/^0x[0-9a-fA-F]{40}$/.test(address) ||
    /^0x0{40}$/i.test(address)
  )
    throw new Error("Invalid release database binding.");
  return (
    "v4_" + product.replaceAll("-", "_") + "_" + address.slice(2).toLowerCase()
  );
}

export function isIsolatedDatabaseSchema(schema: string): boolean {
  return (
    /^verification_[a-f0-9]{32}$/.test(schema) ||
    (/^v4_(commitment_pools|dispute_court)_[a-f0-9]{40}$/.test(schema) &&
      !/_0{40}$/.test(schema))
  );
}

export async function initializeReleaseData(
  db: Database,
  schema: string,
  migration: string,
): Promise<void> {
  if (!schema.startsWith("v4_") || !isIsolatedDatabaseSchema(schema))
    throw new Error("Invalid release database binding.");
  // Scoped adapter uses SET LOCAL for this whole transaction, including the
  // first cold start when the schema does not exist yet. Never fall back to public.
  await db.batch([
    db.prepare("SELECT pg_advisory_xact_lock(619990028)"),
    db.prepare('CREATE SCHEMA IF NOT EXISTS "' + schema + '"'),
    ...schemaStatements(migration).map((sql) => db.prepare(sql)),
  ]);
}
