import { stringToHex } from "viem";
import { assertWalletAccount, type WalletProvider } from "./wallet.ts";
import {
  CHALLENGE_TTL_MS,
  SESSION_TTL_MS,
  WALLET_CHAIN_ID,
  walletLoginMessage,
  type AuthProduct,
  type WalletChallenge,
  type WalletSession,
} from "./wallet-auth-policy.ts";
import { product } from "./product.ts";

export async function assertLoginWallet(
  provider: WalletProvider,
  wallet: string,
) {
  await assertWalletAccount(provider, wallet);
  const chain = await provider.request({ method: "eth_chainId" });
  if (Number(chain) !== WALLET_CHAIN_ID)
    throw new Error(
      "Switch your wallet to GenLayer Studionet, then sign in again.",
    );
}
export function validateLoginChallenge(
  challenge: WalletChallenge,
  wallet: string,
  origin: string,
  app: AuthProduct = product,
  now = Date.now(),
) {
  if (
    !challenge ||
    !/^[a-f0-9]{64}$/.test(challenge.id) ||
    challenge.wallet !== wallet.toLowerCase() ||
    challenge.chainId !== WALLET_CHAIN_ID ||
    !Number.isSafeInteger(challenge.issuedAt) ||
    !Number.isSafeInteger(challenge.expiresAt) ||
    challenge.issuedAt > now + 30000 ||
    challenge.expiresAt <= now ||
    challenge.expiresAt - challenge.issuedAt !== CHALLENGE_TTL_MS ||
    challenge.message !==
      walletLoginMessage(
        {
          wallet,
          origin,
          nonce: challenge.id,
          issuedAt: challenge.issuedAt,
          expiresAt: challenge.expiresAt,
        },
        app,
      )
  )
    throw new Error(
      "The wallet sign-in message could not be verified. Nothing was signed. Refresh and try again.",
    );
}
export async function signWalletLogin(
  provider: WalletProvider,
  wallet: string,
  origin: string,
  api: <T>(path: string, input?: unknown) => Promise<T>,
  app: AuthProduct = product,
) {
  await assertLoginWallet(provider, wallet);
  const challenge = await api<WalletChallenge>("challenge", {
    wallet,
    chainId: WALLET_CHAIN_ID,
  });
  validateLoginChallenge(challenge, wallet, origin, app);
  await assertLoginWallet(provider, wallet);
  const signature = await provider.request({
    method: "personal_sign",
    params: [stringToHex(challenge.message), wallet],
  });
  await assertLoginWallet(provider, wallet);
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature))
    throw new Error(
      "Your wallet did not return a supported login signature. Use a browser wallet account.",
    );
  const session = await api<WalletSession>("verify", {
    id: challenge.id,
    signature,
  });
  if (
    !session.authenticated ||
    session.wallet !== wallet.toLowerCase() ||
    session.chainId !== WALLET_CHAIN_ID ||
    !session.expiresAt ||
    session.expiresAt <= Date.now() ||
    session.expiresAt > Date.now() + SESSION_TTL_MS + 30000
  )
    throw new Error(
      "Your wallet session could not be verified. Try signing in again.",
    );
  await assertLoginWallet(provider, wallet);
  return session;
}
