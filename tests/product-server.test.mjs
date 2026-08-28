import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLocalDatabase } from "../server/database.local.ts";
import { schemaStatements } from "../server/schema-statements.ts";
import {
  reserveIntent,
  updateIntent,
  ownIntent,
  listActivity,
  importTransaction,
} from "../server/journal.ts";
import { handleProductRequest } from "../server/api.ts";
import {
  observeTransaction,
  transactionCall,
  transactionReturn,
} from "../server/chain-model.ts";
import {
  parseLosslessJson,
  rateLimit,
  bodyJson,
  sameOrigin,
} from "../server/security.ts";
import {
  ownerChallenge,
  completeOwnerChallenge,
  ownerSession,
  logoutOwner,
} from "../server/owner-auth.ts";
import {
  coverage,
  directory,
  readAndIndex,
  recordHistory,
  syncDirectory,
} from "../server/directory.ts";
import { addSupport, supportList } from "../server/support.ts";
import { savePreferences, getPreferences } from "../server/preferences.ts";
import { cleanExpiredTransientRows } from "../server/maintenance.ts";
import { abi, createAccount } from "../vendor/genlayer-js/index.js";
import { product } from "../lib/product.ts";
const deployment = JSON.parse(
  readFileSync(new URL("../lib/deployment.json", import.meta.url), "utf8"),
);
const captureDeployment = JSON.parse(
  readFileSync(
    new URL("../lib/evidence-deployment.json", import.meta.url),
    "utf8",
  ),
);
const schema = JSON.parse(
  readFileSync(new URL("../lib/contract-schema.json", import.meta.url), "utf8"),
);
const core = deployment.contractAddress.toLowerCase(),
  capture = captureDeployment.contractAddress.toLowerCase();
const wallet = "0x" + "11".repeat(20),
  other = "0x" + "22".repeat(20),
  hash = "0x" + "ab".repeat(32),
  hash2 = "0x" + "cd".repeat(32),
  childHash = "0x" + "ef".repeat(32);
