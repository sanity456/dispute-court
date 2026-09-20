import test from "node:test";
import assert from "node:assert/strict";
import {
  currentRelease,
  legacyRelease,
  releaseById,
  validateRelease,
  recordPath,
  buildReleaseRegistry,
} from "../lib/releases.ts";
import { createNetwork } from "../server/network.ts";
import { requireSecurityRelease } from "../server/release.ts";
import { releaseDataSchema } from "../server/release-data.ts";
import { initializeClientRelease } from "../lib/client-release.ts";
import { productApi } from "../lib/client.ts";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createLocalDatabase } from "../server/database.local.ts";
import { schemaStatements } from "../server/schema-statements.ts";
import { reserveIntent, ownIntent, listActivity } from "../server/journal.ts";

function candidate() {
  const next = structuredClone(legacyRelease);
  next.id = "v5";
  next.core.protocolVersion = next.helper.protocolVersion = 5;
  next.core.contractAddress = "0x" + "55".repeat(20);
  next.helper.contractAddress = "0x" + "66".repeat(20);
  return next;
}
test("activation requires retained manifests; rollback retains both funded releases", () => {
  const next = candidate();
  assert.throws(() => buildReleaseRegistry(next, []));
  assert.deepEqual(
    buildReleaseRegistry(next, [next]).map((release) => release.id),
    ["v5", "v4"],
  );
  assert.deepEqual(
    buildReleaseRegistry(legacyRelease, [next]).map((release) => release.id),
    ["v4", "v5"],
  );
  assert.throws(() => buildReleaseRegistry(next, [next, next]));
  const changed = structuredClone(next);
  changed.core.sourceSha256 = "b".repeat(64);
  assert.throws(() => buildReleaseRegistry(changed, [next]));
});
test("accepted v4 identity and unversioned record links remain pinned; undeployed v5 is unavailable", () => {
  assert.equal(
    legacyRelease.core.contractAddress,
    "0xC49ED63ddc1685850aAF5d5e85986c1bCedBe8b5",
  );
  assert.equal(
    legacyRelease.core.sourceSha256,
    "be5138c48da9360e853a4bc4923fd7cab64615b13c2b8d6a8ab91b0bd9baade9",
  );
  assert.equal(currentRelease.id, "v4");
  for (const [filename, manifest] of [
    ["dispute_court_v4.py", legacyRelease.core],
    ["evidence_capture_v4.py", legacyRelease.helper],
  ])
    assert.equal(
      createHash("sha256")
        .update(
          readFileSync(new URL("../../contracts/" + filename, import.meta.url)),
        )
        .digest("hex"),
      manifest.sourceSha256,
    );
  assert.equal(releaseById("v4"), legacyRelease);
  assert.equal(recordPath("same case"), "/agreements/same%20case?release=v4");
  for (const invalid of ["v5", "v3", "../v4", "", "0x" + "11".repeat(20)])
    assert.throws(() => releaseById(invalid));
});
test("release manifests fail closed before arbitrary addresses, endpoints or versions reach a client", () => {
  for (const change of [
    (r) => {
      r.core.rpcUrl = "https://evil.example/";
    },
    (r) => {
      r.core.chainId = 1;
    },
    (r) => {
      r.helper.protocolVersion = 4;
    },
    (r) => {
      r.core.sourceSha256 = "";
    },
    (r) => {
      r.core.contractAddress = "0x" + "0".repeat(40);
    },
    (r) => {
      r.helper.contractAddress = r.core.contractAddress;
    },
  ]) {
    const r = candidate();
    change(r);
    assert.throws(() => validateRelease(r));
  }
});
test("network allowlists, read targets and durable schemas are isolated by core", async () => {
  const v4 = createNetwork({}),
    v5Release = candidate(),
    v5 = createNetwork({}, v5Release);
  assert.equal(v4.protocolVersion, 4);
  assert.equal(v5.protocolVersion, 5);
  assert.equal(v4.methods(v4.coreAddress).propose_settlement, undefined);
  assert.equal(v5.methods(v5.coreAddress).propose_settlement.readonly, false);
  assert.throws(() => v5.methods(v4.coreAddress));
  assert.throws(() => v4.methods(v5.captureAddress));
  await assert.rejects(v5.read("get_agreement", ["same-id"], v4.coreAddress));
  assert.notEqual(
    releaseDataSchema("dispute-court", v4.coreAddress),
    releaseDataSchema("dispute-court", v5.coreAddress),
  );
});
test("security checks use the selected release and reject cross-version or cross-core helpers", async () => {
  const release = candidate(),
    core = release.core.contractAddress.toLowerCase(),
    helper = release.helper.contractAddress.toLowerCase();
  const network = {
    coreAddress: core,
    protocolVersion: 5,
    read: async (_method, _args, target = core) => ({
      protocol_version: 5,
      max_source_bytes: 6000,
      ...(target === helper ? { product_contract: core } : {}),
    }),
  };
  await requireSecurityRelease(network, core, "propose_settlement");
  await requireSecurityRelease(network, helper, "capture");
  await assert.rejects(
    requireSecurityRelease(
      { ...network, protocolVersion: 4 },
      core,
      "propose_settlement",
    ),
  );
  await assert.rejects(
    requireSecurityRelease(
      {
        ...network,
        read: async () => ({
          protocol_version: 5,
          max_source_bytes: 6000,
          product_contract: legacyRelease.core.contractAddress,
        }),
      },
      helper,
      "capture",
    ),
  );
  await requireSecurityRelease(
    {
      ...network,
      read: async () => {
        throw new Error("unavailable");
      },
    },
    core,
    "withdraw",
  );
});
test("product requests include the immutable document release selection", async () => {
  initializeClientRelease("v4");
  assert.throws(() => initializeClientRelease("v5"));
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers["X-Product-Release"], "v4");
      return Response.json({ value: "scoped" });
    };
    assert.deepEqual(await productApi("read", { method: "get_config" }), {
      value: "scoped",
    });
  } finally {
    globalThis.fetch = previous;
  }
});

