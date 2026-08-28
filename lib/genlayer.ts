import { chains, createClient } from "../vendor/genlayer-js/index.js";
import { TransactionHashVariant } from "../vendor/genlayer-js/types/index.js";
import deployment from "./deployment.json";
import { waitForFinalizedTransaction, type TransactionProgress } from "./receipt";
export { parseGen, formatGen } from "./amounts";

export const contractAddress = String(process.env.NEXT_PUBLIC_DISPUTE_COURT_ADDRESS ?? deployment.contractAddress).trim();
export const rpcUrl = String(process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? deployment.rpcUrl).trim();
export const networkName = "GenLayer Studionet";
export const isLiveConfigured = /^0x[0-9a-fA-F]{40}$/.test(contractAddress)
  && !/^0x0{40}$/i.test(contractAddress) && /^https?:\/\//.test(rpcUrl);
const chainId = 61999;
const chainIdHex = "0xf22f";
let readClient: ReturnType<typeof createClient> | null = null;
let verifiedRpc: Promise<void> | null = null;

function getReadClient() {
  readClient ??= createClient({ chain: chains.studionet, endpoint: rpcUrl });
  return readClient;
}

function provider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Open this product in a browser with a compatible Ethereum wallet to sign Studionet actions.");
  }
  return window.ethereum;
}

async function verifyRpc() {
  if (!isLiveConfigured) throw new Error("The Dispute Court Studionet deployment is not configured.");
  verifiedRpc ??= getReadClient().getChainId().then(id => {
    if (id !== chainId) throw new Error("The configured RPC is not GenLayer Studionet. No transaction was sent.");
  }).catch(error => { verifiedRpc = null; throw error; });
  await verifiedRpc;
}

async function ensureNetwork() {
  await verifyRpc();
  const wallet = provider();
  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (error) {
    const code = Number((error as { code?: number }).code ?? 0);
    if (code !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: chainIdHex, chainName: networkName, rpcUrls: [rpcUrl], nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 } }],
    });
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  }
  const connectedChain = await wallet.request({ method: "eth_chainId" });
  if (Number.parseInt(String(connectedChain), 16) !== chainId) {
    throw new Error("Switch your wallet to GenLayer Studionet before continuing.");
  }
}

export async function connectWallet() {
  const accounts = await provider().request({ method: "eth_requestAccounts" }) as string[];
  const account = String(accounts?.[0] ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(account)) throw new Error("The wallet did not return a valid account.");
  if (isLiveConfigured) await ensureNetwork();
  return account;
}

export async function readContract(functionName: string, args: unknown[] = []) {
  await verifyRpc();
  return getReadClient().readContract({
    address: contractAddress as `0x${string}`,
    functionName,
    args: args as never[],
    jsonSafeReturn: true,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
}

export async function writeContract(
  account: string,
  functionName: string,
  args: unknown[] = [],
  value = 0n,
  onProgress?: (progress: TransactionProgress) => void,
) {
  if (!isLiveConfigured) throw new Error("Preview mode cannot submit transactions. The Studionet deployment must be configured first.");
  await ensureNetwork();
  const accounts = await provider().request({ method: "eth_accounts" }) as string[];
  if (String(accounts[0] ?? "").toLowerCase() !== account.toLowerCase()) {
    throw new Error("The active wallet changed. Reconnect before submitting.");
  }
  const client = createClient({ chain: chains.studionet, endpoint: rpcUrl, account: account as `0x${string}`, provider: provider() });
  const hash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName,
    args: args as never[],
    value,
    leaderOnly: false,
    consensusMaxRotations: 5,
  });
  onProgress?.({ hash: String(hash), status: "SUBMITTED" });
  await waitForFinalizedTransaction(String(hash), () => getReadClient().getTransaction({ hash }), { onProgress });
  return String(hash);
}

export function shortAddress(value: string) {
  return value.length > 12 ? value.slice(0, 6) + "…" + value.slice(-4) : value;
}

export async function digestText(value: string) {
  const bytes = new TextEncoder().encode(value.replace(/\s+/g, " ").trim());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
