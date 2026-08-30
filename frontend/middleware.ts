import { NextResponse, type NextRequest } from "next/server";
import {
  contentSecurityPolicy,
  createCspNonce,
  documentSecurityHeaders,
} from "./server/document-security.ts";

export function middleware(request: NextRequest) {
  const nonce = createCspNonce();
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV !== "production",
  );
  const headers = new Headers(request.headers);
  // Overwrite untrusted incoming values before the renderer extracts its nonce.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  for (const { key, value } of documentSecurityHeaders)
    response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static/|_next/image|favicon|og.png).*)"],
};
