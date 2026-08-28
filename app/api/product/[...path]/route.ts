import { getDb } from "../../../../server/db";
import { createNetwork } from "../../../../server/network";
import { handleProductRequest } from "../../../../server/api";
import { jsonResponse } from "../../../../server/security";
import { authenticate } from "@product/auth";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function handle(request: Request) {
  try {
    const db = await getDb();
    return handleProductRequest(request, db, createNetwork(db), authenticate);
  } catch {
    return jsonResponse(
      {
        error:
          "Saved history is temporarily unavailable. No untracked wallet transaction will be sent.",
        code: "storage_unavailable",
      },
      503,
    );
  }
}
export const GET = handle;
export const POST = handle;
