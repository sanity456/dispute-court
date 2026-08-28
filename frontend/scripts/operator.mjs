import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAccount,
  createClient,
  chains,
} from "../vendor/genlayer-js/index.js";
import { createLocalDatabase } from "../server/database.local.ts";
import { schemaStatements } from "../server/schema-statements.ts";
import { createNetwork } from "../server/network.ts";
import {
  reserveIntent,
  updateIntent,
  reconcileIntent,
} from "../server/journal.ts";
import { waitForFinalizedTransaction } from "../lib/receipt.ts";
import { operatorActions } from "../lib/operator-policy.ts";
import { product } from "../lib/product.ts";
const flags = new Set(process.argv.slice(2)),
  execute = flags.has("--execute");
const maximum = Number(
  process.argv.find((v) => v.startsWith("--max-actions="))?.split("=")[1] ?? 3,
);
if (!Number.isInteger(maximum) || maximum < 1 || maximum > 5)
  throw new Error("Use --max-actions=1 through 5.");
const root = dirname(dirname(fileURLToPath(import.meta.url)));
mkdirSync(join(root, ".local-data"), { recursive: true });
const db = createLocalDatabase(join(root, ".local-data", "operator.sqlite"));
const deployment = JSON.parse(
  readFileSync(join(root, "lib", "deployment.json"), "utf8"),
);
const output = (event, details = {}) =>
  console.log(
    JSON.stringify(
      { at: new Date().toISOString(), product: product.id, event, ...details },
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
    ),
  );
try {
  for (const file of ["0000_product_base.sql", "0001_transaction_args.sql"]) {
    const sql = readFileSync(join(root, "drizzle", file), "utf8");
    if (
      file.startsWith("0001") &&
      (await db.prepare("PRAGMA table_info(transactions)").all()).results.some(
        (r) => r.name === "args_json",
      )
    )
      continue;
    await db.batch(schemaStatements(sql).map((s) => db.prepare(s)));
  }
  const net = createNetwork(db),
    read = (method, args = []) => net.read(method, args);
  const reader = createClient({
    chain: chains.studionet,
    endpoint: deployment.rpcUrl,
  });
  if ((await reader.getChainId()) !== 61999)
    throw new Error(
      "Studionet chain verification failed. No transaction sent.",
    );
  if (deployment.network !== "studionet" || deployment.chainId !== 61999)
    throw new Error("This runner is Studionet-only.");
  const key = process.env.KEEPER_PRIVATE_KEY;
  if (execute && (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)))
    throw new Error(
      "Execution requires a dedicated test-only KEEPER_PRIVATE_KEY. Never use or export the contract-owner key.",
    );
  const account = execute ? createAccount(key) : undefined;
  const user = account ? "operator:" + account.address.toLowerCase() : "";
  const client = account
    ? createClient({
        chain: chains.studionet,
        endpoint: deployment.rpcUrl,
        account,
      })
    : undefined;
  if (account) {
    const saved = await db
      .prepare(
        "SELECT id,tx_hash FROM intents WHERE user_id=? AND status IN ('reserved','submitted','review') ORDER BY created_at ASC LIMIT 31",
      )
      .bind(user)
      .all();
    if (saved.results.length > 30)
      throw new Error(
        "More than 30 unresolved operator requests require manual recovery. No further actions sent.",
      );
    for (const pending of saved.results) {
      if (pending.tx_hash) await reconcileIntent(db, net, user, pending.id);
      const state = await db
        .prepare("SELECT status FROM intents WHERE id=?")
        .bind(pending.id)
        .first();
      if (["reserved", "submitted", "review"].includes(state.status)) {
        output("manual_recovery_required", {
          intentId: pending.id,
          hash: pending.tx_hash,
        });
        throw new Error(
          "An earlier operator request has an uncertain outcome. Inspect operator.sqlite and wallet history; do not execute again until reconciled.",
        );
      }
    }
  }
  const offset = Number(
    process.argv.find((v) => v.startsWith("--offset="))?.split("=")[1] ?? 0,
  );
  if (!Number.isInteger(offset) || offset < 0)
    throw new Error("Invalid directory offset.");
  const listing = await read(product.listMethod, [offset, 10]);
  let actions = 0;
  for (const summary of listing.items ?? []) {
    if (actions >= maximum) break;
    // Read full, finalized terms. The contract checks time and eligibility again during execution.
    const record = await read(product.detailMethod, [summary.id]);
    let participants = [],
      canSettle = false;
    if (product.id === "commitment-pools" && record.status === "active") {
      canSettle = await read("can_settle", [record.id]);
      if (!canSettle) {
        const first = await read("list_participants", [record.id, 0, 50]);
        participants = first.items ?? [];
        if (Number(first.total) > 50)
          participants.push(
            ...(await read("list_participants", [record.id, 50, 50])).items,
          );
      }
    }
    for (const action of operatorActions(
      record,
      participants,
      canSettle,
      Math.floor(Date.now() / 1000),
    ).slice(0, maximum - actions)) {
      actions++;
      output(execute ? "eligible_action" : "dry_run_action", action);
      if (!execute) continue;
      const intent = await reserveIntent(db, net, user, {
        wallet: account.address,
        target: deployment.contractAddress,
        method: action.method,
        args: action.args,
        value: "0",
        title: "Operator: " + action.method,
      });
      let hash = "";
      try {
        hash = String(
          await client.writeContract({
            address: deployment.contractAddress,
            functionName: action.method,
            args: action.args,
            value: 0n,
            leaderOnly: false,
            consensusMaxRotations: 5,
          }),
        );
        output("submitted", {
          intentId: intent.id,
          method: action.method,
          hash,
        });
        await updateIntent(db, net, user, intent.id, { hash });
        await waitForFinalizedTransaction(hash, () => net.transaction(hash), {
          onProgress: (p) => output("progress", p),
        });
        await reconcileIntent(db, net, user, intent.id);
        output("finalized_success", { intentId: intent.id, hash });
      } catch (error) {
        if (hash) {
          try {
            await updateIntent(db, net, user, intent.id, { hash });
          } catch {
            /* Printed hash and reserved intent remain for recovery. */
          }
        } else
          await updateIntent(db, net, user, intent.id, {
            state: "review",
            error:
              "Operator submission outcome uncertain. Inspect wallet and journal.",
          });
        throw error;
      }
    }
  }
  output("run_complete", {
    mode: execute ? "execute" : "dry-run",
    actions,
    recordsInspected: listing.items?.length ?? 0,
    totalRecords: listing.total,
    nextOffset: offset + 10 < Number(listing.total) ? offset + 10 : null,
  });
} finally {
  db.close();
}
