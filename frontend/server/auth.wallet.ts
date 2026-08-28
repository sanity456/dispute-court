import { getDb } from "./db.ts";
import { authenticateWallet, handleWalletAuth } from "./wallet-auth.ts";
import { jsonResponse } from "./security.ts";

export async function authenticate(request: Request) {
  return authenticateWallet(await getDb(), request);
}
export async function authRequest(request: Request) {
  try {
    return await handleWalletAuth(request, await getDb());
  } catch {
    return jsonResponse(
      {
        error: "Wallet sign-in is temporarily unavailable. Try again.",
        code: "auth_unavailable",
      },
      503,
    );
  }
}
