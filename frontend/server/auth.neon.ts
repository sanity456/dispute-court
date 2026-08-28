import { createNeonAuth } from "@neondatabase/auth/next/server";
import type { NextRequest } from "next/server";
import { ApiError, jsonResponse, sameOrigin, bodyJson } from "./security";
let auth: ReturnType<typeof createNeonAuth> | undefined;
function configuredAuth() {
  if (!auth) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
    if (!baseUrl || !secret || secret.length < 32)
      throw new ApiError(
        503,
        "Account sign-in is temporarily unavailable.",
        "auth_unavailable",
      );
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".neon.tech"))
      throw new ApiError(
        503,
        "Account sign-in is temporarily unavailable.",
        "auth_unavailable",
      );
    auth = createNeonAuth({
      baseUrl,
      cookies: { secret, sameSite: "lax", sessionDataTtl: 60 },
    });
  }
  return auth;
}
export async function authenticate() {
  const { data: session, error } = await configuredAuth().getSession();
  if (error)
    throw new ApiError(
      503,
      "Account access could not be verified. Try again.",
      "auth_unavailable",
    );
  const id = session?.user?.id;
  if (!id || id.length > 180)
    throw new ApiError(
      401,
      "Sign in to use saved history and support.",
      "sign_in_required",
    );
  return "neon:" + id;
}
export async function authRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    if (request.method === "POST") {
      sameOrigin(request);
      await bodyJson(request.clone());
    }
    const handlers = configuredAuth().handler();
    return request.method === "GET"
      ? await handlers.GET(request, context)
      : await handlers.POST(request, context);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof ApiError
            ? error.message
            : "Account sign-in is temporarily unavailable.",
        code: error instanceof ApiError ? error.code : "auth_unavailable",
      },
      error instanceof ApiError ? error.status : 503,
    );
  }
}
