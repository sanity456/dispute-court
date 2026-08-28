import type { Database } from "./database-types";
export async function cleanExpiredTransientRows(
  db: Database,
  now = Date.now(),
) {
  const lease = await db
    .prepare(
      "INSERT INTO system_state(key,json,updated_at) VALUES('transient_cleanup','{}',?) ON CONFLICT(key) DO UPDATE SET updated_at=excluded.updated_at WHERE system_state.updated_at < ? RETURNING key",
    )
    .bind(now, now - 3600000)
    .first();
  if (!lease) return;
  // Only expired, replaceable cache/auth/rate-limit rows. Never user journals, preferences or support.
  const targets = [
    ["rate_buckets", "key"],
    ["read_cache", "key"],
    ["sessions", "token_hash"],
    ["challenges", "id"],
  ];
  await db.batch(
    targets.map(([table, key]) =>
      db
        .prepare(
          "DELETE FROM " +
            table +
            " WHERE " +
            key +
            " IN (SELECT " +
            key +
            " FROM " +
            table +
            " WHERE expires_at < ? LIMIT 2000)",
        )
        .bind(now),
    ),
  );
}
