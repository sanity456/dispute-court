import { createSiweMessage } from "viem/siwe";
import { product } from "./product.ts";

export const WALLET_CHAIN_ID = 61999;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export type AuthProduct = Pick<typeof product, "id" | "name">;

export function walletUserId(wallet: string, app: AuthProduct = product) {
  return `wallet:${app.id}:${WALLET_CHAIN_ID}:${wallet.toLowerCase()}`;
}
export function walletFromUserId(userId: string, app: AuthProduct = product) {
  const prefix = `wallet:${app.id}:${WALLET_CHAIN_ID}:`;
  const wallet = userId.startsWith(prefix) ? userId.slice(prefix.length) : "";
  return /^0x[0-9a-f]{40}$/.test(wallet) && !/^0x0{40}$/.test(wallet)
    ? wallet
    : null;
}
export function walletLoginMessage(
  input: {
    wallet: string;
    origin: string;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
  },
  app: AuthProduct = product,
) {
  const url = new URL(input.origin);
  return createSiweMessage({
    address: input.wallet as `0x${string}`,
    chainId: WALLET_CHAIN_ID,
    domain: url.host,
    scheme: url.protocol.slice(0, -1),
    uri: url.origin + "/",
    version: "1",
    nonce: input.nonce,
    issuedAt: new Date(input.issuedAt),
    expirationTime: new Date(input.expiresAt),
    requestId: app.id,
    statement: `Sign in to ${app.name}. This is a login only; it does not authorize transactions or transfers.`,
  });
}
export type WalletChallenge = {
  id: string;
  message: string;
  wallet: string;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
};
export type WalletSession = {
  authenticated: boolean;
  wallet?: string;
  chainId?: number;
  expiresAt?: number;
};