const pay = product.id === "commitment-pools" ? "join" : "fund_agreement";
async function database(t) {
  const db = createLocalDatabase(":memory:");
  for (const file of ["0000_product_base.sql", "0001_transaction_args.sql"]) {
    const sql = readFileSync(
      new URL("../drizzle/" + file, import.meta.url),
      "utf8",
    );
    await db.batch(schemaStatements(sql).map((s) => db.prepare(s)));
  }
  t.after(() => db.close());
  return db;
}
function network(transactions = new Map()) {
  return {
    coreAddress: core,
    captureAddress: capture,
    ownerAddress: deployment.ownerAddress.toLowerCase(),
    methods(target) {
      if (target.toLowerCase() === core) return schema.methods;
      if (target.toLowerCase() === capture)
        return {
          capture: { readonly: false, params: ["url", "nonce"] },
          get_capture: { readonly: true, params: ["wallet", "nonce"] },
        };
      throw new Error("wrong target");
    },
    read: async () => ({}),
    transaction: async (h) => transactions.get(h) ?? null,
    invalidate: async () => {},
  };
}
function input(method = pay, args = ["record"], value = "1000") {
  return { wallet, target: core, method, args, value, title: "Test action" };
}
function receipt(
  method = pay,
  args = ["record"],
  value = "1000",
  overrides = {},
) {
  const encoded = abi.calldata.encode(
    abi.calldata.makeCalldataObject(method, args, undefined),
  );
  const result = abi.calldata.encode({
    id: "payout-1",
    recipient: wallet,
    amount_wei: "1000",
    status: "emitted_for_finalization",
  });
  return {
    hash,
    from_address: wallet,
    to_address: core,
    value,
    status: "FINALIZED",
    type: 2,
    data: { calldata: Buffer.from(encoded).toString("base64") },
    consensus_data: {
      leader_receipt: [
        {
          execution_result: "SUCCESS",
          result: Buffer.concat([
            Buffer.from([0]),
            Buffer.from(result),
          ]).toString("base64"),
        },
      ],
    },
    triggered_transactions: [],
    ...overrides,
  };
}
function request(path, method = "GET", data, who = "alice", extra = {}) {
  const headers = { "oai-authenticated-user-id": who, ...extra };
  if (method === "POST") {
    headers.Origin = "https://product.test";
    headers["Content-Type"] = "application/json";
  }
  return new Request("https://product.test/api/product/" + path, {
    method,
    headers,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}
test("migrations preserve partial uniqueness and query indexes", async (t) => {
  const db = await database(t);
  const indexes = (
    await db.prepare("SELECT name FROM sqlite_schema WHERE type='index'").all()
  ).results.map((r) => r.name);
  assert.ok(indexes.includes("idx_intents_active_operation"));
  assert.ok(indexes.includes("idx_transactions_record_created"));
  const plan = await db
    .prepare(
      "EXPLAIN QUERY PLAN SELECT * FROM intents WHERE user_id=? ORDER BY created_at DESC",
    )
    .bind("alice")
    .all();
  assert.match(
    plan.results.map((r) => r.detail).join(" "),
    /idx_intents_user_created/,
  );
});
test("concurrent tabs can reserve one active action, with independent user namespaces", async (t) => {
  const db = await database(t),
    net = network();
  const results = await Promise.allSettled([
    reserveIntent(db, net, "alice", input()),
    reserveIntent(db, net, "alice", input()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.status, 409);
  assert.ok(await reserveIntent(db, net, "bob", input()));
  assert.equal((await listActivity(db, "alice", "")).total, 1);
});
test("review state blocks blind retry; only a confirmed unsigned request can close", async (t) => {
  const db = await database(t),
    net = network(),
    saved = await reserveIntent(db, net, "alice", input());
  await updateIntent(db, net, "alice", saved.id, { state: "cancelled" });
  assert.equal((await ownIntent(db, "alice", saved.id)).status, "review");
  await assert.rejects(
    reserveIntent(db, net, "alice", input()),
    (e) => e.status === 409,
  );
  await updateIntent(db, net, "alice", saved.id, {
    state: "cancelled",
    confirmedUnsigned: true,
  });
  assert.equal((await ownIntent(db, "alice", saved.id)).status, "cancelled");
  assert.ok(await reserveIntent(db, net, "alice", input()));
});
test("hash attachment is durable during an RPC outage and cannot be replaced or cancelled", async (t) => {
  const db = await database(t),
    net = network(),
    saved = await reserveIntent(db, net, "alice", input());
  net.transaction = async () => {
    throw new Error("offline");
  };
  await updateIntent(db, net, "alice", saved.id, { hash });
  assert.equal((await ownIntent(db, "alice", saved.id)).tx_hash, hash);
  await assert.rejects(
    updateIntent(db, net, "alice", saved.id, { hash: hash2 }),
    (e) => e.status === 409,
  );
  await assert.rejects(
    updateIntent(db, net, "alice", saved.id, {
      state: "cancelled",
      confirmedUnsigned: true,
    }),
    (e) => e.status === 409,
  );
  await assert.rejects(ownIntent(db, "bob", saved.id), (e) => e.status === 404);
});
test("simultaneous different hashes cannot overwrite an unbound intent", async (t) => {
  const db = await database(t),
    net = network(),
    saved = await reserveIntent(db, net, "alice", input());
  const results = await Promise.allSettled([
    updateIntent(db, net, "alice", saved.id, { hash }),
    updateIntent(db, net, "alice", saved.id, { hash: hash2 }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.status, 409);
  assert.ok(
    [hash, hash2].includes((await ownIntent(db, "alice", saved.id)).tx_hash),
  );
});
test("receipt matching checks sender, target, method, arguments and exact value", async (t) => {
  const db = await database(t),
    map = new Map([[hash, receipt(pay, ["another-record"])]]),
    net = network(map);
  const saved = await reserveIntent(db, net, "alice", input());
  await assert.rejects(
    updateIntent(db, net, "alice", saved.id, { hash }),
    (e) => e.code === "receipt_mismatch",
  );
  assert.equal((await ownIntent(db, "alice", saved.id)).status, "review");
  assert.equal((await ownIntent(db, "alice", saved.id)).tx_hash, hash);
});
test("cached success cannot be borrowed for different arguments", async (t) => {
  const db = await database(t),
    net = network(new Map([[hash, receipt()]]));
  const correct = await reserveIntent(db, net, "alice", input());
  await updateIntent(db, net, "alice", correct.id, { hash });
  assert.equal((await ownIntent(db, "alice", correct.id)).status, "success");
  const wrong = await reserveIntent(
    db,
    net,
    "bob",
    input(pay, ["another-record"]),
  );
  await assert.rejects(
    updateIntent(db, net, "bob", wrong.id, { hash }),
    (e) => e.code === "receipt_mismatch",
  );
  assert.equal((await ownIntent(db, "bob", wrong.id)).status, "review");
});
test("reverts and unknown execution never become success", async (t) => {
  const db = await database(t),
    map = new Map([
      [
        hash,
        receipt(pay, ["record"], "1000", {
          consensus_data: {
            leader_receipt: [{ execution_result: "ERROR", error: "Rejected" }],
          },
        }),
      ],
      [
        hash2,
        receipt(pay, ["record"], "1000", { hash: hash2, consensus_data: {} }),
      ],
    ]),
    net = network(map);
  const saved = await reserveIntent(db, net, "alice", input());
  await updateIntent(db, net, "alice", saved.id, { hash });
  assert.equal((await ownIntent(db, "alice", saved.id)).status, "failed");
  const uncertain = await reserveIntent(db, net, "alice", input());
  await updateIntent(db, net, "alice", uncertain.id, { hash: hash2 });
  assert.equal((await ownIntent(db, "alice", uncertain.id)).status, "review");
});
test("public legacy transaction import is idempotent and scoped to this product", async (t) => {
  const db = await database(t),
    net = network(new Map([[hash, receipt()]]));
  const first = await importTransaction(db, net, "alice", hash),
    second = await importTransaction(db, net, "alice", hash);
  assert.equal(first.id, second.id);
  assert.equal((await listActivity(db, "alice", "")).total, 1);
  assert.equal((await listActivity(db, "bob", "")).total, 0);
});
test("ABI return decoding preserves exact receipt fields and does not parse display text", () => {
  const raw = receipt("withdraw", [], "0");
  assert.equal(transactionCall(raw).method, "withdraw");
  assert.equal(transactionReturn(raw).amount_wei, "1000");
  assert.equal(transactionReturn(raw).recipient, wallet);
});
test("withdrawal success is separate from delivery and mismatched transfers remain unconfirmed", () => {
  const parent = receipt("withdraw", [], "0", {
    triggered_transactions: [childHash],
  });
  const child = {
    hash: childHash,
    type: 0,
    status: "FINALIZED",
    value: "1000",
    value_credited: true,
    from_address: core,
    to_address: wallet,
  };
  assert.equal(observeTransaction(parent, []).payout_state, "pending");
  assert.equal(observeTransaction(parent, [child]).payout_state, "delivered");
  for (const change of [
    { value: "999" },
    { to_address: other },
    { from_address: other },
    { type: 2 },
    { value_credited: false },
  ]) {
    assert.notEqual(
      observeTransaction(parent, [{ ...child, ...change }]).payout_state,
      "delivered",
    );
  }
  assert.equal(
    observeTransaction(parent, [
      { ...child, status: "CANCELED", value_credited: false },
    ]).payout_state,
    "failed",
  );
});
test("large JSON money retains all wei or fails closed", () => {
  const parsed = parseLosslessJson(
    '{"value":1000000000000000001,"small":1000}',
  );
  assert.equal(parsed.value, 1000000000000000001n);
  assert.equal(parsed.small, 1000);
  assert.throws(
    () => parseLosslessJson('{"value":1e30}'),
    /cannot be represented exactly/,
  );
});
test("API requires account identity and same-origin writes; owner routes require proof", async (t) => {
  const db = await database(t),
    net = network();
  assert.equal(
    (
      await handleProductRequest(
        new Request("https://product.test/api/product/activity"),
        db,
        net,
      )
    ).status,
    401,
  );
  const cross = new Request("https://product.test/api/product/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://other.test",
      "oai-authenticated-user-id": "alice",
    },
    body: "{}",
  });
  assert.equal((await handleProductRequest(cross, db, net)).status, 403);
  assert.equal(
    (await handleProductRequest(request("owner/overview"), db, net)).status,
    403,
  );
  assert.equal(
    (
      await handleProductRequest(
        request("owner/support", "POST", {
          id: "x",
          response: "Unauthorized",
          status: "resolved",
        }),
        db,
        net,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleProductRequest(
        request("owner/moderation", "POST", {
          id: "x",
          hidden: true,
          reason: "Unauthorized",
        }),
        db,
        net,
      )
    ).status,
    403,
  );
  assert.equal(
    (await handleProductRequest(request("session"), db, net)).status,
    200,
  );
});
test("JSON parser rejects oversized, invalid and non-object bodies", async () => {
  await assert.rejects(
    bodyJson(
      new Request("https://product.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "x".repeat(32769) }),
      }),
    ),
    (e) => e.status === 413,
  );
  await assert.rejects(
    bodyJson(
      new Request("https://product.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[]",
      }),
    ),
    (e) => e.status === 400,
  );
  assert.throws(
    () => sameOrigin(new Request("https://product.test", { method: "POST" })),
    (e) => e.status === 403,
  );
});
test("owner proof is user-scoped, signature-verified, expiring and one-time", async (t) => {
  const db = await database(t),
    owner = createAccount(),
    imposter = createAccount(),
    ownerAddress = owner.address.toLowerCase();
  const challenge = await ownerChallenge(
    db,
    "alice",
    owner.address,
    "https://product.test",
    ownerAddress,
  );
  assert.match(challenge.message, /does not authorize transfers/);
  await assert.rejects(
    completeOwnerChallenge(
      db,
      "bob",
      challenge.id,
      await owner.signMessage({ message: challenge.message }),
      ownerAddress,
      true,
    ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    completeOwnerChallenge(
      db,
      "alice",
      challenge.id,
      await imposter.signMessage({ message: challenge.message }),
      ownerAddress,
      true,
    ),
    (e) => e.status === 403,
  );
  const cookie = await completeOwnerChallenge(
    db,
    "alice",
    challenge.id,
    await owner.signMessage({ message: challenge.message }),
    ownerAddress,
    true,
  );
  assert.match(cookie, /HttpOnly; SameSite=Strict/);
  assert.match(cookie, /; Secure/);
  await assert.rejects(
    completeOwnerChallenge(
      db,
      "alice",
      challenge.id,
      await owner.signMessage({ message: challenge.message }),
      ownerAddress,
      true,
    ),
    (e) => e.status === 403,
  );
  const req = request("owner/overview", "GET", undefined, "alice", {
    cookie: cookie.split(";")[0],
  });
  assert.equal(await ownerSession(db, req, "alice", ownerAddress), true);
  assert.equal(await ownerSession(db, req, "bob", ownerAddress), false);
  await logoutOwner(db, req, "alice");
  assert.equal(await ownerSession(db, req, "alice", ownerAddress), false);
  const expired = await ownerChallenge(
    db,
    "alice",
    owner.address,
    "https://product.test",
    ownerAddress,
  );
  await db
    .prepare("UPDATE challenges SET expires_at=0 WHERE id=?")
    .bind(expired.id)
    .run();
  await assert.rejects(
    completeOwnerChallenge(
      db,
      "alice",
      expired.id,
      await owner.signMessage({ message: expired.message }),
      ownerAddress,
      true,
    ),
    (e) => e.status === 403,
  );
});
test("preferences and support survive independently and never cross account boundaries", async (t) => {
  const db = await database(t);
  await savePreferences(db, "alice", {
    timezone: "Africa/Lagos",
    reminderMinutes: 15,
    includeFixtures: true,
  });
  assert.equal((await getPreferences(db, "alice")).timezone, "Africa/Lagos");
  assert.equal((await getPreferences(db, "bob")).timezone, "UTC");
  await assert.rejects(
    savePreferences(db, "alice", { timezone: "Not/A_Timezone" }),
    (e) => e.status === 400,
  );
  const ticket = await addSupport(db, "alice", {
    category: "transaction",
    body: "Synthetic local support fixture",
    hash,
  });
  assert.equal((await supportList(db, "alice"))[0].id, ticket.id);
  assert.equal((await supportList(db, "bob")).length, 0);
});
test("directory filtering and explicit coverage do not fabricate completeness", async (t) => {
  const db = await database(t),
    net = network();
  assert.equal((await coverage(db)).complete, false);
  net.read = async () => ({
    total: 3,
    items: [
      {
        id: "public-record",
        title: "A useful record",
        status: "active",
        creator: wallet,
        party_a: wallet,
        party_b: other,
        participant_count: 0,
      },
      {
        id: "lifecycle-test",
        title: "Automated fixture",
        status: "settled",
        creator: wallet,
        party_a: wallet,
        party_b: other,
        participant_count: 0,
      },
      {
        id: "hidden-record",
        title: "Moderated",
        status: "active",
        creator: wallet,
        party_a: wallet,
        party_b: other,
        participant_count: 0,
      },
    ],
  });
  await readAndIndex(db, net, product.listMethod, [0, 50]);
  await db
    .prepare(
      "UPDATE records SET hidden=1,moderation_reason='Test moderation' WHERE id='hidden-record'",
    )
    .run();
  const visible = await directory(db, "", "", "", 0, false);
  assert.deepEqual(
    visible.items.map((r) => r.id),
    ["public-record"],
  );
  assert.equal((await directory(db, "", "", "", 0, true)).total, 2);
  assert.equal((await directory(db, "' OR 1=1 --", "", "", 0, true)).total, 0);
  assert.equal((await recordHistory(db, "hidden-record")).moderation.hidden, 1);
});
test("rate limiting is atomic and expired cleanup preserves user records", async (t) => {
  const db = await database(t);
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, () => rateLimit(db, "test", 2, 60000, 1000)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  await savePreferences(db, "alice", { timezone: "UTC" });
  await db
    .prepare("INSERT INTO read_cache(key,json,expires_at) VALUES('old','{}',0)")
    .run();
  await cleanExpiredTransientRows(db, Date.now());
  assert.equal(
    await db.prepare("SELECT * FROM read_cache WHERE key='old'").first(),
    null,
  );
  assert.equal((await getPreferences(db, "alice")).timezone, "UTC");
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM preferences").first()).n,
    1,
  );
});
test("capture reservations are zero-value and cannot target another product", async (t) => {
  const db = await database(t),
    net = network();
  const saved = await reserveIntent(db, net, "alice", {
    wallet,
    target: capture,
    method: "capture",
    args: ["https://example.com", "one"],
    value: "0",
    title: "Capture",
  });
  assert.equal(saved.method, "capture");
  await assert.rejects(
    reserveIntent(db, net, "bob", {
      wallet,
      target: capture,
      method: "capture",
      args: ["https://example.com", "two"],
      value: "1",
    }),
    (e) => e.status === 400,
  );
});

test("creator summaries never downgrade an indexed participant's role or round progress", async (t) => {
  const db = await database(t),
    net = network();
  net.read = async (method) =>
    method === "list_participants"
      ? {
          total: 1,
          items: [{ address: wallet, status: "active", rounds_passed: 2 }],
        }
      : {
          id: "participant-record",
          title: "A participant who created the pool",
          status: "active",
          creator: wallet,
          participant_count: 1,
        };
  await readAndIndex(db, net, product.detailMethod, ["participant-record"]);
  await readAndIndex(db, net, "list_participants", [
    "participant-record",
    0,
    50,
  ]);
  await readAndIndex(db, net, product.detailMethod, ["participant-record"]);
  const stored = await db
    .prepare("SELECT role,json FROM members WHERE record_id=? AND wallet=?")
    .bind("participant-record", wallet)
    .first();
  assert.equal(stored.role, "participant");
  assert.equal(JSON.parse(stored.json).rounds_passed, 2);
});

test("changed public summaries invalidate old details and do not claim complete coverage", async (t) => {
  const db = await database(t),
    net = network();
  const id = "changing-record";
  net.read = async () => ({
    id,
    title: "Changing",
    status: "active",
    creator: wallet,
    participant_count: 0,
    activity_ends_at: 1,
  });
  await readAndIndex(db, net, product.detailMethod, [id]);
  net.read = async () => ({
    total: 1,
    items: [
      {
        id,
        title: "Changed",
        status: "settled",
        creator: wallet,
        participant_count: 0,
      },
    ],
  });
  await readAndIndex(db, net, product.listMethod, [0, 50]);
  const stored = await db
    .prepare("SELECT detail_json FROM records WHERE id=?")
    .bind(id)
    .first();
  assert.equal(stored.detail_json, null);
  const result = await directory(db, "", "", "", 0, true);
  assert.equal(result.items[0].status, "settled");
  assert.equal(result.items[0].activity_ends_at, undefined);
  assert.equal(result.coverage.complete, false);
});

test("bounded directory sync refreshes stale active details even when the stage did not change", async (t) => {
  const db = await database(t),
    net = network(),
    id = "stale-record";
  const summary = {
    id,
    title: "Still active",
    status: product.id === "commitment-pools" ? "active" : "evidence",
    creator: wallet,
    party_a: wallet,
    party_b: other,
    participant_count: 0,
  };
  let detailReads = 0;
  net.read = async (method) => {
    if (method === product.listMethod) return { total: 1, items: [summary] };
    if (method === "list_participants") return { total: 0, items: [] };
    detailReads++;
    return { ...summary, evidence_count: detailReads };
  };
  await syncDirectory(db, net);
  assert.equal(detailReads, 1);
  assert.equal((await coverage(db)).complete, true);
  await db
    .prepare("UPDATE system_state SET updated_at=0 WHERE key=?")
    .bind("detail:" + id)
    .run();
  await syncDirectory(db, net);
  assert.equal(detailReads, 2);
  assert.equal(
    (await directory(db, "", "", "", 0, true)).items[0].evidence_count,
    2,
  );
});
