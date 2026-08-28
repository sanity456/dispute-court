import { ensureStudionet, assertWalletAccount } from "./wallet";
import { getAddress } from "viem";
import { productApi } from "./client";
import { evidenceDigest } from "./evidence";
import deployment from "./deployment.json";
import {
  waitForFinalizedTransaction,
  type TransactionProgress,
} from "./receipt";
export { parseGen, formatGen } from "./amounts";

export const contractAddress = String(
  process.env.NEXT_PUBLIC_DISPUTE_COURT_ADDRESS ?? deployment.contractAddress,
).trim();
export const rpcUrl = String(
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? deployment.rpcUrl,
).trim();
export const networkName = "GenLayer Studionet";
export const isLiveConfigured =
  /^0x[0-9a-fA-F]{40}$/.test(contractAddress) &&
  !/^0x0{40}$/i.test(contractAddress) &&
  /^https?:\/\//.test(rpcUrl);
const chainId = 61999;
type Client = ReturnType<
  (typeof import("../vendor/genlayer-js/index.js"))["createClient"]
>;
let readClient: Client | null = null;
let sdk: Promise<typeof import("../vendor/genlayer-js/index.js")> | null = null;
function walletSdk() {
  return (sdk ??= import("../vendor/genlayer-js/index.js"));
}
let verifiedRpc: Promise<void> | null = null;

async function getReadClient() {
  const { createClient, chains } = await walletSdk();
  readClient ??= createClient({ chain: chains.studionet, endpoint: rpcUrl });
  return readClient;
}

function provider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error(
      "Open this product in a browser with a compatible Ethereum wallet to sign Studionet actions.",
    );
  }
  return window.ethereum;
}

async function verifyRpc() {
  if (!isLiveConfigured)
    throw new Error(
      "The Dispute Court Studionet deployment is not configured.",
    );
  verifiedRpc ??= getReadClient()
    .then((client) => client.getChainId())
    .then((id) => {
      if (id !== chainId)
        throw new Error(
          "The configured RPC is not GenLayer Studionet. No transaction was sent.",
        );
    })
    .catch((error) => {
      verifiedRpc = null;
      throw error;
    });
  await verifiedRpc;
}

async function ensureNetwork() {
  await ensureStudionet(provider(), rpcUrl, verifyRpc);
}

export async function connectWallet() {
  const accounts = (await provider().request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = String(accounts?.[0] ?? "");
  if (!/^0x[0-9a-fA-F]{40}$/.test(account))
    throw new Error("The wallet did not return a valid account.");
  if (isLiveConfigured) await ensureNetwork();
  return account;
}

export async function readContract(functionName: string, args: unknown[] = []) {
  return readContractAt(contractAddress, functionName, args);
}
export async function readContractAt(
  target: string,
  functionName: string,
  args: unknown[] = [],
) {
  const result = await productApi<{ value: unknown }>("read", {
    target,
    method: functionName,
    args,
  });
  return result.value;
}

export async function writeContract(
  account: string,
  functionName: string,
  args: unknown[] = [],
  value = 0n,
  onProgress?: (progress: TransactionProgress) => void,
  options: {
    target?: string;
    onSubmitted?: (hash: string) => Promise<void>;
  } = {},
) {
  if (!isLiveConfigured)
    throw new Error(
      "Preview mode cannot submit transactions. The Studionet deployment must be configured first.",
    );
  await ensureNetwork();
  await assertWalletAccount(provider(), account);
  const { createClient, chains } = await walletSdk();
  const client = createClient({
    chain: chains.studionet,
    endpoint: rpcUrl,
    account: account as `0x${string}`,
    provider: provider(),
  });
  const hash = await client.writeContract({
    address: getAddress(options.target ?? contractAddress),
    functionName,
    args: args as never[],
    value,
    leaderOnly: false,
    consensusMaxRotations: 5,
  });
  await options.onSubmitted?.(String(hash));
  onProgress?.({ hash: String(hash), status: "SUBMITTED" });
  await waitForFinalizedTransaction(
    String(hash),
    async () => (await getReadClient()).getTransaction({ hash }),
    { onProgress },
  );
  return String(hash);
}

export function shortAddress(value: string) {
  return value.length > 12 ? value.slice(0, 6) + "…" + value.slice(-4) : value;
}

export async function digestText(value: string) {
  return evidenceDigest(value);
}
