import type { Database } from "./database-types";
import type { Network } from "./network.ts";
import { requireSecurityRelease } from "./release.ts";
import { ApiError, address, sha256, textField, txHash } from "./security.ts";
import {
  transactionCall,
  observeTransaction,
  exactValue,
} from "./chain-model.ts";
import {
  canonicalArgs,
  jsonString,
  safeJson,
  recordIdForAction,
} from "../lib/activity-model.ts";
import type { Intent, TransactionObservation } from "../lib/activity-model.ts";
export async function reserveIntent(
  db: Database,
  network: Network,
  userId: string,
  input: Record<string, unknown>,
): Promise<Intent> {
  const wallet = address(input.wallet),
    target = address(input.target),
    method = textField(input.method, "Method", 80);
  const definition = network.methods(target)[method];
  const args = input.args;
  if (
    !definition ||
    definition.readonly ||
    !Array.isArray(args) ||
    args.length !== definition.params.length
  )
    throw new ApiError(400, "Unsupported action or incorrect arguments.");
  const value = exactValue(input.value ?? "0");
  if (
    BigInt(value) > (1n << 256n) - 1n ||
    (!["join", "fund_agreement"].includes(method) && value !== "0")
  )
    throw new ApiError(400, "Invalid native amount for this action.");
  const title = textField(
    input.title ?? method.replaceAll("_", " "),
    "Action title",
    100,
  );
  const recordId = recordIdForAction(method, args);
  if (recordId.length > 80) throw new ApiError(400, "Record ID is too long.");
  await requireSecurityRelease(network, target, method);
  if (method === "submit_evidence") {
    const agreement = (await network.read("get_agreement", [recordId])) as {
      evidence?: {
        submitted_by?: string;
        url?: string;
        expected_digest?: string;
      }[];
    };
    if (
      agreement.evidence?.some(
        (exhibit) =>
          String(exhibit.submitted_by).toLowerCase() === wallet &&
          exhibit.url === args[2] &&
          exhibit.expected_digest === String(args[3]).toLowerCase(),
      )
    )
      throw new ApiError(
        409,
        "You already submitted this source and digest. Review the existing exhibit instead of spending another evidence slot.",
        "duplicate_evidence",
      );
  }
  const operationKey = await sha256(
    jsonString([
      wallet,
      target,
      method,
      method === "capture" ? args[0] : recordId,
    ]),
  );
  const existing = await db
    .prepare(
      "SELECT * FROM intents WHERE user_id=? AND operation_key=? AND status IN ('reserved','submitted','review')",
    )
    .bind(userId, operationKey)
    .first<Intent>();
  if (existing)
    throw new ApiError(
      409,
      "An earlier request for this action still needs a confirmed outcome. Open Activity before submitting again.",
      "active_intent",
      { intentId: existing.id },
    );
  const now = Date.now(),
    id = crypto.randomUUID();
  try {
    await db
      .prepare(
        "INSERT INTO intents(id,user_id,wallet,target,method,title,record_id,args_json,value_wei,operation_key,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'reserved',?,?)",
      )
      .bind(
        id,
        userId,
        wallet,
        target,
        method,
        title,
        recordId,
        jsonString(args),
        value,
        operationKey,
        now,
        now,
      )
      .run();
  } catch (error) {
    const active = await db
      .prepare(
        "SELECT id FROM intents WHERE user_id=? AND operation_key=? AND status IN ('reserved','submitted','review')",
      )
      .bind(userId, operationKey)
      .first<{ id: string }>();
    if (active)
      throw new ApiError(
        409,
        "This action is already reserved in another tab. Open Activity.",
        "active_intent",
        { intentId: active.id },
      );
    throw error;
  }
  return (await db
    .prepare("SELECT * FROM intents WHERE id=? AND user_id=?")
    .bind(id, userId)
    .first<Intent>())!;
}
export async function ownIntent(db: Database, userId: string, id: string) {
  const row = await db
    .prepare("SELECT * FROM intents WHERE id=? AND user_id=?")
    .bind(id, userId)
    .first<Intent>();
  if (!row) throw new ApiError(404, "Saved request not found.");
  return row;
}
export async function updateIntent(
  db: Database,
  network: Network,
  userId: string,
  id: string,
  input: Record<string, unknown>,
) {
  const intent = await ownIntent(db, userId, id);
  if (input.hash) {
    const hash = txHash(input.hash);
    if (intent.tx_hash && intent.tx_hash !== hash)
      throw new ApiError(
        409,
        "A different hash is already attached. Do not replace a submitted transaction.",
      );
    if (
      ["success", "failed", "cancelled"].includes(intent.status) &&
      !intent.tx_hash
    )
      throw new ApiError(409, "This request is already closed.");
    if (!intent.tx_hash) {
      const taken = await db
        .prepare(
          "SELECT id FROM intents WHERE user_id=? AND tx_hash=? AND id!=?",
        )
        .bind(userId, hash, id)
        .first();
      if (taken)
        throw new ApiError(
          409,
          "That hash is already attached to another saved request.",
        );
      const changed = await db
        .prepare(
          "UPDATE intents SET tx_hash=?,status='submitted',updated_at=? WHERE id=? AND user_id=? AND tx_hash IS NULL AND status IN ('reserved','submitted','review') RETURNING id",
        )
        .bind(hash, Date.now(), id, userId)
        .first();
      if (!changed && (await ownIntent(db, userId, id)).tx_hash !== hash)
        throw new ApiError(
          409,
          "This request changed in another tab. Refresh Activity before continuing.",
        );
    }
    try {
      await reconcileIntent(db, network, userId, id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) throw error;
      // Hash durability is more important than an immediate RPC response.
    }
  } else {
    if (intent.tx_hash)
      throw new ApiError(
        409,
        "A broadcast transaction cannot be cancelled from this app.",
      );
    if (!["reserved", "review"].includes(intent.status))
      throw new ApiError(409, "This request is already closed.");
    const cancelled =
      input.state === "cancelled" && input.confirmedUnsigned === true;
    const status = cancelled ? "cancelled" : "review";
    const reason = cancelled
      ? "User confirmed the wallet request was rejected or never submitted."
      : textField(
          input.error ?? "Submission outcome is unknown. Check wallet history.",
          "Reason",
          500,
        );
    await db
      .prepare(
        "UPDATE intents SET status=?,error=?,updated_at=? WHERE id=? AND user_id=? AND tx_hash IS NULL",
      )
      .bind(status, reason, Date.now(), id, userId)
      .run();
  }
  return ownIntent(db, userId, id);
}
async function saveObservation(db: Database, value: TransactionObservation) {
  await db
    .prepare(
      "INSERT INTO transactions(hash,wallet,target,method,args_json,record_id,status,execution,value_wei,payout_state,payout_json,result_json,created_at,updated_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(hash) DO UPDATE SET args_json=excluded.args_json,status=excluded.status,execution=excluded.execution,payout_state=excluded.payout_state,payout_json=excluded.payout_json,result_json=excluded.result_json,updated_at=excluded.updated_at,error=excluded.error",
    )
    .bind(
      value.hash.toLowerCase(),
      value.wallet,
      value.target,
      value.method,
      value.args_json,
      value.record_id,
      value.status,
      value.execution,
      value.value_wei,
      value.payout_state,
      value.payout_json,
      value.result_json,
      value.created_at,
      value.updated_at,
      value.error,
    )
    .run();
}
export async function observeHash(
  db: Database,
  network: Network,
  hash: string,
  force = false,
) {
  const saved = await db
    .prepare("SELECT * FROM transactions WHERE hash=?")
    .bind(hash)
    .first<TransactionObservation>();
  const complete =
    saved?.status === "FINALIZED" &&
    ["none", "delivered", "failed"].includes(saved.payout_state) &&
    saved.execution !== "unknown";
  if (saved && (complete || (!force && Date.now() - saved.updated_at < 20000)))
    return saved;
  const raw = await network.transaction(hash);
  if (!raw)
    throw new ApiError(
      202,
      "Transaction not visible yet. Its hash is saved.",
      "awaiting_propagation",
    );
  const target = String(raw.to_address ?? "").toLowerCase();
  network.methods(target);
  const call = transactionCall(raw);
  if (
    !call.method ||
    !network.methods(target)[String(call.method)] ||
    network.methods(target)[String(call.method)].readonly
  )
    throw new ApiError(400, "This is not a supported product transaction.");
  const children: unknown[] = [];
  if (
    call.method === "withdraw" &&
    ["FINALIZED", 7, "7"].includes(raw.status as string)
  ) {
    const ids = Array.isArray(raw.triggered_transactions)
      ? raw.triggered_transactions
      : [];
    if (ids.length <= 3)
      for (const id of ids) {
        const child = await network.transaction(txHash(id));
        if (child) children.push(child);
      }
  }
  const observation = observeTransaction(raw, children);
  observation.hash = hash;
  await saveObservation(db, observation);
  return observation;
}
export async function reconcileIntent(
  db: Database,
  network: Network,
  userId: string,
  id: string,
) {
  const intent = await ownIntent(db, userId, id);
  if (!intent.tx_hash) return intent;
  const saved = await db
    .prepare("SELECT * FROM transactions WHERE hash=?")
    .bind(intent.tx_hash)
    .first<TransactionObservation>();
  let observation: TransactionObservation;
  if (saved && saved.status === "FINALIZED" && saved.execution !== "unknown") {
    observation = await observeHash(db, network, intent.tx_hash);
  } else {
    const raw = await network.transaction(intent.tx_hash);
    if (!raw) return intent;
    const call = transactionCall(raw);
    const matches =
      String(raw.from_address ?? "").toLowerCase() === intent.wallet &&
      String(raw.to_address ?? "").toLowerCase() === intent.target &&
      call.method === intent.method &&
      jsonString(canonicalArgs(call.args ?? [])) ===
        jsonString(canonicalArgs(safeJson(intent.args_json))) &&
      exactValue(raw.value) === intent.value_wei;
    if (!matches) {
      await db
        .prepare(
          "UPDATE intents SET status='review',error=?,updated_at=? WHERE id=? AND user_id=?",
        )
        .bind(
          "The transaction does not match this saved wallet/action/amount. Do not resubmit; contact support.",
          Date.now(),
          id,
          userId,
        )
        .run();
      throw new ApiError(
        409,
        "The transaction does not match this saved request.",
        "receipt_mismatch",
      );
    }
    const children: unknown[] = [];
    if (
      intent.method === "withdraw" &&
      ["FINALIZED", 7, "7"].includes(raw.status as string)
    ) {
      const ids = Array.isArray(raw.triggered_transactions)
        ? raw.triggered_transactions
        : [];
      if (ids.length <= 3)
        for (const childId of ids) {
          try {
            const child = await network.transaction(txHash(childId));
            if (child) children.push(child);
          } catch {
            /* keep delivery unconfirmed */
          }
        }
    }
    observation = observeTransaction(raw, children);
    observation.hash = intent.tx_hash;
    await saveObservation(db, observation);
  }
  // Cached observations are independently matched too; another user cannot lend a success to a different intent.
  if (
    observation.wallet !== intent.wallet ||
    observation.target !== intent.target ||
    observation.method !== intent.method ||
    observation.value_wei !== intent.value_wei ||
    jsonString(canonicalArgs(safeJson(observation.args_json))) !==
      jsonString(canonicalArgs(safeJson(intent.args_json)))
  ) {
    await db
      .prepare(
        "UPDATE intents SET status='review',error=?,updated_at=? WHERE id=? AND user_id=?",
      )
      .bind(
        "The receipt does not match this saved request, including its arguments. Check wallet history before submitting again.",
        Date.now(),
        id,
        userId,
      )
      .run();
    throw new ApiError(
      409,
      "Receipt does not belong to this request.",
      "receipt_mismatch",
    );
  }
  const status = ["CANCELED", "CANCELLED"].includes(observation.status)
    ? "failed"
    : observation.status === "FINALIZED"
      ? observation.execution === "success"
        ? "success"
        : observation.execution === "error"
          ? "failed"
          : "review"
      : "submitted";
  await db
    .prepare(
      "UPDATE intents SET status=?,error=?,updated_at=? WHERE id=? AND user_id=?",
    )
    .bind(status, observation.error, Date.now(), id, userId)
    .run();
  if (status === "success") await network.invalidate();
  return { ...(await ownIntent(db, userId, id)), transaction: observation };
}
export async function listActivity(
  db: Database,
  userId: string,
  wallet: string,
  offset = 0,
) {
  const condition = wallet ? " AND wallet=?" : "";
  const values = wallet ? [userId, wallet] : [userId];
  const rows = await db
    .prepare(
      "SELECT * FROM intents WHERE user_id=?" +
        condition +
        " ORDER BY created_at DESC LIMIT 30 OFFSET ?",
    )
    .bind(...values, offset)
    .all<Intent>();
  const count = await db
    .prepare(
      "SELECT count(*) AS total FROM intents WHERE user_id=?" + condition,
    )
    .bind(...values)
    .first<{ total: number }>();
  const items = await Promise.all(
    rows.results.map(async (intent) => ({
      ...intent,
      transaction: intent.tx_hash
        ? await db
            .prepare("SELECT * FROM transactions WHERE hash=?")
            .bind(intent.tx_hash)
            .first<TransactionObservation>()
        : null,
    })),
  );
  return { items, total: count?.total ?? 0, offset };
}
export async function importTransaction(
  db: Database,
  network: Network,
  userId: string,
  hash: string,
) {
  const existing = await db
    .prepare("SELECT id FROM intents WHERE user_id=? AND tx_hash=?")
    .bind(userId, hash)
    .first<{ id: string }>();
  if (existing) return ownIntent(db, userId, existing.id);
  const raw = await network.transaction(hash);
  if (!raw)
    throw new ApiError(
      404,
      "This hash is not visible yet. Retry the lookup, not the transaction.",
    );
  const call = transactionCall(raw),
    target = address(raw.to_address),
    wallet = address(raw.from_address);
  if (
    !network.methods(target)[String(call.method)] ||
    network.methods(target)[String(call.method)].readonly
  )
    throw new ApiError(400, "This is not a supported product action.");
  const id = crypto.randomUUID(),
    now = Date.now(),
    method = String(call.method),
    args = Array.isArray(call.args) ? call.args : [];
  await db
    .prepare(
      "INSERT INTO intents(id,user_id,wallet,target,method,title,record_id,args_json,value_wei,operation_key,status,tx_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'submitted',?,?,?)",
    )
    .bind(
      id,
      userId,
      wallet,
      target,
      method,
      method.replaceAll("_", " "),
      recordIdForAction(method, args),
      jsonString(args),
      exactValue(raw.value),
      "import:" + hash,
      hash,
      now,
      now,
    )
    .run();
  return reconcileIntent(db, network, userId, id);
}
