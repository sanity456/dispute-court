import { getDb } from "../../../../server/db";
import { createNetwork } from "../../../../server/network";
import { handleProductRequest } from "../../../../server/api";
import { ApiError, jsonResponse } from "../../../../server/security";
import { releaseById } from "../../../../lib/releases";
import { authenticate } from "@product/auth";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function handle(request: Request) {
  try {
    let release;
    try {
      release = releaseById(request.headers.get("x-product-release") ?? "v4");
    } catch {
      throw new ApiError(
        400,
        "Unknown release. Reload the app.",
        "unknown_release",
      );
    }
    const db = await getDb(release.id);
    return handleProductRequest(
      request,
      db,
      createNetwork(db, release),
      authenticate,
    );
  } catch (error) {
    if (error instanceof ApiError)
      return jsonResponse(
        { error: error.message, code: error.code },
        error.status,
      );
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
