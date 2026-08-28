"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { connectWallet, isLiveConfigured, readContract, writeContract } from "./genlayer";
import { record } from "./lifecycle";
import { TransactionError } from "./receipt";

export type Notice = { kind: "success" | "error" | "info"; text: string; hash?: string } | null;
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
  const busyRef = useRef(false);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const task = window.setTimeout(async () => {
      if (!isLiveConfigured) return;
      setLoading(true);
      setError("");
      try {
        const [listing, statistics, configuration] = await Promise.all([
          readContract(listMethod, [0, 50]), readContract("get_stats"), readContract("get_config"),
        ]);
        if (cancelled) return;
        const result = record(listing);
        setItems(Array.isArray(result.items) ? result.items : []);
        setTotal(Number(result.total ?? 0));
        setStats(record(statistics));
        setConfig(record(configuration));
      } catch (failure) {
        if (!cancelled) setError("Studionet data could not be refreshed. " + errorMessage(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(task); };
  }, [listMethod, revision]);

  useEffect(() => {
    let cancelled = false;
    const task = window.setTimeout(async () => {
      setCredit(null); setCreditError("");
      if (!wallet || !isLiveConfigured) return;
      try {
        const result = record(await readContract("get_credit", [wallet]));
        if (!cancelled) setCredit(String(result.credit_wei ?? "0"));
      } catch (failure) {
        if (!cancelled) setCreditError(errorMessage(failure));
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(task); };
  }, [wallet, revision]);

  useEffect(() => {
    const changed = (...args: unknown[]) => { setWallet(String((args[0] as string[])?.[0] ?? "")); setCredit(null); };
    const chainChanged = () => { setWallet(""); setCredit(null); setNotice({kind: "info", text: "Network changed. Reconnect to confirm your Studionet account."}); };
    window.ethereum?.on?.("accountsChanged", changed);
    window.ethereum?.on?.("chainChanged", chainChanged);
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 15000);
    const initial = window.setTimeout(() => setNow(Math.floor(Date.now() / 1000)), 0);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", changed);
      window.ethereum?.removeListener?.("chainChanged", chainChanged);
      window.clearInterval(timer); window.clearTimeout(initial);
    };
  }, []);

  async function connect() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy("Connect wallet");
    try { setWallet(await connectWallet()); }
    catch (failure) { setNotice({kind: "error", text: errorMessage(failure)}); }
    finally { busyRef.current = false; setBusy(""); }
  }
  async function more() {
    if (loading || items.length >= total) return;
    setLoading(true);
    try {
      const result = record(await readContract(listMethod, [items.length, 50]));
      setItems(previous => [...previous, ...(Array.isArray(result.items) ? result.items : [])]);
      setTotal(Number(result.total ?? total));
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setLoading(false); }
  }
  async function transact(title: string, method: string, args: unknown[] = [], value = 0n) {
    if (busyRef.current || !isLiveConfigured) return false;
    busyRef.current = true; setBusy(title);
    setNotice({kind: "info", text: title + ": confirm the request in your wallet."});
    try {
      const account = wallet || await connectWallet();
      setWallet(account);
      const hash = await writeContract(account, method, args, value, progress =>
        setNotice({kind: "info", text: title + ": " + progress.status.toLowerCase().replaceAll("_", " ") + ". Keep this transaction hash; do not submit again while it is pending.", hash: progress.hash}));
      setNotice({kind: "success", hash, text: method === "withdraw"
        ? "Withdrawal execution finalized. A payout was emitted; delivery of the child transfer still needs separate confirmation."
        : title + " executed successfully and finalized on Studionet."});
      refresh();
      return true;
    } catch (failure) {
      setNotice({kind: "error", text: errorMessage(failure), hash: failure instanceof TransactionError ? failure.hash : undefined});
      return false;
    } finally { busyRef.current = false; setBusy(""); }
  }
  return { wallet, items, total, stats, config, credit, loading, error, creditError, notice, busy, revision, now,
    refresh, connect, more, transact, setNotice, ready: isLiveConfigured && Boolean(config) && !error && !loading };
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
