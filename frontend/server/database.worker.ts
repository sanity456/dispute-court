import { env } from "cloudflare:workers";
import type { Database } from "./database-types";
export function binding(): Database {
  const db = (env as unknown as { DB?: Database }).DB;
  if (!db)
    throw new Error(
      "Durable storage is unavailable. No transaction has been sent.",
    );
  return db;
}
