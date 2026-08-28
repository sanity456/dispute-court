"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { productApi } from "../lib/client";
import { product } from "../lib/product";
import { nextStep, formatDeadline } from "../lib/reminders";
import { formatGen, shortAddress } from "../lib/genlayer";
import { errorMessage, type Protocol } from "../lib/useProtocol";
type Coverage = {
  indexed: number;
  total: number;
  complete: boolean;
  membershipPending: number;
  updatedAt: number;
};
type Result = {
  items: Record<string, unknown>[];
  total: number;
  offset: number;
  coverage: Coverage;
};
function participantOf(r: Record<string, unknown>) {
  const viewer = r.viewer as
    { role: string; data: Record<string, unknown> } | undefined;
  return viewer?.role === "participant" ? viewer.data : null;
}
export function DirectoryPanel({
  protocol,
  onOpen,
  onlyMine = false,
}: {
  protocol: Protocol;
  onOpen: (id: string) => void;
  onlyMine?: boolean;
}) {
  const [draft, setDraft] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [mine, setMine] = useState(onlyMine);
  const [offset, setOffset] = useState(0),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const [indexRevision, setIndexRevision] = useState(0);
  const requests = useRef({ version: 0 });
  const load = useCallback(async () => {
    const version = ++requests.current.version;
    if (!protocol.session?.signedIn) return;
    if (mine && !protocol.wallet) {
      setResult(null);
      return;
    }
    const params = new URLSearchParams({
      q: query,
      status,
      offset: String(offset),
    });
    if (mine) params.set("wallet", protocol.wallet);
    const next = await productApi<Result>("directory?" + params);
    if (version === requests.current.version) setResult(next);
  }, [
    query,
    status,
    offset,
    mine,
    protocol.wallet,
    protocol.session?.signedIn,
  ]);
  useEffect(() => {
    const requestState = requests.current;
    let stopped = false;
    const task = window.setTimeout(() => {
      void load().catch((e) => {
        if (!stopped) setError(errorMessage(e));
      });
    }, 0);
    return () => {
      stopped = true;
      requestState.version++;
      window.clearTimeout(task);
    };
  }, [load, protocol.revision, indexRevision]);
  useEffect(() => {
    if (!protocol.session?.signedIn) return;
    let stopped = false;
    void productApi("directory/sync", {})
      .then(() => {
        if (!stopped) setIndexRevision((value) => value + 1);
      })
      .catch((e) => {
        if (!stopped) setError(errorMessage(e));
      });
    return () => {
      stopped = true;
    };
    // One bounded indexing pass on entry, not on every filter keystroke.
  }, [protocol.session?.signedIn]);
  async function sync() {
    setWorking(true);
    setError("");
    try {
      await productApi("directory/sync", {});
      setIndexRevision((value) => value + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  const statuses =
    product.id === "commitment-pools"
      ? ["forming", "active", "refunding", "settled", "cancelled"]
      : [
          "awaiting_acceptance",
          "awaiting_funding",
          "funded",
          "awaiting_response",
          "evidence",
          "ready_for_resolution",
          "resolution_stalled",
          "resolved",
          "cancelled",
        ];
  return (
    <div className="product-stack">
      <div className="product-toolbar">
        <div>
          <p className="product-kicker">
            {onlyMine ? "Wallet workspace" : "Search the public directory"}
          </p>
          <h2>
            {onlyMine ? "The work connected to you." : "Find the right record."}
          </h2>
        </div>
        <button
          className="product-button-secondary"
          disabled={working || !protocol.session?.signedIn}
          onClick={() => void sync()}
        >
          {working ? "Refreshing index…" : "Refresh directory"}
        </button>
      </div>
      <form
        className="product-filter-grid"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft);
          setOffset(0);
          setError("");
        }}
      >
        <label className="product-field">
          <span>Search title or ID</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={120}
            placeholder={
              onlyMine ? "Search your work" : "Search public records"
            }
          />
        </label>
        <label className="product-field">
          <span>Stage</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Every stage</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button className="product-button self-end" type="submit">
          Search
        </button>
      </form>
      {!onlyMine && (
        <label className="product-check">
          <input
            type="checkbox"
            disabled={!protocol.wallet}
            checked={mine}
            onChange={(e) => {
              setMine(e.target.checked);
              setOffset(0);
            }}
          />
          <span>Only records linked to my connected wallet</span>
        </label>
      )}
      {mine && !protocol.wallet && (
        <div className="product-panel">
          <h3>Connect to find your work</h3>
          <p className="product-muted">
            Wallet addresses are matched against public creator, participant or
            party records. Connecting does not move funds.
          </p>
          <button
            className="product-button"
            disabled={Boolean(protocol.busy)}
            onClick={() => void protocol.connect()}
          >
            Connect wallet
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="product-error">
          {error}
        </p>
      )}
      {result && (
        <p className="product-muted">
          {result.total} matching records · indexed {result.coverage.indexed}/
          {result.coverage.total}.{" "}
          {!result.coverage.complete
            ? "Index coverage is still partial; refresh to continue. Open a shared ID directly if it is missing."
            : "Coverage reflects the last index refresh, not every blockchain transaction."}{" "}
          Test fixtures are{" "}
          {protocol.session?.preferences.includeFixtures
            ? "included"
            : "hidden"}
          ; change this in Help & settings.
        </p>
      )}
      {result && !result.items.length && (
        <div className="product-panel">
          <h3>No matching records</h3>
          <p className="product-muted">
            Try another filter, refresh the index, or open an invitation by its
            ID. No sample records are presented as user activity.
          </p>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {result?.items.map((r) => (
          <article className="product-panel" key={String(r.id)}>
            <span className="product-state">
              {String(r.status).replaceAll("_", " ")}
            </span>
            <h3 className="mt-4 text-xl font-black break-words">
              {String(r.title)}
            </h3>
            <p className="product-muted break-all">{String(r.id)}</p>
            <p className="mt-4 font-bold">
              {formatGen(String(r.stake_wei ?? r.amount_wei ?? "0"))} GEN{" "}
              <span className="product-muted">
                {product.id === "commitment-pools"
                  ? "per participant"
                  : "test escrow"}
              </span>
            </p>
            {product.id === "commitment-pools" ? (
              <p className="product-muted">
                {String(r.participant_count ?? 0)}/{String(r.max_players ?? 0)}{" "}
                participants · {String(r.rounds_required ?? 0)} rounds ·{" "}
                {String(r.verification_mode ?? "").replaceAll("_", " ")}
              </p>
            ) : (
              <p className="product-muted">
                A {shortAddress(String(r.party_a ?? ""))} · B{" "}
                {shortAddress(String(r.party_b ?? ""))}
              </p>
            )}
            {onlyMine && (
              <div className="mt-4">
                <h4 className="font-bold text-sm">
                  {
                    nextStep(r, protocol.wallet, protocol.now, participantOf(r))
                      .title
                  }
                </h4>
                <p className="product-muted">
                  {
                    nextStep(r, protocol.wallet, protocol.now, participantOf(r))
                      .detail
                  }
                </p>
                {nextStep(r, protocol.wallet, protocol.now, participantOf(r))
                  .deadline > 0 && (
                  <p className="product-muted">
                    {formatDeadline(
                      nextStep(
                        r,
                        protocol.wallet,
                        protocol.now,
                        participantOf(r),
                      ).deadline,
                      protocol.session?.preferences.timezone ?? "UTC",
                    )}
                  </p>
                )}
              </div>
            )}
            <button
              className="product-button-secondary mt-5 w-full"
              onClick={() => onOpen(String(r.id))}
            >
              Review record & next step →
            </button>
          </article>
        ))}
      </div>
      {result && result.total > 24 && (
        <div className="product-toolbar">
          <button
            className="product-button-secondary"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 24))}
          >
            Previous
          </button>
          <p className="product-muted">
            {offset + 1}–{Math.min(offset + 24, result.total)} of {result.total}
          </p>
          <button
            className="product-button-secondary"
            disabled={offset + 24 >= result.total}
            onClick={() => setOffset(offset + 24)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
