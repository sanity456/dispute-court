import type { Database } from "./database-types";
type JsonField =
  | "participant_count"
  | "status"
  | "activity_starts_at"
  | "rounds_passed"
  | "round_window_seconds";

// SQL expressions are internal constants, never request input.
export function jsonField(
  db: Database,
  expression: string,
  field: JsonField,
  numeric = false,
) {
  if (db.dialect !== "postgres")
    return "json_extract(" + expression + ",'$." + field + "')";
  const value = "((" + expression + ")::jsonb ->> '" + field + "')";
  return numeric ? "CAST(" + value + " AS numeric)" : value;
}
