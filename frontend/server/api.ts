import type { Database } from "./database-types";
import type { Network } from "./network.ts";
import {
  ApiError,
  address,
  bodyJson,
  integer,
  jsonResponse,
  rateLimit,
  sameOrigin,
  textField,
  txHash,
} from "./security.ts";
import {
  reserveIntent,
  updateIntent,
  reconcileIntent,
  listActivity,
  importTransaction,
  observeHash,
} from "./journal.ts";
import {
  directory,
  readAndIndex,
  recordHistory,
  syncDirectory,
  syncRecord,
  coverage,
} from "./directory.ts";
import { getPreferences, savePreferences } from "./preferences.ts";
import {
  addSupport,
  supportList,
  respondSupport,
  moderateRecord,
} from "./support.ts";
import {
  ownerChallenge,
  completeOwnerChallenge,
  ownerSession,
  requireOwner,
  logoutOwner,
  ownerSignatureInput,
} from "./owner-auth.ts";
import { ownerOverview } from "./operations.ts";
import { cleanExpiredTransientRows } from "./maintenance.ts";
import { walletFromUserId } from "../lib/wallet-auth-policy.ts";
export async function handleProductRequest(
  request: Request,
  db: Database,
  network: Network,
  authenticate: (request: Request) => string | Promise<string>,
): Promise<Response> {
  try {
    if (typeof authenticate !== "function")
      throw new ApiError(
        503,
        "Account verification is unavailable.",
        "auth_unavailable",
      );
    const userId = await authenticate(request),
      url = new URL(request.url);
    const wallet = walletFromUserId(userId);
    const expectedWallet = request.headers.get("x-product-wallet");
    if (expectedWallet && expectedWallet.toLowerCase() !== wallet)
      throw new ApiError(
        409,
        "The signed-in wallet changed. Sign in again before continuing.",
        "wallet_session_changed",
      );
    const path = url.pathname
      .replace(/^\/api\/product\/?/, "")
      .replace(/\/$/, "");
    const post = request.method === "POST";
    if (!post && request.method !== "GET")
      throw new ApiError(405, "Method not allowed.");
    if (post) sameOrigin(request);
    await rateLimit(db, "user:" + userId, 100);
    await cleanExpiredTransientRows(db);
    const input = post ? await bodyJson(request) : {};
    const parts = path.split("/");
    if (path === "session" && !post)
      return jsonResponse({
        signedIn: true,
        wallet,
        authMethod: wallet ? "wallet" : undefined,
        ownerVerified: await ownerSession(
          db,
          request,
          userId,
          network.ownerAddress,
        ),
        preferences: await getPreferences(db, userId),
        coreAddress: network.coreAddress,
        captureAddress: network.captureAddress,
        chainId: 61999,
      });
    if (path === "read" && post) {
      await rateLimit(db, "read:" + userId, 60);
      const method = textField(input.method, "Method", 80),
        target = input.target ? address(input.target) : network.coreAddress;
      if (!Array.isArray(input.args ?? []))
        throw new ApiError(400, "Arguments must be a list.");
      return jsonResponse({
        value: await readAndIndex(
          db,
          network,
          method,
          (input.args ?? []) as unknown[],
          target,
        ),
      });
    }
    if (path === "intents" && post) {
      if (wallet && address(input.wallet) !== wallet)
        throw new ApiError(
          403,
          "Sign in with the wallet used for this action.",
          "wallet_mismatch",
        );
      await rateLimit(db, "reserve:" + userId, 15);
      return jsonResponse(await reserveIntent(db, network, userId, input), 201);
    }
    if (parts[0] === "intents" && parts.length === 2 && post)
      return jsonResponse(
        await updateIntent(
          db,
          network,
          userId,
          textField(parts[1], "Request ID", 80),
          input,
        ),
      );
    if (
      parts[0] === "intents" &&
      parts[2] === "reconcile" &&
      parts.length === 3 &&
      post
    )
      return jsonResponse(
        await reconcileIntent(
          db,
          network,
          userId,
          textField(parts[1], "Request ID", 80),
        ),
      );
    if (path === "activity" && !post)
      return jsonResponse(
        await listActivity(
          db,
          userId,
          url.searchParams.get("wallet")
            ? address(url.searchParams.get("wallet"))
            : "",
          integer(url.searchParams.get("offset"), 0, 100000),
        ),
      );
    if (path === "activity/import" && post) {
      await rateLimit(db, "import:" + userId, 6);
      return jsonResponse(
        await importTransaction(db, network, userId, txHash(input.hash)),
      );
    }
    if (path === "directory" && !post) {
      const prefs = await getPreferences(db, userId);
      return jsonResponse(
        await directory(
          db,
          textField(url.searchParams.get("q"), "Search", 120, true),
          textField(url.searchParams.get("status"), "Status", 40, true),
          url.searchParams.get("wallet")
            ? address(url.searchParams.get("wallet"))
            : "",
          integer(url.searchParams.get("offset"), 0, 100000),
          prefs.includeFixtures,
        ),
      );
    }
    if (path === "directory/sync" && post) {
      await rateLimit(db, "sync:" + userId, 4);
      return jsonResponse(await syncDirectory(db, network));
    }
    if (parts[0] === "records" && parts.length === 2 && !post)
      return jsonResponse(
        await recordHistory(
          db,
          textField(decodeURIComponent(parts[1]), "Record ID", 80),
        ),
      );
    if (
      parts[0] === "records" &&
      parts.length === 3 &&
      parts[2] === "sync" &&
      post
    ) {
      await rateLimit(db, "record-sync:" + userId, 8);
      return jsonResponse(
        await syncRecord(
          db,
          network,
          textField(decodeURIComponent(parts[1]), "Record ID", 80),
        ),
      );
    }
    if (path === "preferences")
      return jsonResponse(
        post
          ? await savePreferences(db, userId, input)
          : await getPreferences(db, userId),
      );
    if (path === "support") {
      if (post) {
        await rateLimit(db, "support:" + userId, 5, 3600000);
        return jsonResponse(await addSupport(db, userId, input), 201);
      }
      return jsonResponse({ items: await supportList(db, userId) });
    }
    if (path === "owner/challenge" && post) {
      if (wallet && address(input.wallet) !== wallet)
        throw new ApiError(
          403,
          "Sign in with the owner wallet first.",
          "wallet_mismatch",
        );
      await rateLimit(db, "owner-challenge:" + userId, 5);
      return jsonResponse(
        await ownerChallenge(
          db,
          userId,
          address(input.wallet),
          url.origin,
          network.ownerAddress,
        ),
      );
    }
    if (path === "owner/verify" && post) {
      await rateLimit(db, "owner-verify:" + userId, 8);
      const data = ownerSignatureInput(input);
      return jsonResponse({ verified: true }, 200, {
        "Set-Cookie": await completeOwnerChallenge(
          db,
          userId,
          data.id,
          data.signature,
          network.ownerAddress,
          url.protocol === "https:",
        ),
      });
    }
    if (path === "owner/logout" && post)
      return jsonResponse({ verified: false }, 200, {
        "Set-Cookie": await logoutOwner(db, request, userId),
      });
    if (parts[0] === "owner") {
      await requireOwner(db, request, userId, network.ownerAddress);
      if (path === "owner/overview" && !post)
        return jsonResponse(await ownerOverview(db));
      if (path === "owner/transaction" && post) {
        await rateLimit(db, "owner-recheck:" + userId, 8);
        return jsonResponse(
          await observeHash(db, network, txHash(input.hash), true),
        );
      }
      if (path === "owner/support" && !post)
        return jsonResponse({ items: await supportList(db, userId, true) });
      if (path === "owner/support" && post)
        return jsonResponse(await respondSupport(db, input));
      if (path === "owner/moderation" && post)
        return jsonResponse(await moderateRecord(db, input));
      if (path === "owner/coverage" && !post)
        return jsonResponse(await coverage(db));
    }
    throw new ApiError(404, "Product endpoint not found.");
  } catch (error) {
    if (error instanceof ApiError)
      return jsonResponse(
        { error: error.message, code: error.code, ...error.details },
        error.status === 202 ? 200 : error.status,
        error.status === 429 ? { "Retry-After": "60" } : {},
      );
    console.error(
      "Product request failed",
      error instanceof Error ? error.name : "Unknown error",
    );
    return jsonResponse(
      {
        error:
          "The service could not complete this request. Your saved transaction record is retained. Try refreshing before submitting anything again.",
        code: "service_unavailable",
      },
      503,
    );
  }
}