test("same wallet and case ID keep separate journals and cannot reuse an intent across releases", async (t) => {
  const databases = [
    createLocalDatabase(":memory:"),
    createLocalDatabase(":memory:"),
  ];
  for (const db of databases) {
    t.after(() => db.close());
    for (const filename of [
      "0000_product_base.sql",
      "0001_transaction_args.sql",
      "0002_wallet_auth.sql",
    ])
      await db.batch(
        schemaStatements(
          readFileSync(
            new URL("../drizzle/" + filename, import.meta.url),
            "utf8",
          ),
        ).map((sql) => db.prepare(sql)),
      );
  }
  const wallet = "0x" + "aa".repeat(20),
    user = "wallet:" + wallet;
  const networks = [
    createNetwork(databases[0]),
    createNetwork(databases[1], candidate()),
  ].map((network) => ({
    ...network,
    read: async () => ({
      protocol_version: network.protocolVersion,
      max_source_bytes: 6000,
    }),
  }));
  const input = (network) => ({
    wallet,
    target: network.coreAddress,
    method: "fund_agreement",
    args: ["same-case-id"],
    value: "1000",
    title: "Fund agreement",
  });
  const first = await reserveIntent(
    databases[0],
    networks[0],
    user,
    input(networks[0]),
  );
  const second = await reserveIntent(
    databases[1],
    networks[1],
    user,
    input(networks[1]),
  );
  assert.notEqual(first.id, second.id);
  await assert.rejects(
    reserveIntent(databases[1], networks[1], user, {
      ...input(networks[1]),
      method: "create_agreement",
      value: "0",
      args: [],
    }),
    (error) => error.code === "release_creation_closed",
  );
  assert.equal(
    (await ownIntent(databases[0], user, first.id)).target,
    networks[0].coreAddress,
  );
  await assert.rejects(ownIntent(databases[1], user, first.id));
  await assert.rejects(
    reserveIntent(databases[1], networks[1], user, input(networks[0])),
  );
  const firstActivity = await listActivity(databases[0], user, wallet, 0);
  const secondActivity = await listActivity(databases[1], user, wallet, 0);
  assert.equal(firstActivity.items.length, 1);
  assert.equal(secondActivity.items.length, 1);
  assert.equal(firstActivity.items[0].id, first.id);
  assert.equal(secondActivity.items[0].id, second.id);
});
