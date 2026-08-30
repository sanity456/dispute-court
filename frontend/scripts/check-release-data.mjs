// Initializes only this product's verified v3 namespace. Never migrates or deletes legacy data.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { neon } from "@neondatabase/serverless";
import { createPostgresDatabase } from "../server/postgres-database.ts";
import {
  initializeReleaseData,
  releaseDataSchema,
} from "../server/release-data.ts";
import { product } from "../lib/product.ts";

loadEnvFile(".env.local");
const projects = {
  "commitment-pools": "round-pond-96628981",
  "dispute-court": "lively-boat-81694619",
};
assert.equal(
  process.env.NEON_PROJECT_ID,
  projects[product.id],
  "Refusing an unrelated database",
);
const manifest = JSON.parse(
  readFileSync(new URL("../lib/deployment.json", import.meta.url), "utf8"),
);
assert.equal(manifest.protocolVersion, 3);
assert.equal(manifest.chainId, 61999);
assert.equal(manifest.rpcUrl, "https://studio.genlayer.com/api");
const schema = releaseDataSchema(product.id, manifest.contractAddress);
const admin = neon(process.env.DATABASE_URL);
async function counts(namespace) {
  const tables = await admin.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name",
    [namespace],
  );
  for (const { table_name } of tables) assert.match(table_name, /^[a-z_]+$/);
  if (!tables.length) return {};
  const results = await admin.transaction(
    tables.map(({ table_name }) =>
      admin.query(
        'SELECT count(*)::text AS count FROM "' +
          namespace +
          '"."' +
          table_name +
          '"',
      ),
    ),
    { readOnly: true },
  );
  return Object.fromEntries(
    tables.map(({ table_name }, index) => [
      table_name,
      results[index][0].count,
    ]),
  );
}
const legacyBefore = await counts("public");
const db = createPostgresDatabase(process.env.DATABASE_URL, schema);
const migration = readFileSync(
  new URL("../server/postgres-schema.sql", import.meta.url),
  "utf8",
);
await initializeReleaseData(db, schema, migration);
await initializeReleaseData(db, schema, migration);
assert.equal(
  await db.prepare("SELECT current_schema() AS name").first("name"),
  schema,
);
const marker = "release-verification-" + crypto.randomUUID();
const result = await db.batch([
  db
    .prepare("INSERT INTO preferences(user_id,json,updated_at) VALUES(?,?,?)")
    .bind(marker, "{}", Date.now()),
  db.prepare("SELECT user_id FROM preferences WHERE user_id=?").bind(marker),
  db.prepare("DELETE FROM preferences WHERE user_id=?").bind(marker),
]);
assert.equal(result[1].results[0].user_id, marker);
assert.equal(
  await db
    .prepare("SELECT user_id FROM preferences WHERE user_id=?")
    .bind(marker)
    .first(),
  null,
);
assert.deepEqual(
  await counts("public"),
  legacyBefore,
  "Legacy counts changed; investigate before release",
);
const releaseCounts = await counts(schema);
assert.ok(Object.hasOwn(releaseCounts, "wallet_sessions"));
assert.ok(Object.hasOwn(releaseCounts, "records"));
console.log(
  JSON.stringify({
    product: product.id,
    schema,
    passed: true,
    legacyCountsUnchanged: true,
    checks: [
      "scoped cold start",
      "idempotent migration",
      "scoped atomic read/write",
      "fixture removed",
      "legacy rows preserved",
    ],
    tables: Object.keys(releaseCounts).length,
    releaseCounts,
  }),
);
