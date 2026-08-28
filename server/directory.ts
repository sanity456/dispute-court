import type { Database, SqlValue } from "./database-types";
import type { Network } from "./network.ts";
import { product } from "../lib/product.ts";
import { jsonString, safeJson } from "../lib/activity-model.ts";
import { ApiError, sha256 } from "./security.ts";
import { object } from "./chain-model.ts";
async function member(
  db: Database,
  id: string,
  wallet: unknown,
  role: string,
  data: unknown = {},
) {
  if (typeof wallet !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) return;
  await db
    .prepare(
      "INSERT INTO members(record_id,wallet,role,json) VALUES(?,?,?,?) ON CONFLICT(record_id,wallet) DO UPDATE SET role=CASE WHEN members.role='participant' AND excluded.role='creator' THEN members.role ELSE excluded.role END,json=CASE WHEN members.role='participant' AND excluded.role='creator' THEN members.json ELSE excluded.json END",
    )
    .bind(id, wallet.toLowerCase(), role, jsonString(data))
    .run();
}
async function indexRecord(db: Database, value: unknown, detail = false) {
  const record = object(value),
    id = String(record.id ?? "");
  if (!id || id.length > 80) return;
  const now = Date.now(),
    json = jsonString(record),
    created = Date.parse(String(record.created_at ?? "")) || now;
  await db
    .prepare(
      "INSERT INTO records(id,title,status,json,detail_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,json=excluded.json,detail_json=CASE WHEN excluded.detail_json IS NOT NULL THEN excluded.detail_json WHEN excluded.status!=records.status THEN NULL ELSE records.detail_json END,updated_at=excluded.updated_at",
    )
    .bind(
      id,
      String(record.title ?? id),
      String(record.status ?? "unknown"),
      json,
      detail ? json : null,
      created,
      now,
    )
    .run();
  await member(db, id, record.creator, "creator");
  await member(db, id, record.party_a, "party_a");
  await member(db, id, record.party_b, "party_b");
  if (detail) {
    await db
      .prepare(
        "INSERT INTO system_state(key,json,updated_at) VALUES(?,'{}',?) ON CONFLICT(key) DO UPDATE SET updated_at=excluded.updated_at",
      )
      .bind("detail:" + id, now)
      .run();
    const hash = await sha256(id + json);
    await db
      .prepare(
        "INSERT OR IGNORE INTO observations(id,record_id,at,status,json) VALUES(?,?,?,?,?)",
      )
      .bind(hash, id, now, String(record.status ?? "unknown"), json)
      .run();
  }
}
export async function readAndIndex(
  db: Database,
  network: Network,
  method: string,
  args: unknown[] = [],
  target = network.coreAddress,
) {
  const value = await network.read(method, args, target);
  if (target.toLowerCase() !== network.coreAddress) return value;
  if (method === product.listMethod) {
    const listing = object(value);
    for (const item of Array.isArray(listing.items) ? listing.items : [])
      await indexRecord(db, item);
    await db
      .prepare(
        "INSERT INTO system_state(key,json,updated_at) VALUES('directory_total',?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at",
      )
      .bind(jsonString({ total: Number(listing.total ?? 0) }), Date.now())
      .run();
  } else if (method === product.detailMethod)
    await indexRecord(db, value, true);
  else if (method === "list_participants") {
    const list = object(value);
    for (const item of Array.isArray(list.items) ? list.items : []) {
      const participant = object(item);
      await member(
        db,
        String(args[0]),
        participant.address,
        "participant",
        participant,
      );
    }
  }
  return value;
}
export async function syncRecord(db: Database, network: Network, id: string) {
  const value = await readAndIndex(db, network, product.detailMethod, [id]);
  const record = object(value);
  if (product.id === "commitment-pools") {
    const first = object(
      await readAndIndex(db, network, "list_participants", [id, 0, 50]),
    );
    if (Number(first.total) > 50)
      await readAndIndex(db, network, "list_participants", [id, 50, 50]);
    await db
      .prepare(
        "INSERT INTO system_state(key,json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at",
      )
      .bind(
        "members:" + id,
        jsonString({
          participant_count: Number(record.participant_count ?? 0),
        }),
        Date.now(),
      )
      .run();
  }
  return record;
}
export async function syncDirectory(db: Database, network: Network) {
  const cursorRow = await db
    .prepare("SELECT json FROM system_state WHERE key='directory_cursor'")
    .first<{ json: string }>();
  const cursor = Number(cursorRow ? safeJson(cursorRow.json).offset : 0) || 0;
  const listing = object(
    await readAndIndex(db, network, product.listMethod, [cursor, 50]),
  );
  const next = cursor + 50 < Number(listing.total ?? 0) ? cursor + 50 : 0;
  await db
    .prepare(
      "INSERT INTO system_state(key,json,updated_at) VALUES('directory_cursor',?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at",
    )
    .bind(jsonString({ offset: next }), Date.now())
    .run();
  // Keep work bounded while refreshing active records changed outside this app.
  const staleBefore = Date.now() - 60000;
  const need =
    product.id === "commitment-pools"
      ? await db
          .prepare(
            "SELECT r.id FROM records r LEFT JOIN system_state s ON s.key='members:'||r.id LEFT JOIN system_state d ON d.key='detail:'||r.id WHERE r.detail_json IS NULL OR s.json IS NULL OR json_extract(s.json,'$.participant_count') != json_extract(r.json,'$.participant_count') OR (r.status NOT IN ('settled','cancelled') AND COALESCE(d.updated_at,0)<?) ORDER BY (r.detail_json IS NOT NULL),COALESCE(d.updated_at,0),r.created_at DESC LIMIT 2",
          )
          .bind(staleBefore)
          .all<{ id: string }>()
      : await db
          .prepare(
            "SELECT r.id FROM records r LEFT JOIN system_state d ON d.key='detail:'||r.id WHERE r.detail_json IS NULL OR (r.status NOT IN ('resolved','cancelled') AND COALESCE(d.updated_at,0)<?) ORDER BY (r.detail_json IS NOT NULL),COALESCE(d.updated_at,0),r.created_at DESC LIMIT 2",
          )
          .bind(staleBefore)
          .all<{ id: string }>();
  let error = "";
  for (const row of need.results) {
    try {
      await syncRecord(db, network, row.id);
    } catch (failure) {
      error =
        failure instanceof ApiError
          ? failure.message
          : "Some records could not be indexed yet.";
      break;
    }
  }
  await db
    .prepare(
      "INSERT INTO system_state(key,json,updated_at) VALUES('indexer_health',?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at",
    )
    .bind(jsonString({ error }), Date.now())
    .run();
  return coverage(db);
}
export async function coverage(db: Database) {
  const totals = await db
    .prepare(
      "SELECT count(*) AS indexed,sum(CASE WHEN detail_json IS NOT NULL THEN 1 ELSE 0 END) AS detailed FROM records",
    )
    .first<{ indexed: number; detailed: number }>();
  const row = await db
    .prepare(
      "SELECT json,updated_at FROM system_state WHERE key='directory_total'",
    )
    .first<{ json: string; updated_at: number }>();
  const total = row ? Number(safeJson(row.json).total) : 0;
  const incomplete =
    product.id === "commitment-pools"
      ? ((
          await db
            .prepare(
              "SELECT count(*) AS n FROM records r LEFT JOIN system_state s ON s.key='members:'||r.id WHERE s.json IS NULL OR json_extract(s.json,'$.participant_count') != json_extract(r.json,'$.participant_count')",
            )
            .first<{ n: number }>()
        )?.n ?? 0)
      : 0;
  return {
    indexed: totals?.indexed ?? 0,
    detailed: totals?.detailed ?? 0,
    total,
    membershipPending: incomplete,
    complete:
      Boolean(row) &&
      (totals?.indexed ?? 0) >= total &&
      (totals?.detailed ?? 0) >= total &&
      incomplete === 0,
    updatedAt: row?.updated_at ?? 0,
  };
}
export async function directory(
  db: Database,
  query: string,
  status: string,
  wallet: string,
  offset: number,
  includeFixtures: boolean,
) {
  const where = ["r.hidden=0"],
    values: SqlValue[] = [];
  if (query) {
    where.push("(r.title LIKE ? OR r.id LIKE ?)");
    values.push("%" + query + "%", "%" + query + "%");
  }
  if (status) {
    where.push("r.status=?");
    values.push(status);
  }
  if (wallet) {
    where.push(
      "EXISTS (SELECT 1 FROM members m WHERE m.record_id=r.id AND m.wallet=?)",
    );
    values.push(wallet);
  }
  if (!includeFixtures)
    where.push(
      "r.id NOT LIKE 'lifecycle-%' AND r.id NOT LIKE 'value-probe-%' AND r.id NOT LIKE 'verified-source-%'",
    );
  const condition = where.join(" AND ");
  const count = await db
    .prepare("SELECT count(*) AS total FROM records r WHERE " + condition)
    .bind(...values)
    .first<{ total: number }>();
  const list = await db
    .prepare(
      "SELECT r.json,r.detail_json,r.moderation_reason FROM records r WHERE " +
        condition +
        " ORDER BY r.created_at DESC,r.id DESC LIMIT 24 OFFSET ?",
    )
    .bind(...values, offset)
    .all<{
      json: string;
      detail_json: string | null;
      moderation_reason: string;
    }>();
  const items = await Promise.all(
    list.results.map(async (row) => {
      const item = {
        ...safeJson(row.detail_json ?? row.json),
        ...safeJson(row.json),
      };
      const membership = wallet
        ? await db
            .prepare(
              "SELECT role,json FROM members WHERE record_id=? AND wallet=?",
            )
            .bind(String(item.id), wallet)
            .first<{ role: string; json: string }>()
        : null;
      return {
        ...item,
        ...(membership
          ? {
              viewer: {
                role: membership.role,
                data: safeJson(membership.json),
              },
            }
          : {}),
      };
    }),
  );
  return {
    items,
    total: count?.total ?? 0,
    offset,
    coverage: await coverage(db),
  };
}
export async function recordHistory(db: Database, id: string) {
  const record = await db
    .prepare("SELECT hidden,moderation_reason FROM records WHERE id=?")
    .bind(id)
    .first();
  const observations = await db
    .prepare(
      "SELECT at,status FROM observations WHERE record_id=? ORDER BY at DESC LIMIT 100",
    )
    .bind(id)
    .all();
  const transactions = await db
    .prepare(
      "SELECT * FROM transactions WHERE record_id=? ORDER BY created_at DESC LIMIT 100",
    )
    .bind(id)
    .all();
  return {
    moderation: record,
    observations: observations.results,
    transactions: transactions.results,
  };
}
