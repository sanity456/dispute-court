import type { Database } from "./database-types";
export async function recordRpcHealth(db: Database, success: boolean) {
  const field = success ? "successes" : "failures",
    time = success ? "lastSuccessAt" : "lastFailureAt",
    now = Date.now();
  const initial = JSON.stringify({ [field]: 1, [time]: now });
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
