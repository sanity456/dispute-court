import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { neonConfig } from "@neondatabase/serverless";
import { createPostgresDatabase } from "../server/postgres-database.ts";
import {
  initializeReleaseData,
  isIsolatedDatabaseSchema,
  releaseDataSchema,
} from "../server/release-data.ts";
import { product } from "../lib/product.ts";

const address = "0x" + "Ab".repeat(20);
const schema = releaseDataSchema(product.id, address);
const connection =
  "postgresql://fixture:fixture@ep-fixture.us-east-1.aws.neon.tech/neondb";

test("Release storage is deterministic, product-specific and contract-specific", () => {
  assert.equal(schema, releaseDataSchema(product.id, address.toLowerCase()));
  assert.ok(schema.length < 63);
  assert.notEqual(
    releaseDataSchema("commitment-pools", address),
    releaseDataSchema("dispute-court", address),
  );
  assert.notEqual(
    schema,
    releaseDataSchema(product.id, "0x" + "cd".repeat(20)),
  );
  assert.equal(isIsolatedDatabaseSchema(schema), true);
});

test("Invalid release bindings and unscoped schema names fail closed before I/O", () => {
  for (const invalid of [
    "",
    "0x1234",
    "0x" + "00".repeat(20),
    address + '"',
    null,
  ])
    assert.throws(
      () => releaseDataSchema(product.id, invalid),
      /Invalid release/,
    );
  assert.throws(
    () => releaseDataSchema("another-product", address),
    /Invalid release/,
  );
  for (const invalid of [
    "",
    "public",
    "v3_public",
    schema + '"; DROP SCHEMA public;--',
    schema.toUpperCase(),
    "v3_" + product.id.replaceAll("-", "_") + "_" + "0".repeat(40),
  ])
    assert.throws(
      () => createPostgresDatabase(connection, invalid),
      /isolated/,
    );
  assert.equal(
    isIsolatedDatabaseSchema("verification_" + "ab".repeat(16)),
    true,
  );
});

function withTransport(run) {
  const calls = [];
  const previous = neonConfig.fetchFunction;
  neonConfig.fetchFunction = async (_url, options) => {
    const payload = JSON.parse(options.body);
    calls.push(payload);
    assert.ok(
      Array.isArray(payload.queries),
      "All release operations must be scoped transactions",
    );
    return Response.json({
      results: payload.queries.map(() => ({
        fields: [{ name: "value", dataTypeID: 23 }],
        rows: [["1"]],
        rowCount: 1,
        command: "SELECT",
      })),
    });
  };
  return Promise.resolve()
    .then(() => run(calls))
    .finally(() => {
      neonConfig.fetchFunction = previous;
    });
}

test("Every read, write and batch pins the release search_path in the same transaction", async () => {
  await withTransport(async (calls) => {
    const db = createPostgresDatabase(connection, schema);
    assert.equal(
      await db.prepare("SELECT ? AS value").bind(1).first("value"),
      1,
    );
    await db.prepare("UPDATE preferences SET updated_at=?").bind(2).run();
    const result = await db.batch([
      db.prepare("SELECT 1"),
      db.prepare("SELECT 2"),
    ]);
    assert.equal(result.length, 2);
    assert.equal(calls.length, 3);
    for (const payload of calls)
      assert.equal(
        payload.queries[0].query,
        'SET LOCAL search_path TO "' + schema + '"',
      );
    assert.equal(calls[0].queries[1].query, "SELECT $1 AS value");
    assert.deepEqual(calls[0].queries[1].params, ["1"]);
    const other = createPostgresDatabase(
      connection,
      releaseDataSchema(product.id, "0x" + "cd".repeat(20)),
    );
    await assert.rejects(db.batch([other.prepare("SELECT 1")]), /mix database/);
    assert.equal(calls.length, 3);
  });
});

test("Cold-start migration is locked, scoped and additive; invalid schemas cannot initialize", async () => {
  await withTransport(async (calls) => {
    const db = createPostgresDatabase(connection, schema);
    await initializeReleaseData(
      db,
      schema,
      "CREATE TABLE preferences (id text);",
    );
    assert.deepEqual(
      calls[0].queries.map((item) => item.query),
      [
        'SET LOCAL search_path TO "' + schema + '"',
        "SELECT pg_advisory_xact_lock(619990028)",
        'CREATE SCHEMA IF NOT EXISTS "' + schema + '"',
        "CREATE TABLE IF NOT EXISTS preferences (id text);",
      ],
    );
    await assert.rejects(
      initializeReleaseData(db, "public", "SELECT 1"),
      /Invalid release/,
    );
    assert.equal(calls.length, 1);
  });
});

test("Browser and server share the verified manifest, and archived deployments remain distinct", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  for (const name of ["deployment", "evidence-deployment"]) {
    const current = JSON.parse(read("../lib/" + name + ".json"));
    const archive = JSON.parse(read("../lib/" + name + "-v2.json"));
    assert.equal(current.protocolVersion, 3);
    assert.equal(current.chainId, 61999);
    assert.match(current.sourceSha256, /^[a-f0-9]{64}$/);
    assert.notEqual(
      current.contractAddress.toLowerCase(),
      archive.contractAddress.toLowerCase(),
    );
    assert.notEqual(
      current.deploymentTransaction,
      archive.deploymentTransaction,
    );
  }
  assert.doesNotMatch(
    read("../lib/genlayer.ts"),
    /process\.env\.NEXT_PUBLIC_(GENLAYER_RPC_URL|COMMITMENT_POOL_ADDRESS|DISPUTE_COURT_ADDRESS)/,
  );
  assert.match(
    read("../server/database.neon.ts"),
    /releaseDataSchema\(product.id, deployment.contractAddress\)/,
  );
  assert.match(
    read("../server/database.neon.ts"),
    /initializeReleaseData\(db, schema, migration\)/,
  );
});
