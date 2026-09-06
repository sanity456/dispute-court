"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  contractAddress,
  isLiveConfigured,
  readContract,
  writeContract,
} from "./genlayer";
import { record } from "./lifecycle";
import { TransactionError } from "./receipt";
import { productApi, setExpectedWallet, SESSION_INVALID_EVENT } from "./client";
import {
  loginWithWallet,
  logoutWallet,
  isWalletLoginPending,
  subscribeToWalletSession,
  walletAuthApi,
} from "./wallet-auth-client";
import { assertLoginWallet } from "./wallet-login";
import type { WalletSession } from "./wallet-auth-policy";
import {
  recoverOutbox,
  saveSubmittedHash,
  userFacingError,
  walletRejected,
} from "./recovery";
import type { Intent } from "./activity-model";
import { isRecoveryMethod, isSecurityRelease } from "./release-policy";
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
  wallet: string;
  authMethod: "wallet";
  expiresAt?: number;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creditError, setCreditError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(0);
  const [session, setSession] = useState<ProductSession | null>(null);
  const [sessionError, setSessionError] = useState("");
  const busyRef = useRef(false);
  const identityEpoch = useRef(0);
  const sessionReasonRef = useRef("");
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const clearAccount = useCallback(() => {
    identityEpoch.current++;
    setExpectedWallet("");
    setSession(null);
    setWallet("");
    setItems([]);
    setTotal(0);
    setStats(null);
    setConfig(null);
    setCredit(null);
    setCreditError("");
    setError("");
    setLoading(false);
    setNotice(null);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const epoch = identityEpoch.current;
    const stale = () => cancelled || epoch !== identityEpoch.current;
    void (async () => {
      const auth = await walletAuthApi<WalletSession>("session");
      if (stale()) return;
      if (!auth.authenticated || !auth.wallet) {
        clearAccount();
        setSessionError(sessionReasonRef.current || "Sign in to continue.");
        return;
      }
      if (window.ethereum) {
        try {
          await assertLoginWallet(window.ethereum, auth.wallet);
        } catch {
          if (stale()) return;
          clearAccount();
          sessionReasonRef.current =
            "Wallet or network changed. Sign in again to continue.";
          setSessionError(sessionReasonRef.current);
          if (!isWalletLoginPending()) await logoutWallet();
          return;
        }
      }
      if (stale()) return;
      setExpectedWallet(auth.wallet);
      const value = await productApi<ProductSession>("session");
      if (stale()) return;
      value.expiresAt = auth.expiresAt;
      setSession(value);
      setWallet(window.ethereum ? value.wallet : "");
      sessionReasonRef.current = "";
      setSessionError("");
      void recoverOutbox(value.wallet).then((result) => {
        if (!stale() && result.pending)
          setNotice({
            kind: "info",
            text: "A transaction hash is saved on this device but has not reached your account history. Keep this page open or check Activity before repeating the action.",
          });
      });
    })().catch((failure) => {
      if (!stale()) {
        clearAccount();
        setSessionError(errorMessage(failure));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [revision, clearAccount]);
  useEffect(() => {
    let cancelled = false;
    const task = window.setTimeout(async () => {
      if (!isLiveConfigured || !session?.signedIn) return;
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
  }, [listMethod, revision, session?.signedIn, session?.wallet]);
  useEffect(() => {
    let cancelled = false;
    const task = window.setTimeout(async () => {
      setCredit(null);
      setCreditError("");
      if (!wallet || !isLiveConfigured || session?.wallet !== wallet) return;
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
  }, [wallet, revision, session?.wallet]);
  useEffect(() => {
    const changed = () => {
      sessionReasonRef.current =
        "Wallet or network changed. Sign in again to continue.";
      clearAccount();
      setSessionError(sessionReasonRef.current);
      if (!isWalletLoginPending())
        void logoutWallet().catch((failure) =>
          setSessionError(
            "Could not end the old session: " + errorMessage(failure),
          ),
        );
    };
    const invalid = () => {
      sessionReasonRef.current ||=
        "Your wallet session ended or changed. Sign in again to continue.";
      clearAccount();
      setSessionError(sessionReasonRef.current);
    };
    const updated = () => {
      clearAccount();
      refresh();
    };
    const unsubscribe = subscribeToWalletSession(updated);
    window.addEventListener(SESSION_INVALID_EVENT, invalid);
    const focused = () => {
      if (!isWalletLoginPending()) refresh();
    };
    window.addEventListener("focus", focused);
    const visible = () => {
      if (document.visibilityState === "visible" && !isWalletLoginPending())
        refresh();
    };
    document.addEventListener("visibilitychange", visible);
    const provider = window.ethereum;
    provider?.on?.("accountsChanged", changed);
    provider?.on?.("chainChanged", changed);
    provider?.on?.("disconnect", changed);
    const timer = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      15000,
    );
    const initial = window.setTimeout(
      () => setNow(Math.floor(Date.now() / 1000)),
      0,
    );
    return () => {
      unsubscribe();
      window.removeEventListener(SESSION_INVALID_EVENT, invalid);
      window.removeEventListener("focus", focused);
      document.removeEventListener("visibilitychange", visible);
      provider?.removeListener?.("accountsChanged", changed);
      provider?.removeListener?.("chainChanged", changed);
      provider?.removeListener?.("disconnect", changed);
      window.clearInterval(timer);
      window.clearTimeout(initial);
    };
  }, [clearAccount, refresh]);
  useEffect(() => {
    if (!session?.expiresAt) return;
    const timer = window.setTimeout(
      () => {
        sessionReasonRef.current =
          "Your wallet session expired. Sign in again to continue.";
        clearAccount();
        setSessionError(sessionReasonRef.current);
      },
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session?.expiresAt, clearAccount]);
  async function connect() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy("Sign in with wallet");
    sessionReasonRef.current = "";
    setSessionError("");
    try {
      await loginWithWallet();
      refresh();
    } catch (failure) {
      setNotice({ kind: "error", text: errorMessage(failure) });
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }
  async function more() {
    if (loading || items.length >= total) return;
    const epoch = identityEpoch.current;
    setLoading(true);
    try {
      const result = record(await readContract(listMethod, [items.length, 50]));
      if (epoch !== identityEpoch.current) return;
      setItems((previous) => [
        ...previous,
        ...(Array.isArray(result.items) ? result.items : []),
      ]);
      setTotal(Number(result.total ?? total));
    } catch (failure) {
      if (epoch === identityEpoch.current) setError(errorMessage(failure));
    } finally {
      if (epoch === identityEpoch.current) setLoading(false);
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
    const epoch = identityEpoch.current;
    const current = () => epoch === identityEpoch.current;
    try {
      const account = wallet;
      if (
        !session?.signedIn ||
        !account ||
        account !== session.wallet ||
        !window.ethereum
      )
        throw new Error(
          "Sign in with your wallet before submitting this action.",
        );
      if (
        !isSecurityRelease(config) &&
        !(
          target.toLowerCase() === contractAddress.toLowerCase() &&
          isRecoveryMethod(method)
        )
      )
        throw new Error(
          "Security update pending. New commitments are paused; existing-fund recovery remains available.",
        );
      await assertLoginWallet(window.ethereum, account);
      await productApi<ProductSession>("session");
      if (!current())
        throw new Error(
          "Your wallet changed. Sign in again before submitting.",
        );
      intent = await productApi<Intent>("intents", {
        wallet: account,
        target,
        method,
        args,
        value: value.toString(),
        title,
      });
      const intentId = intent.id;
      if (!current())
        throw new Error(
          "Your wallet changed before approval. Review the saved request before retrying.",
        );
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
          current() &&
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
            await saveSubmittedHash(intentId, hash, account);
          },
        },
      );
      const result = await productApi<Intent>(
        "intents/" + intentId + "/reconcile",
        {},
      );
      const delivered = result.transaction?.payout_state === "delivered";
      if (current())
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
      if (current() && method !== "capture") refresh();
      return current();
    } catch (failure) {
      const hash =
        submittedHash ||
        (failure instanceof TransactionError ? failure.hash : undefined);
      if (intent) {
        if (hash) {
          try {
            await saveSubmittedHash(intent.id, hash, intent.wallet);
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
      if (current())
        setNotice({
          kind: "error",
          text:
            errorMessage(failure) +
            (intent
              ? " Open Activity to review the saved request before submitting again."
              : ""),
          hash,
        });
      if (current() && method !== "capture") refresh();
      return false;
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }
  return {
    wallet,
    securityUpdateNeeded: Boolean(config) && !isSecurityRelease(config),
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
      Boolean(wallet && wallet === session?.wallet) &&
      Boolean(config) &&
      !error &&
      !loading,
  };
}
export type Protocol = ReturnType<typeof useProtocol>;
export function errorMessage(error: unknown) {
  return userFacingError(error);
}
