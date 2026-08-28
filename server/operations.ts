import type { Database } from "./database-types";
import { coverage } from "./directory.ts";
import { safeJson } from "../lib/activity-model.ts";
import { product } from "../lib/product.ts";
export async function ownerOverview(db: Database) {
  const [
    intentCounts,
    payoutCounts,
    tickets,
    indexHealth,
    records,
    coverageInfo,
  ] = await Promise.all([
    db
      .prepare("SELECT status,count(*) AS count FROM intents GROUP BY status")
      .all(),
    db
      .prepare(
        "SELECT payout_state,count(*) AS count FROM transactions WHERE method='withdraw' GROUP BY payout_state",
      )
      .all(),
    db
      .prepare("SELECT status,count(*) AS count FROM support GROUP BY status")
      .all(),
    db
      .prepare(
        "SELECT json,updated_at FROM system_state WHERE key='indexer_health'",
      )
      .first<{ json: string; updated_at: number }>(),
    db
      .prepare(
        "SELECT id,title,status,json,detail_json,updated_at,hidden,moderation_reason FROM records ORDER BY created_at DESC LIMIT 100",
      )
      .all<{
        id: string;
        title: string;
        status: string;
        json: string;
        detail_json: string | null;
        updated_at: number;
        hidden: number;
        moderation_reason: string;
      }>(),
    coverage(db),
  ]);
  const now = Math.floor(Date.now() / 1000);
  const health = await db
    .prepare("SELECT json,updated_at FROM system_state WHERE key='rpc_health'")
    .first<{ json: string; updated_at: number }>();
  const stages = await db
    .prepare("SELECT status,count(*) AS count FROM records GROUP BY status")
    .all();
  const queue = records.results.flatMap((row) => {
    const r = {
      ...safeJson(row.detail_json ?? row.json),
      ...safeJson(row.json),
    };
    let action = "";
    if (product.id === "commitment-pools") {
      if (r.status === "forming" && Number(r.join_deadline) <= now)
        action = "Activate pool or start underfilled refunds";
      if (r.status === "active" && Number(r.activity_ends_at) <= now)
        action = "Check settlement eligibility";
      if (r.status === "refunding")
        action = "Participants can claim their refunds";
    } else {
      if (
        r.status === "awaiting_acceptance" &&
        Number(r.acceptance_deadline) <= now
      )
        action = "Close expired invitation";
      if (r.status === "awaiting_funding" && Number(r.funding_deadline) <= now)
        action = "Ask a party to close expired funding";
      if (
        r.status === "awaiting_response" &&
        Number(r.response_deadline) <= now
      )
        action = "Finalize unanswered dispute";
      if (r.status === "evidence" && Number(r.evidence_deadline) <= now)
        action = "Close expired evidence window";
      if (r.status === "ready_for_resolution")
        action = "Request validator resolution";
      if (r.status === "resolution_stalled")
        action = "Parties must review retry or fallback options";
    }
    return action
      ? [
          {
            id: row.id,
            title: row.title,
            status: row.status,
            action,
            observedAt: row.updated_at,
          },
        ]
      : [];
  });
  const uncertain = await db
    .prepare(
      "SELECT hash,wallet,method,record_id,payout_state,status,updated_at,error FROM transactions WHERE payout_state IN ('pending','failed','unknown') OR (status='FINALIZED' AND execution='unknown') ORDER BY updated_at ASC LIMIT 50",
    )
    .all();
  if (product.id === "commitment-pools") {
    const missed = await db
      .prepare(
        "SELECT r.id,r.title,r.status,r.updated_at,m.wallet FROM members m JOIN records r ON r.id=m.record_id WHERE r.status='active' AND json_extract(m.json,'$.status')='active' AND ? >= json_extract(COALESCE(r.detail_json,r.json),'$.activity_starts_at')+(json_extract(m.json,'$.rounds_passed')+1)*json_extract(COALESCE(r.detail_json,r.json),'$.round_window_seconds') LIMIT 100",
      )
      .bind(now)
      .all<{
        id: string;
        title: string;
        status: string;
        updated_at: number;
        wallet: string;
      }>();
    queue.push(
      ...missed.results.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        action: "Record missed round for " + row.wallet,
        observedAt: row.updated_at,
      })),
    );
  }
  return {
    intentCounts: intentCounts.results,
    payoutCounts: payoutCounts.results,
    tickets: tickets.results,
    rpcHealth: health
      ? { ...safeJson(health.json), updatedAt: health.updated_at }
      : null,
    recordStages: stages.results,
    coverage: coverageInfo,
    indexer: indexHealth
      ? { ...safeJson(indexHealth.json), updatedAt: indexHealth.updated_at }
      : null,
    queue,
    attention: uncertain.results,
    records: records.results.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      updated_at: row.updated_at,
      hidden: row.hidden,
      moderation_reason: row.moderation_reason,
    })),
    generatedAt: Date.now(),
    scope:
      "Saved product requests and indexed records only; this is not a complete blockchain transaction archive.",
  };
}
