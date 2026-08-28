"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { productApi } from "../lib/client";
import {
  intentDescription,
  safeJson,
  type Intent,
  type PayoutObservation,
} from "../lib/activity-model";
import { errorMessage, type Protocol } from "../lib/useProtocol";
import { formatGen, shortAddress } from "../lib/genlayer";
import { exportJson } from "../lib/export";
import { recoverOutbox } from "../lib/recovery";
type Page = { items: Intent[]; total: number; offset: number };
export function ActivityPanel({
  protocol,
  onOpen,
  onSupport,
}: {
  protocol: Protocol;
  onOpen: (id: string) => void;
  onSupport: (hash: string, id: string) => void;
}) {
  const [page, setPage] = useState<Page>({ items: [], total: 0, offset: 0 });
  const [offset, setOffset] = useState(0);
  const [mine, setMine] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [initial, setInitial] = useState(true);
  const [message, setMessage] = useState("");
  const latest = useRef(page.items);
  const requests = useRef({ version: 0 });
  const load = useCallback(async () => {
    const version = ++requests.current.version;
    if (!protocol.session?.signedIn) return;
    if (mine && !protocol.wallet) {
      setPage({ items: [], total: 0, offset: 0 });
      latest.current = [];
      setInitial(false);
      return;
    }
    const value = await productApi<Page>(
      "activity?offset=" +
        offset +
        (mine && protocol.wallet
          ? "&wallet=" + encodeURIComponent(protocol.wallet)
          : ""),
    );
    if (version !== requests.current.version) return;
    setPage(value);
    latest.current = value.items;
    setInitial(false);
  }, [offset, mine, protocol.wallet, protocol.session?.signedIn]);
  useEffect(() => {
    const requestState = requests.current;
    let stopped = false;
    const task = window.setTimeout(() => {
      void load().catch((e) => {
        if (!stopped) {
          setError(errorMessage(e));
          setInitial(false);
        }
      });
    }, 0);
    return () => {
      stopped = true;
      requestState.version++;
      window.clearTimeout(task);
    };
  }, [load, protocol.revision]);
  useEffect(() => {
    let active = true,
      running = false;
    const timer = window.setInterval(async () => {
      if (!active || running || document.visibilityState !== "visible") return;
      const pending = latest.current
        .filter(
          (row) =>
            row.tx_hash &&
            (row.status === "submitted" ||
              ["pending", "unknown"].includes(
                row.transaction?.payout_state ?? "",
              )),
        )
        .slice(0, 2);
      if (!pending.length) return;
      running = true;
      try {
        for (const row of pending)
          await productApi("intents/" + row.id + "/reconcile", {});
        if (active) await load();
      } catch {
        /* The last known status stays visible. Manual refresh exposes any error. */
      } finally {
        running = false;
      }
    }, 45000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [load]);
  async function action(key: string, run: () => Promise<unknown>) {
    if (working) return;
    setWorking(key);
    setError("");
    setMessage("");
    try {
      await run();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking("");
    }
  }
  function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hash = String(new FormData(event.currentTarget).get("hash")).trim();
    void action("import", async () => {
      await productApi("activity/import", { hash });
      setMessage(
        "Transaction imported and checked against this product. No transaction was resent.",
      );
    });
  }
  return (
    <div className="product-stack">
      <header>
        <p className="product-kicker">Your saved activity</p>
        <h1 className="product-title">Every request has a trail.</h1>
        <p className="product-muted">
          Saved to your signed-in account, across devices. A wallet
          confirmation, successful contract execution and delivered payout are
          three different events.
        </p>
      </header>
      <div className="product-toolbar">
        <button
          className="product-button-secondary"
          disabled={Boolean(working)}
          onClick={() =>
            void action("refresh", async () => {
              const result = await recoverOutbox();
              await load();
              setMessage(
                result.pending
                  ? "Some device-local hashes still need recovery. Check your wallet history."
                  : "Activity refreshed. This did not resend any transaction.",
              );
            })
          }
        >
          Refresh saved history
        </button>
        <label className="product-check">
          <input
            type="checkbox"
            checked={mine}
            disabled={!protocol.wallet && !mine}
            onChange={(e) => {
              setMine(e.target.checked);
              setOffset(0);
            }}
          />
          <span>Current wallet only</span>
        </label>
        <button
          className="product-button-secondary"
          disabled={!page.items.length}
          onClick={() =>
            exportJson("activity-page.json", {
              exportedAt: new Date().toISOString(),
              scope: "This page only",
              ...page,
            })
          }
        >
          Export this page
        </button>
      </div>
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="product-muted">
          {message}
        </p>
      )}
      {!page.items.length && (
        <div className="product-panel">
          <h2>
            {initial ? "Loading saved requests…" : "No saved requests yet"}
          </h2>
          <p className="product-muted">
            Your next action is reserved here before the wallet opens. Older
            actions made before this journal existed can be imported by hash.
          </p>
        </div>
      )}
      {page.items.map((row) => {
        const payout = safeJson(
          row.transaction?.payout_json ?? "{}",
        ) as PayoutObservation;
        const captureArgs =
          row.method === "capture" ? safeJson(row.args_json) : [];
        return (
          <article className="product-panel" key={row.id}>
            <div className="product-toolbar">
              <div>
                <p className="product-kicker">
                  {shortAddress(row.wallet)} ·{" "}
                  {new Date(row.created_at).toLocaleString()}
                </p>
                <h2>{row.title}</h2>
              </div>
              <span
                className={
                  "product-state " +
                  (row.status === "failed" || row.status === "review"
                    ? "product-state-warning"
                    : "")
                }
              >
                {intentDescription(row)}
              </span>
            </div>
            {row.record_id && (
              <button
                className="product-text-button"
                onClick={() => onOpen(row.record_id)}
              >
                Open {row.record_id} →
              </button>
            )}
            {row.tx_hash ? (
              <code className="product-hash">{row.tx_hash}</code>
            ) : (
              <p className="product-muted">
                No hash recorded. Do not assume that means no transaction was
                broadcast.
              </p>
            )}
            {row.error && <p className="product-error">{row.error}</p>}
            {row.method === "capture" && (
              <p className="product-muted">
                Capture recovery ID: <code>{String(captureArgs[1] ?? "")}</code>
                . Load it in the evidence form using the same wallet.
              </p>
            )}
            {payout.amount_wei && (
              <div className="product-payout">
                <p>
                  <strong>{formatGen(payout.amount_wei)} GEN</strong> to{" "}
                  <code>{payout.recipient}</code>
                </p>
                <p className="product-muted">{payout.note}</p>
                {payout.children?.map((child) => (
                  <div key={child.hash}>
                    <p>
                      {child.delivered
                        ? "Credited & finalized"
                        : child.status.toLowerCase().replaceAll("_", " ")}
                    </p>
                    <code className="product-hash">{child.hash}</code>
                  </div>
                ))}
              </div>
            )}
            <div className="product-toolbar">
              {row.tx_hash && (
                <button
                  className="product-button-secondary"
                  disabled={Boolean(working)}
                  onClick={() =>
                    void action(row.id, () =>
                      productApi("intents/" + row.id + "/reconcile", {}),
                    )
                  }
                >
                  {working === row.id
                    ? "Checking…"
                    : "Check execution & delivery"}
                </button>
              )}
              <button
                className="product-text-button"
                onClick={() => onSupport(row.tx_hash ?? "", row.record_id)}
              >
                Get help with this request
              </button>
            </div>
            {!row.tx_hash && ["reserved", "review"].includes(row.status) && (
              <details>
                <summary>
                  Recover a hash or close an unsigned wallet request
                </summary>
                <form
                  className="product-stack mt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const hash = String(
                      new FormData(e.currentTarget).get("hash"),
                    ).trim();
                    void action(row.id, () =>
                      productApi("intents/" + row.id, { hash }),
                    );
                  }}
                >
                  <label className="product-field">
                    <span>Transaction hash from wallet history</span>
                    <input
                      name="hash"
                      required
                      pattern="0x[a-fA-F0-9]{64}"
                      maxLength={66}
                    />
                  </label>
                  <button
                    className="product-button-secondary"
                    disabled={Boolean(working)}
                  >
                    Attach & verify hash
                  </button>
                </form>
                <form
                  className="product-stack mt-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(row.id, () =>
                      productApi("intents/" + row.id, {
                        state: "cancelled",
                        confirmedUnsigned: true,
                      }),
                    );
                  }}
                >
                  <label className="product-check">
                    <input type="checkbox" required />
                    <span>
                      I checked the wallet and confirm this request was rejected
                      or never submitted. A submitted transaction cannot be
                      cancelled here.
                    </span>
                  </label>
                  <button
                    className="product-button-secondary"
                    disabled={Boolean(working)}
                  >
                    Close unsigned request
                  </button>
                </form>
              </details>
            )}
          </article>
        );
      })}
      <div className="product-toolbar">
        <p className="product-muted">
          {page.total
            ? Math.min(offset + 1, page.total) +
              "–" +
              Math.min(offset + 30, page.total) +
              " of " +
              page.total
            : "0"}{" "}
          saved requests
        </p>
        <button
          className="product-button-secondary"
          disabled={offset === 0 || Boolean(working)}
          onClick={() => setOffset(Math.max(0, offset - 30))}
        >
          Previous
        </button>
        <button
          className="product-button-secondary"
          disabled={offset + 30 >= page.total || Boolean(working)}
          onClick={() => setOffset(offset + 30)}
        >
          Next
        </button>
      </div>
      <form className="product-panel product-stack" onSubmit={recover}>
        <h2>Recover an older transaction</h2>
        <p className="product-muted">
          Paste a Studionet hash for this product. Importing checks its real
          sender, target, arguments, execution and payout; it never broadcasts
          anything.
        </p>
        <label className="product-field">
          <span>Transaction hash</span>
          <input
            name="hash"
            required
            maxLength={66}
            pattern="0x[a-fA-F0-9]{64}"
            placeholder="0x…"
          />
        </label>
        <button
          className="product-button"
          disabled={Boolean(working) || !protocol.session?.signedIn}
        >
          Import & verify transaction
        </button>
      </form>
    </div>
  );
}
