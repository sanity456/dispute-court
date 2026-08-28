import { jsonString } from "./activity-model.ts";
export const SESSION_INVALID_EVENT = "product-wallet-session-invalid";
let expectedWallet = "";
let identityVersion = 0;
export function setExpectedWallet(wallet: string) {
  if (expectedWallet === wallet.toLowerCase()) return;
  expectedWallet = wallet.toLowerCase();
  identityVersion++;
}
export class ProductApiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;
  constructor(
    message: string,
    code: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
export async function productApi<T = Record<string, unknown>>(
  path: string,
  input?: unknown,
): Promise<T> {
  const version = identityVersion;
  const wallet = expectedWallet;
  const response = await fetch("/api/product/" + path, {
    method: input === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(wallet ? { "X-Product-Wallet": wallet } : {}),
      ...(input === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(input === undefined
      ? {}
      : {
          body: jsonString(input),
        }),
    signal: AbortSignal.timeout(45000),
  });
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new ProductApiError(
      "The service returned an unreadable response. Check Activity before repeating a wallet action.",
      "invalid_response",
      response.status,
    );
  }
  if (version !== identityVersion)
    throw new ProductApiError(
      "The active wallet changed. Refresh this view before continuing.",
      "wallet_session_changed",
      409,
    );
  if (!response.ok || data.error) {
    if (
      (response.status === 401 || data.code === "wallet_session_changed") &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event(SESSION_INVALID_EVENT));
    throw new ProductApiError(
      String(data.error ?? "Request failed."),
      String(data.code ?? "request_failed"),
      response.status,
      data,
    );
  }
  return data as T;
}
