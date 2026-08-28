import { createClient, chains } from "../vendor/genlayer-js/index.js";
import { TransactionHashVariant } from "../vendor/genlayer-js/types/index.js";
import deployment from "../lib/deployment.json" with { type: "json" };
import captureDeployment from "../lib/evidence-deployment.json" with { type: "json" };
import coreSchema from "../lib/contract-schema.json" with { type: "json" };
import { jsonString } from "../lib/activity-model.ts";
import {
  ApiError,
  address,
  parseLosslessJson,
  rateLimit,
  sha256,
  txHash,
} from "./security.ts";
import type { Database } from "./database-types";
import { recordRpcHealth } from "./health.ts";
export type MethodInfo = { readonly: boolean; params: unknown[] };
export type Network = {
  coreAddress: string;
  captureAddress: string;
  ownerAddress: string;
  methods(target: string): Record<string, MethodInfo>;
  read(method: string, args?: unknown[], target?: string): Promise<unknown>;
  transaction(hash: string): Promise<Record<string, unknown> | null>;
  invalidate(): Promise<void>;
};
const captureMethods: Record<string, MethodInfo> = {
  capture: { readonly: false, params: ["str", "str"] },
  get_capture: { readonly: true, params: ["str", "str"] },
  get_config: { readonly: true, params: [] },
};
const clients = new Map<string, ReturnType<typeof createClient>>();
const pendingReads = new Map<string, Promise<unknown>>();
export function createNetwork(db: Database): Network {
  const coreAddress = address(deployment.contractAddress),
    captureAddress = captureDeployment.contractAddress
      ? address(captureDeployment.contractAddress)
      : "";
  const client =
    clients.get(coreAddress) ??
    createClient({ chain: chains.studionet, endpoint: deployment.rpcUrl });
  clients.set(coreAddress, client);
  function methods(target: string) {
    if (target.toLowerCase() === coreAddress)
      return coreSchema.methods as Record<string, MethodInfo>;
    if (captureAddress && target.toLowerCase() === captureAddress)
      return captureMethods;
    throw new ApiError(400, "This contract does not belong to this product.");
  }
  async function budget() {
    await rateLimit(db, "rpc-minute", 48);
    await rateLimit(db, "rpc-hour", 900, 3600000);
  }
  async function cached(
    key: string,
    ttl: number,
    load: () => Promise<unknown>,
  ) {
    const row = await db
      .prepare("SELECT json FROM read_cache WHERE key=? AND expires_at>?")
      .bind(key, Date.now())
      .first<{ json: string }>();
    if (row) return JSON.parse(row.json);
    const pendingKey = coreAddress + ":" + key;
    let task = pendingReads.get(pendingKey);
    if (!task) {
      task = (async () => {
        await budget();
        let result: unknown;
        try {
          result = await load();
          await recordRpcHealth(db, true);
        } catch (error) {
          await recordRpcHealth(db, false);
          throw error;
        }
        await db
          .prepare(
            "INSERT INTO read_cache(key,json,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json,expires_at=excluded.expires_at",
          )
          .bind(key, jsonString(result), Date.now() + ttl)
          .run();
        return result;
      })().finally(() => pendingReads.delete(pendingKey));
      pendingReads.set(pendingKey, task);
    }
    return task;
  }
  async function verify() {
    const chain = await cached("chain-id", 3600000, () => client.getChainId());
    if (chain !== 61999)
      throw new ApiError(
        503,
        "The configured network is not Studionet. Writes are disabled.",
        "wrong_network",
      );
  }
  return {
    coreAddress,
    captureAddress,
    ownerAddress: address(deployment.ownerAddress),
    methods,
    async read(method, args = [], target = coreAddress) {
      const definition = methods(target)[method];
      if (!definition?.readonly || args.length !== definition.params.length)
        throw new ApiError(400, "Unsupported read method or argument count.");
      await verify();
      const key =
        "contract:" +
        target.toLowerCase() +
        ":" +
        (await sha256(jsonString([method, args])));
      // Studionet's contract lookup requires the original checksummed deployment address.
      const chainTarget =
        target.toLowerCase() === coreAddress
          ? deployment.contractAddress
          : captureDeployment.contractAddress;
      return cached(key, method === "get_capture" ? 86400000 : 15000, () =>
        client.readContract({
          address: chainTarget as `0x${string}`,
          functionName: method,
          args: args as never[],
          jsonSafeReturn: true,
          transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
        }),
      );
    },
    async transaction(hash) {
      txHash(hash);
      await verify();
      await budget();
      try {
        const response = await fetch(deployment.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionByHash",
            params: [hash],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new ApiError(
            503,
            "Studionet is not returning transaction data. The saved hash remains safe.",
            "rpc_unavailable",
          );
        const data = parseLosslessJson(await response.text()) as {
          result?: Record<string, unknown> | null;
          error?: { message?: string };
        };
        if (data.error)
          throw new ApiError(
            503,
            "Studionet could not look up this transaction yet.",
            "rpc_unavailable",
          );
        await recordRpcHealth(db, true);
        return data.result ?? null;
      } catch (error) {
        await recordRpcHealth(db, false);
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          503,
          "Studionet could not return a valid receipt. The saved hash remains safe.",
          "rpc_unavailable",
        );
      }
    },
    async invalidate() {
      await db
        .prepare(
          "DELETE FROM read_cache WHERE key LIKE 'contract:%' AND key NOT LIKE ?",
        )
        .bind("contract:" + captureAddress + ":%")
        .run();
    },
  };
}
