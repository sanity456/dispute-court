import test from "node:test";
import assert from "node:assert/strict";
import { postgresParameters } from "../server/postgres-parameters.ts";
import {
  postgresResult,
  createPostgresDatabase,
} from "../server/postgres-database.ts";
import { jsonField } from "../server/sql-dialect.ts";
import { handleProductRequest } from "../server/api.ts";
import { ApiError } from "../server/security.ts";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

test("The Vercel target cannot change the default Sites build configuration", () => {
  for (const target of ["sites", "vercel"]) {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "const config=(await import('./next.config.ts')).default; console.log(JSON.stringify({keys:Object.keys(config),provider:config.env?.NEXT_PUBLIC_AUTH_PROVIDER}));",
      ],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        env: { ...process.env, PRODUCT_HOSTING_TARGET: target },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    if (target === "sites") assert.deepEqual(config.keys, []);
    else {
      assert.equal(config.provider, "neon");
      const hosting = JSON.parse(
        readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
      );
      assert.equal(hosting.outputDirectory, ".next-vercel");
    }
  }
});

test("Missing host authentication fails closed instead of trusting request headers", async () => {
  const response = await handleProductRequest(
    new Request("https://product.test/api/product/session", {
      headers: { "oai-authenticated-user-id": "forged" },
    }),
    {},
    {},
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "auth_unavailable");
});

test("Postgres parameter markers never replace quoted values, comments or dollar strings", () => {
  const source =
    "SELECT ?, '?', 'it''s ?', \"?\", $$?$$, $tag$?$tag$ /* ? */ -- ?\n, ?";
  const result = postgresParameters(source);
  assert.equal(result.count, 2);
  assert.equal(
    result.sql,
    source.replace("SELECT ?", "SELECT $1").replace("\n, ?", "\n, $2"),
  );
  assert.throws(
    () => postgresParameters("SELECT 'unterminated ?"),
    /Unterminated/,
  );
  assert.throws(() => postgresParameters("SELECT /* ?"), /Unterminated/);
  assert.throws(() => postgresParameters("SELECT $tag$ ?"), /Unterminated/);
});

test("Postgres bigint columns preserve safe timestamps but never silently round integers", () => {
  const fields = [
    { name: "at", dataTypeID: 20 },
    { name: "amount", dataTypeID: 25 },
  ];
  assert.deepEqual(
    postgresResult({
      rows: [{ at: "1780000000123", amount: "999999999999999999999" }],
      rowCount: 1,
      fields,
    }),
    {
      results: [{ at: 1780000000123, amount: "999999999999999999999" }],
      success: true,
      meta: { changes: 1 },
    },
  );
  assert.throws(
    () =>
      postgresResult({
        rows: [{ at: "9007199254740993" }],
        rowCount: 1,
        fields,
      }),
    /safe range/,
  );
  assert.equal(
    postgresResult({ rows: [{ at: null }], rowCount: 1, fields }).results[0].at,
    null,
  );
});

const connection =
  "postgresql://fixture:fixture@ep-fixture.us-east-1.aws.neon.tech/neondb";
test("Malformed bindings fail before network access; batches cannot mix database instances", async () => {
  const first = createPostgresDatabase(connection),
    second = createPostgresDatabase(connection);
  await assert.rejects(first.prepare("SELECT ?").all(), /parameter count/);
  await assert.rejects(
    first.batch([second.prepare("SELECT 1")]),
    /mix database/,
  );
  assert.deepEqual(await first.batch([]), []);
});

test("Verification schemas and database destinations are constrained", () => {
  assert.throws(
    () => createPostgresDatabase("postgresql://a:b@attacker.example/db"),
    /Neon/,
  );
  assert.throws(
    () => createPostgresDatabase(connection, "public"),
    /verification/,
  );
  assert.throws(
    () =>
      createPostgresDatabase(
        connection,
        'verification_x";DROP SCHEMA public;--',
      ),
    /verification/,
  );
});

test("JSON queries use the correct database dialect and retain numeric arithmetic", () => {
  assert.equal(
    jsonField({}, "m.json", "status"),
    "json_extract(m.json,'$.status')",
  );
  assert.equal(
    jsonField({ dialect: "postgres" }, "m.json", "status"),
    "((m.json)::jsonb ->> 'status')",
  );
  assert.equal(
    jsonField(
      { dialect: "postgres" },
      "COALESCE(r.detail_json,r.json)",
      "round_window_seconds",
      true,
    ),
    "CAST(((COALESCE(r.detail_json,r.json))::jsonb ->> 'round_window_seconds') AS numeric)",
  );
});

test("A rejected host identity can never fall back to spoofed Sites headers", async () => {
  const request = new Request("https://product.test/api/product/session", {
    headers: {
      "oai-authenticated-user-id": "forged-owner",
      "oai-authenticated-user-email": "forged@example.invalid",
    },
  });
  const response = await handleProductRequest(request, {}, {}, () => {
    throw new ApiError(401, "Sign in first.", "sign_in_required");
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "sign_in_required");
});
