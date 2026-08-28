import type { Database } from "./database-types";
import { ApiError, textField, txHash } from "./security.ts";
export async function addSupport(
  db: Database,
  userId: string,
  input: Record<string, unknown>,
) {
  const category = String(input.category ?? "");
  if (
    !["transaction", "evidence", "abuse", "feedback", "privacy"].includes(
      category,
    )
  )
    throw new ApiError(400, "Choose a support category.");
  const id = crypto.randomUUID(),
    now = Date.now(),
    body = textField(input.body, "Message", 2000);
  const recordId = textField(input.recordId, "Record ID", 80, true),
    hash = input.hash ? txHash(input.hash) : "";
  await db
    .prepare(
      "INSERT INTO support(id,user_id,category,record_id,tx_hash,body,status,response,created_at,updated_at) VALUES(?,?,?,?,?,?,'open','',?,?)",
    )
    .bind(id, userId, category, recordId, hash, body, now, now)
    .run();
  return { id, status: "open" };
}
export async function supportList(db: Database, userId: string, owner = false) {
  const query = owner
    ? "SELECT id,category,record_id,tx_hash,body,status,response,created_at,updated_at FROM support ORDER BY created_at DESC LIMIT 100"
    : "SELECT id,category,record_id,tx_hash,body,status,response,created_at,updated_at FROM support WHERE user_id=? ORDER BY created_at DESC LIMIT 100";
  const statement = db.prepare(query);
  return (await (owner ? statement : statement.bind(userId)).all()).results;
}
export async function respondSupport(
  db: Database,
  input: Record<string, unknown>,
) {
  const id = textField(input.id, "Ticket ID", 80),
    response = textField(input.response, "Response", 2000),
    status = String(input.status ?? "");
  if (!["open", "resolved"].includes(status))
    throw new ApiError(400, "Unsupported ticket status.");
  const row = await db
    .prepare(
      "UPDATE support SET response=?,status=?,updated_at=? WHERE id=? RETURNING id",
    )
    .bind(response, status, Date.now(), id)
    .first();
  if (!row) throw new ApiError(404, "Ticket not found.");
  return row;
}
export async function moderateRecord(
  db: Database,
  input: Record<string, unknown>,
) {
  const id = textField(input.id, "Record ID", 80),
    reason = textField(input.reason, "Reason", 240);
  const hidden = input.hidden === true ? 1 : 0;
  const row = await db
    .prepare(
      "UPDATE records SET hidden=?,moderation_reason=? WHERE id=? RETURNING id",
    )
    .bind(hidden, reason, id)
    .first();
  if (!row) throw new ApiError(404, "Indexed record not found.");
  return row;
}
