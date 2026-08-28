"use client";
import { connectWallet } from "./genlayer";
import { ProductApiError, setExpectedWallet } from "./client";
import { signWalletLogin, assertLoginWallet } from "./wallet-login";
import { product } from "./product";
import { WALLET_CHAIN_ID, type WalletSession } from "./wallet-auth-policy";

export const WALLET_SESSION_EVENT = "product-wallet-session-changed";
let loggingIn = false;
let pendingLogout: Promise<void> = Promise.resolve();
let pendingLogin: Promise<WalletSession> | null = null;
export function isWalletLoginPending() {
  return loggingIn;
}
export async function walletAuthApi<T = WalletSession>(
  path: string,
  input?: unknown,
): Promise<T> {
  const response = await fetch("/api/auth/" + path, {
    method: input === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    ...(input === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
    signal: AbortSignal.timeout(30000),
  });
  let data: Record<string, unknown>;
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    data = value as Record<string, unknown>;
  } catch {
    throw new Error(
      "Wallet sign-in returned an unreadable response. Try again.",
    );
  }
  if (!response.ok || data.error)
    throw new ProductApiError(
      String(data.error ?? "Wallet sign-in failed."),
      String(data.code ?? "auth_unavailable"),
      response.status,
    );
  return data as T;
}
function announceSessionChange() {
  window.dispatchEvent(new Event(WALLET_SESSION_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("wallet-auth:" + product.id);
    channel.postMessage("changed");
    channel.close();
  }
}
export function subscribeToWalletSession(listener: () => void) {
  window.addEventListener(WALLET_SESSION_EVENT, listener);
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("wallet-auth:" + product.id);
  if (channel) channel.onmessage = listener;
  return () => {
    window.removeEventListener(WALLET_SESSION_EVENT, listener);
    channel?.close();
  };
}
export function logoutWallet() {
  setExpectedWallet("");
  // Serialize logout with the next sign-in so an older response cannot erase its cookie.
  pendingLogout = pendingLogout
    .catch(() => {})
    .then(async () => {
      await walletAuthApi("logout", {});
      announceSessionChange();
    });
  return pendingLogout;
}
export function loginWithWallet(): Promise<WalletSession> {
  if (pendingLogin) return pendingLogin;
  loggingIn = true;
  pendingLogin = (async () => {
    await pendingLogout.catch(() => logoutWallet());
    const wallet = (await connectWallet()).toLowerCase();
    const provider = window.ethereum;
    if (!provider)
      throw new Error(
        "Open this product in a browser with a compatible wallet.",
      );
    await assertLoginWallet(provider, wallet);
    const current = await walletAuthApi<WalletSession>("session");
    let session: WalletSession;
    if (
      current.authenticated &&
      current.wallet === wallet &&
      current.chainId === WALLET_CHAIN_ID
    ) {
      session = current;
    } else {
      try {
        session = await signWalletLogin(
          provider,
          wallet,
          window.location.origin,
          walletAuthApi,
        );
      } catch (error) {
        // A verify response can be lost after its cookie was set. Revoke it before retrying.
        await logoutWallet();
        throw error;
      }
    }
    try {
      await assertLoginWallet(provider, wallet);
    } catch (error) {
      await logoutWallet();
      throw error;
    }
    setExpectedWallet(wallet);
    announceSessionChange();
    return session;
  })().finally(() => {
    loggingIn = false;
    pendingLogin = null;
  });
  return pendingLogin;
}
