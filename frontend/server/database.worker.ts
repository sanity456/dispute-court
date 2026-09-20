import { env } from "cloudflare:workers";
import type { Database } from "./database-types";
import { releaseById } from "../lib/releases.ts";
export function binding(releaseId = "v4"): Database {
  releaseById(releaseId);
  const bindings = env as unknown as { DB?: Database; DB_V5?: Database };
  const db = releaseId === "v4" ? bindings.DB : bindings.DB_V5;
  if (!db)
    throw new Error(
      "Durable storage is unavailable. No transaction has been sent.",
    );
  return db;
}
