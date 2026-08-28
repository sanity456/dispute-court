"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectWallet,
  contractAddress,
  isLiveConfigured,
  readContract,
  writeContract,
} from "./genlayer";
import { record } from "./lifecycle";
import { TransactionError } from "./receipt";
import { productApi } from "./client";
import { recoverOutbox, saveSubmittedHash, walletRejected } from "./recovery";
import type { Intent } from "./activity-model";
export type Notice = {
  kind: "success" | "error" | "info";
  text: string;
  hash?: string;
} | null;
export type Preferences = {
  timezone: string;
  browserReminders: boolean;
  reminderMinutes: number;
  includeFixtures: boolean;
  analyticsConsent: boolean;
};
export type ProductSession = {
  signedIn: boolean;
  ownerVerified: boolean;
  preferences: Preferences;
  coreAddress: string;
  captureAddress: string;
  chainId: number;
};
export function useProtocol(listMethod: string) {
  const [wallet, setWallet] = useState("");
  const [items, setItems] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [credit, setCredit] = useState<string | null>(null);
  const [loading, setLoading] = useState(isLiveConfigured);
  const [error, setError] = useState("");
  const [creditError, setCreditError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(0);
  const [session, setSession] = useState<ProductSession | null>(null);
  const [sessionError, setSessionError] = useState("");
  const busyRef = useRef(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    void productApi<ProductSession>("session")
      .then((value) => {
        if (cancelled) return;
        setSession(value);
        setSessionError("");
        void recoverOutbox().then((result) => {
          if (!cancelled && result.pending)
            setNotice({
              kind: "info",
              text: "A transaction hash is saved on this device but has not reached your account history. Keep this page open or check Activity before repeating the action.",
            });
        });
      })
      .catch((failure) => {
        if (!cancelled) setSessionError(errorMessage(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  useEffect(() => {
    let cancelled = false;
    const task = window.setTimeout(async () => {
      if (!isLiveConfigured) return;
      setLoading(true);
      setError("");
      try {
        const [listing, statistics, configuration] = await Promise.all([
          readContract(listMethod, [0, 50]),
          readContract("get_stats"),
          readContract("get_config"),
        ]);
        if (cancelled) return;
        const result = record(listing);
        setItems(Array.isArray(result.items) ? result.items : []);
        setTotal(Number(result.total ?? 0));
        setStats(record(statistics));
        setConfig(record(configuration));
      } catch (failure) {
        if (!cancelled) setError(errorMessage(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(task);
    };
  }, [listMethod, revision]);
  useEffect(() => {
    let cancelled = false;
    const task = window.setTimeout(async () => {
      setCredit(null);
      setCreditError("");
      if (!wallet || !isLiveConfigured) return;
      try {
        const result = record(await readContract("get_credit", [wallet]));
        if (!cancelled) setCredit(String(result.credit_wei ?? "0"));
      } catch (failure) {
        if (!cancelled) setCreditError(errorMessage(failure));
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(task);
    };
  }, [wallet, revision]);
  useEffect(() => {
    const changed = (...args: unknown[]) => {
      setWallet(String((args[0] as string[])?.[0] ?? ""));
      setCredit(null);
    };
    const chainChanged = () => {
      setWallet("");
      setCredit(null);
      setNotice({
        kind: "info",
        text: "Network changed. Reconnect to confirm your Studionet account.",
      });
    };
    const provider = window.ethereum;
    provider?.on?.("accountsChanged", changed);
    provider?.on?.("chainChanged", chainChanged);
    let cancelled = false;
    if (provider)
      void Promise.all([
        provider.request({ method: "eth_accounts" }),
        provider.request({ method: "eth_chainId" }),
      ])
        .then(([accounts, chain]) => {
          const account = String((accounts as string[])?.[0] ?? "");
          if (
            !cancelled &&
            Number.parseInt(String(chain), 16) === 61999 &&
            /^0x[0-9a-fA-F]{40}$/.test(account)
          )
            setWallet(account);
        })
        .catch(() => {
          /* No permission prompt for restoring an existing connection. */
        });
    const timer = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      15000,
    );
    const initial = window.setTimeout(
      () => setNow(Math.floor(Date.now() / 1000)),
      0,
    );
    return () => {
      cancelled = true;
      provider?.removeListener?.("accountsChanged", changed);
      provider?.removeListener?.("chainChanged", chainChanged);
      window.clearInterval(timer);
      window.clearTimeout(initial);
    };
  }, []);
  async function connect() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("Connect wallet");
    try {
      setWallet(await connectWallet());
    } catch (failure) {
      setNotice({ kind: "error", text: errorMessage(failure) });
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }
  async function more() {
    if (loading || items.length >= total) return;
    setLoading(true);
    try {
      const result = record(await readContract(listMethod, [items.length, 50]));
      setItems((previous) => [
        ...previous,
        ...(Array.isArray(result.items) ? result.items : []),
      ]);
      setTotal(Number(result.total ?? total));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }
  async function transact(
    title: string,
    method: string,
    args: unknown[] = [],
    value = 0n,
    target = contractAddress,
  ) {
    if (busyRef.current || !isLiveConfigured) return false;
    busyRef.current = true;
    setBusy(title);
    let intent: Intent | undefined;
    let submittedHash = "";
    try {
      const account = wallet || (await connectWallet());
      setWallet(account);
      intent = await productApi<Intent>("intents", {
        wallet: account,
        target,
        method,
        args,
        value: value.toString(),
        title,
      });
      const intentId = intent.id;
      setNotice({
        kind: "info",
        text:
          title +
          ": request saved. Review the wallet confirmation. Never repeat a pending request.",
      });
      const hash = await writeContract(
        account,
        method,
        args,
        value,
        (progress) =>
          setNotice({
            kind: "info",
            text:
              title +
              ": " +
              progress.status.toLowerCase().replaceAll("_", " ") +
              ". Your hash is recorded in Activity.",
            hash: progress.hash,
          }),
        {
          target,
          onSubmitted: async (hash) => {
            submittedHash = hash;
            await saveSubmittedHash(intentId, hash);
          },
        },
      );
      const result = await productApi<Intent>(
        "intents/" + intentId + "/reconcile",
        {},
      );
      const delivered = result.transaction?.payout_state === "delivered";
      setNotice({
        kind: "success",
        hash,
        text:
          method === "withdraw"
            ? delivered
              ? "Payout delivered: the exact amount and recipient were verified in the finalized native transfer."
              : "Withdrawal executed and finalized. Activity will separately verify delivery; do not assume the transfer has arrived."
            : title + " executed successfully and finalized on Studionet.",
      });
      if (method !== "capture") refresh();
      return true;
    } catch (failure) {
      const hash =
        submittedHash ||
        (failure instanceof TransactionError ? failure.hash : undefined);
      if (intent) {
        if (hash) {
          try {
            await saveSubmittedHash(intent.id, hash);
          } catch {
            /* Recovery outbox retains the hash. */
          }
        } else {
          const rejected = walletRejected(failure);
          try {
            await productApi("intents/" + intent.id, {
              state: rejected ? "cancelled" : "review",
              confirmedUnsigned: rejected,
              error: errorMessage(failure).slice(0, 500),
            });
          } catch {
            /* Reserved intent stays visible for recovery. */
          }
        }
      }
      setNotice({
        kind: "error",
        text:
          errorMessage(failure) +
          (intent
            ? " Open Activity to review the saved request before submitting again."
            : ""),
        hash,
      });
      if (method !== "capture") refresh();
      return false;
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }
  return {
    wallet,
    items,
    total,
    stats,
    config,
    credit,
    loading,
    error,
    creditError,
    notice,
    busy,
    revision,
    now,
    session,
    sessionError,
    refresh,
    connect,
    more,
    transact,
    setNotice,
    ready:
      isLiveConfigured &&
      Boolean(session?.signedIn) &&
      Boolean(config) &&
      !error &&
      !loading,
  };
}
export type Protocol = ReturnType<typeof useProtocol>;
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
