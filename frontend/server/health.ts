import type { Database } from "./database-types";
export async function recordRpcHealth(db: Database, success: boolean) {
  const field = success ? "successes" : "failures",
    time = success ? "lastSuccessAt" : "lastFailureAt",
    now = Date.now();
  const initial = JSON.stringify({ [field]: 1, [time]: now });
  if (db.dialect === "postgres") {
    await db
      .prepare(
        "INSERT INTO system_state(key,json,updated_at) VALUES('rpc_health',?,?) ON CONFLICT(key) DO UPDATE SET json=(system_state.json::jsonb || jsonb_build_object('" +
          field +
          "',COALESCE((system_state.json::jsonb->>'" +
          field +
          "')::bigint,0)+1,'" +
          time +
          "',?::bigint))::text,updated_at=?",
      )
      .bind(initial, now, now, now)
      .run();
    return;
  }
  await db
    .prepare(
      "INSERT INTO system_state(key,json,updated_at) VALUES('rpc_health',?,?) ON CONFLICT(key) DO UPDATE SET json=json_set(system_state.json,'$." +
        field +
        "',COALESCE(json_extract(system_state.json,'$." +
        field +
        "'),0)+1,'$." +
        time +
        "',?),updated_at=?",
    )
    .bind(initial, now, now, now)
    .run();
}
