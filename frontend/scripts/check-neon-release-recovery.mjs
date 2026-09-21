// Opt-in real Neon test; all writes are confined to invocation-owned fixtures.
// No live chain requests, signing, raw errors, credentials or session reads.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { neon } from "@neondatabase/serverless";
import { createPostgresDatabase } from "../server/postgres-database.ts";
import {
  initializeReleaseData,
  releaseDataSchema,
} from "../server/release-data.ts";
import { legacyRelease, buildReleaseRegistry } from "../lib/releases.ts";
import { createNetwork } from "../server/network.ts";
import {
  reserveIntent,
  ownIntent,
  updateIntent,
  listActivity,
} from "../server/journal.ts";

async function main() {
  let stage = "preflight",
    admin;
  const owned = [],
    checks = [];
  const report = {
    scope:
      "Real Neon SQL using temporary synthetic release schemas and simulated chain transport. Not deployed Vercel recovery or a real legacy withdrawal.",
    passed: false,
    checks,
    temporarySchemasRemoved: false,
  };
  const output = new URL(
    "../../artifacts/milestone-v1/v5-candidate/neon-release-recovery.json",
    import.meta.url,
  );
  try {
    assert.deepEqual(process.argv.slice(2), ["--execute"]);
    assert.ok(!existsSync(output), "Preserve existing evidence");
    loadEnvFile(".env.local");
    assert.equal(process.env.NEON_PROJECT_ID, "lively-boat-81694619");
    const connection = process.env.DATABASE_URL;
    // Validate the service before creating any database client or schema.
    createPostgresDatabase(connection, "verification_" + "ab".repeat(16));
    admin = neon(connection);
    const query = (sql, args = []) =>
      admin.query(sql, args, {
        fetchOptions: { signal: AbortSignal.timeout(20000) },
      });
    const migration = readFileSync(
      new URL("../server/postgres-schema.sql", import.meta.url),
      "utf8",
    );
    const selectedTables = ["records", "intents", "transactions"];
    const protectedSchemas = [
      "public",
      releaseDataSchema("dispute-court", legacyRelease.core.contractAddress),
      releaseDataSchema(
        "dispute-court",
        "0x369D8f95744C8eaBcF50E8De009Eb162248D1504",
      ),
    ];
    async function protectedCounts() {
      const result = [];
      for (const schema of protectedSchemas) {
        for (const table of selectedTables) {
          const exists = await query(
            "SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2",
            [schema, table],
          );
          const count = exists.length
            ? (
                await query(
                  'SELECT count(*)::text AS count FROM "' +
                    schema +
                    '"."' +
                    table +
                    '"',
                )
              )[0].count
            : null;
          result.push({ schema, table, count });
        }
      }
      return result;
    }
    stage = "protected row counts";
    const before = await protectedCounts();
    const next = structuredClone(legacyRelease);
    next.id = "v5";
    next.core.protocolVersion = next.helper.protocolVersion = 5;
    next.core.contractAddress = "0x" + randomBytes(20).toString("hex");
    next.helper.contractAddress = "0x" + randomBytes(20).toString("hex");
    const fixtures = [structuredClone(legacyRelease), next];
    fixtures[0].core.contractAddress = "0x" + randomBytes(20).toString("hex");
    fixtures[0].helper.contractAddress = "0x" + randomBytes(20).toString("hex");
    const schemas = fixtures.map((r) =>
      releaseDataSchema("dispute-court", r.core.contractAddress),
    );
    const databases = [];
    stage = "isolated initialization";
    for (const schema of schemas) {
      assert.match(schema, /^v4_dispute_court_[a-f0-9]{40}$/);
      assert.ok(!protectedSchemas.includes(schema));
      // CREATE (not IF NOT EXISTS) establishes exclusive ownership for cleanup.
      await query('CREATE SCHEMA "' + schema + '"');
      owned.push(schema);
      const db = createPostgresDatabase(connection, schema);
      databases.push(db);
      await initializeReleaseData(db, schema, migration);
      await initializeReleaseData(db, schema, migration);
      assert.equal(
        await db.prepare("SELECT current_schema() AS name").first("name"),
        schema,
      );
    }
    checks.push(
      "two isolated release schemas; idempotent table initialization",
    );
    stage = "atomic rollback";
    const db = databases[0];
    await assert.rejects(
      db.batch([
        db
          .prepare(
            "INSERT INTO preferences(user_id,json,updated_at) VALUES(?,?,?)",
          )
          .bind("atomic-fixture", "{}", 1),
        db
          .prepare(
            "INSERT INTO preferences(user_id,json,updated_at) VALUES(?,?,?)",
          )
          .bind("atomic-fixture", "{}", 1),
      ]),
    );
    assert.equal(
      await db
        .prepare("SELECT user_id FROM preferences WHERE user_id=?")
        .bind("atomic-fixture")
        .first(),
      null,
    );
    checks.push("failed SQL batch rolls back all writes");
    stage = "same-ID isolation";
    const caseId = "same-release-recovery-fixture",
      wallet = "0x" + "aa".repeat(20),
      user = "wallet:" + wallet;
    for (let i = 0; i < 2; i++) {
      await databases[i]
        .prepare(
          "INSERT INTO records(id,title,status,json,created_at,updated_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(caseId, "fixture-" + i, "funded", "{}", 1, 1)
        .run();
    }
    const networks = databases.map((database, i) => ({
      ...createNetwork(database, fixtures[i]),
      isCurrentRelease: false,
      read: async () => ({
        protocol_version: fixtures[i].core.protocolVersion,
        max_source_bytes: 6000,
      }),
      transaction: async () => {
        throw new Error("Simulated unavailable RPC");
      },
      invalidate: async () => {},
    }));
    const input = (i, method = "fund_agreement") => ({
      wallet,
      target: networks[i].coreAddress,
      method,
      args: method === "withdraw" ? [] : [caseId],
      value: method === "withdraw" ? "0" : "1000",
    });
    const intents = [];
    for (let i = 0; i < 2; i++)
      intents.push(
        await reserveIntent(databases[i], networks[i], user, input(i)),
      );
    await assert.rejects(
      ownIntent(databases[1], user, intents[0].id),
      (e) => e.status === 404,
    );
    await assert.rejects(
      reserveIntent(databases[1], networks[1], user, input(0)),
    );
    checks.push(
      "same wallet and case ID remain isolated; cross-release intents and targets rejected",
    );
    stage = "concurrent scoped reads";
    await Promise.all(
      Array.from({ length: 8 }, async (_, i) => {
        const n = i % 2;
        assert.equal(
          await databases[n]
            .prepare("SELECT title FROM records WHERE id=?")
            .bind(caseId)
            .first("title"),
          "fixture-" + n,
        );
      }),
    );
    await assert.rejects(
      databases[0].batch([databases[1].prepare("SELECT 1")]),
      /mix database/,
    );
    checks.push(
      "concurrent connections preserve scoped search paths; mixed batches rejected",
    );
    stage = "saved hash recovery";
    const fakeHash = "0x" + "77".repeat(32);
    const withdrawal = await reserveIntent(
      databases[1],
      networks[1],
      user,
      input(1, "withdraw"),
    );
    await updateIntent(databases[1], networks[1], user, withdrawal.id, {
      hash: fakeHash,
    });
    // Reconstruct adapters as after a process restart. No chain transaction is sent.
    const restored = schemas.map((schema) =>
      createPostgresDatabase(connection, schema),
    );
    const saved = await ownIntent(restored[1], user, withdrawal.id);
    assert.equal(saved.tx_hash, fakeHash);
    assert.equal(saved.status, "submitted");
    await assert.rejects(
      reserveIntent(restored[1], networks[1], user, input(1, "withdraw")),
      (e) => e.code === "active_intent",
    );
    await assert.rejects(
      updateIntent(restored[1], networks[1], user, withdrawal.id, {
        hash: "0x" + "88".repeat(32),
      }),
      (e) => e.status === 409,
    );
    await assert.rejects(
      ownIntent(restored[0], user, withdrawal.id),
      (e) => e.status === 404,
    );
    checks.push(
      "simulated RPC failure retains withdrawal hash across new connections; duplicate and replacement blocked",
    );
    stage = "rollback selection";
    assert.deepEqual(
      buildReleaseRegistry(next, [next]).map((r) => r.id),
      ["v5", "v4"],
    );
    assert.deepEqual(
      buildReleaseRegistry(legacyRelease, [next]).map((r) => r.id),
      ["v4", "v5"],
    );
    for (const i of [1, 0, 1]) {
      assert.equal(
        await restored[i]
          .prepare("SELECT title FROM records WHERE id=?")
          .bind(caseId)
          .first("title"),
        "fixture-" + i,
      );
      assert.equal(
        (await ownIntent(restored[i], user, intents[i].id)).target,
        networks[i].coreAddress,
      );
    }
    const activity = await listActivity(restored[1], user, wallet, 0);
    assert.ok(
      activity.items.some(
        (item) => item.id === withdrawal.id && item.tx_hash === fakeHash,
      ),
    );
    await assert.rejects(
      reserveIntent(restored[1], networks[1], user, {
        ...input(1),
        method: "create_agreement",
        args: [],
        value: "0",
      }),
      (e) => e.code === "release_creation_closed",
    );
    checks.push(
      "default registry rollback retains both versions; existing recovery stays accessible while new creation is closed",
    );
    stage = "protected row verification";
    assert.deepEqual(await protectedCounts(), before);
    report.protectedRecordJournalTransactionCountsUnchanged = true;
    report.passed = true;
  } catch {
    report.failedStage = stage;
    process.exitCode = 1;
  } finally {
    for (const schema of owned.reverse()) {
      try {
        assert.match(schema, /^v4_dispute_court_[a-f0-9]{40}$/);
        // Exact names were created exclusively by this invocation above.
        await admin.query('DROP SCHEMA "' + schema + '" CASCADE', [], {
          fetchOptions: { signal: AbortSignal.timeout(20000) },
        });
      } catch {
        report.passed = false;
        report.cleanupFailed = true;
        process.exitCode = 1;
      }
    }
    report.temporarySchemasRemoved =
      owned.length === 2 && !report.cleanupFailed;
  }
  report.observedAtUtc = new Date().toISOString();
  if (!existsSync(output))
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
await main();
