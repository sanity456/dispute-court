import { parseUnits } from "viem";
import { chains, createClient } from "../vendor/genlayer-js/index.js";

export const contractAddress = String(
  process.env.NEXT_PUBLIC_DISPUTE_COURT_ADDRESS ?? "",
).trim();
export const rpcUrl = String(
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "",
).trim();
export const isLiveConfigured =
  /^0x[0-9a-fA-F]{40}$/.test(contractAddress) && /^https?:\/\//.test(rpcUrl);

const chainIdHex = "0xf22f";
let readClient: ReturnType<typeof createClient> | null = null;

function provider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No compatible browser wallet was found.");
  }
  return window.ethereum;
}

async function ensureNetwork() {
  const wallet = provider();
  try {
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    const code = Number((error as { code?: number }).code ?? 0);
    if (code !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: "GenLayer Studio Network",
          rpcUrls: [rpcUrl || "https://studio.genlayer.com/api"],
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        },
      ],
    });
  }
}

export async function connectWallet() {
  const accounts = (await provider().request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = String(accounts?.[0] ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(account)) {
    throw new Error("The wallet did not return a valid account.");
  }
  if (isLiveConfigured) await ensureNetwork();
  return account;
}

export async function readContract(functionName: string, args: unknown[] = []) {
  if (!isLiveConfigured) throw new Error("Live contract configuration is missing.");
  readClient ??= createClient({ chain: chains.studionet, endpoint: rpcUrl });
  return readClient.readContract({
    address: contractAddress as `0x${string}`,
    functionName,
    args: args as never[],
    jsonSafeReturn: true,
  });
}

export async function writeContract(
  account: string,
  functionName: string,
  args: unknown[] = [],
  value = 0n,
) {
  if (!isLiveConfigured) {
    throw new Error(
      "Preview mode cannot submit transactions. Configure the RPC URL and DisputeCourtV2 address first.",
    );
  }
  await ensureNetwork();
  const client = createClient({
    chain: chains.studionet,
    endpoint: rpcUrl,
    account: account as `0x${string}`,
    provider: provider(),
  });
  const hash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName,
    args: args as never[],
    value,
    consensusMaxRotations: 5,
  });
  await client.waitForTransactionReceipt({
    hash,
    status: "FINALIZED" as never,
    interval: 3000,
    retries: 100,
  });
  return String(hash);
}

export function parseGen(value: string) {
  return parseUnits(value || "0", 18);
}

export function formatGen(value: string | number | bigint) {
  const amount = BigInt(value || 0);
  const whole = amount / 10n ** 18n;
  const fraction = (amount % 10n ** 18n).toString().padStart(18, "0").slice(0, 2);
  return fraction === "00" ? `${whole}` : `${whole}.${fraction}`;
}

export function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

export async function digestText(value: string) {
  const bytes = new TextEncoder().encode(value.replace(/\s+/g, " ").trim());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
