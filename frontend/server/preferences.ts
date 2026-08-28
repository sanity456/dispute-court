import type { Database } from "./database-types";
import { ApiError } from "./security.ts";
import { jsonString, safeJson } from "../lib/activity-model.ts";
export const defaults = {
  timezone: "UTC",
  browserReminders: false,
  reminderMinutes: 60,
  includeFixtures: false,
  analyticsConsent: false,
};
export function validatePreferences(value: Record<string, unknown>) {
  const timezone = typeof value.timezone === "string" ? value.timezone : "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new ApiError(400, "Choose a valid timezone.");
  }
  const reminderMinutes = Number(value.reminderMinutes ?? 60);
  if (![15, 60, 1440].includes(reminderMinutes))
    throw new ApiError(400, "Choose 15 minutes, one hour, or one day.");
  return {
    timezone,
    browserReminders: value.browserReminders === true,
    reminderMinutes,
    includeFixtures: value.includeFixtures === true,
    analyticsConsent: value.analyticsConsent === true,
  };
}
export async function getPreferences(db: Database, userId: string) {
  const row = await db
    .prepare("SELECT json FROM preferences WHERE user_id=?")
    .bind(userId)
    .first<{ json: string }>();
  return row ? { ...defaults, ...safeJson(row.json) } : defaults;
}
export async function savePreferences(
  db: Database,
  userId: string,
  value: Record<string, unknown>,
) {
  const data = validatePreferences(value);
  await db
    .prepare(
      "INSERT INTO preferences(user_id,json,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at",
    )
    .bind(userId, jsonString(data), Date.now())
    .run();
  return data;
}
