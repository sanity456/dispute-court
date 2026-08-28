import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { product } from "../lib/product.ts";
const origin = process.env.LOCAL_PRODUCT_ORIGIN;
if (!origin || !/^http:\/\/localhost:417[34]$/.test(origin))
  throw new Error(
    "Set LOCAL_PRODUCT_ORIGIN to this product's explicit localhost:4173 or localhost:4174 preview.",
  );
const deployment = JSON.parse(
  readFileSync(new URL("../lib/deployment.json", import.meta.url), "utf8"),
);
const signIn = await fetch(origin + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
assert.equal(signIn.status, 302);
const cookie = signIn.headers.get("set-cookie")?.split(";")[0];
assert.ok(
  cookie?.startsWith("__sites_local_auth="),
  "Use the provided Sites local test identity, not a production identity.",
);
async function api(path, data) {
  const result = await fetch(origin + "/api/product/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      cookie,
      Origin: origin,
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const value = await result.json();
  if (!result.ok) throw new Error(result.status + " " + JSON.stringify(value));
  return value;
}
assert.equal((await fetch(origin + "/api/product/session")).status, 401);
const session = await api("session");
assert.equal(session.chainId, 61999);
assert.equal(session.coreAddress, deployment.contractAddress.toLowerCase());
const config = await api("read", { method: "get_config", args: [] });
assert.equal(
  config.value.owner.toLowerCase(),
  deployment.ownerAddress.toLowerCase(),
);
const previous = await api("preferences");
await api("preferences", {
  ...previous,
  timezone: "Africa/Lagos",
  reminderMinutes: 15,
});
assert.equal((await api("preferences")).timezone, "Africa/Lagos");
await api("preferences", previous);
const priorHash =
  product.id === "commitment-pools"
    ? "0x23b7044b6df0d3ba98dc4daebdcd00357ef0f5411926ca578ef51f355d3a0c3b"
    : "0x5dd5e6020076e5331d90ed70eb27fb920f79c71cf8cfa310694a1b7522f28855";
const imported = await api("activity/import", { hash: priorHash });
const activity = await api("activity");
const item = activity.items.find((row) => row.id === imported.id);
assert.equal(item.status, "success");
assert.equal(item.transaction.payout_state, "delivered");
const payout = JSON.parse(item.transaction.payout_json);
assert.equal(payout.children.length, 1);
assert.equal(payout.children[0].delivered, true);
assert.equal(
  payout.amount_wei,
  product.id === "commitment-pools" ? "1000" : "980",
);
const intent = await api("intents", {
  wallet: "0x" + "11".repeat(20),
  target: deployment.contractAddress,
  method: product.id === "commitment-pools" ? "join" : "fund_agreement",
  args: ["local-unsigned-test"],
  value: "1",
  title: "Unsigned local recovery test",
});
await api("intents/" + intent.id, {
  state: "cancelled",
  confirmedUnsigned: true,
});
assert.equal(
  (await api("activity")).items.find((row) => row.id === intent.id).status,
  "cancelled",
);
const ticket = await api("support", {
  category: "feedback",
  body: "LOCAL AUTOMATED QA FIXTURE — persistence check only. No action or response is needed.",
});
assert.ok((await api("support")).items.some((row) => row.id === ticket.id));
const owner = await fetch(origin + "/api/product/owner/overview", {
  headers: { cookie },
});
assert.equal(owner.status, 403);
console.log(
  JSON.stringify(
    {
      product: product.id,
      passed: true,
      checks: [
        "local sign-in",
        "anonymous denied",
        "live config",
        "durable preferences",
        "real withdrawal import",
        "exact credited native payout",
        "unsigned intent closure",
        "durable private support",
        "owner proof required",
      ],
      payout: { parent: priorHash, ...payout },
    },
    null,
    2,
  ),
);
