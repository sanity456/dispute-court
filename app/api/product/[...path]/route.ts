import { getDb } from "../../../../server/db";
import { createNetwork } from "../../../../server/network";
import { handleProductRequest } from "../../../../server/api";
import { jsonResponse } from "../../../../server/security";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const db = await getDb();
    return handleProductRequest(request, db, createNetwork(db));
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
