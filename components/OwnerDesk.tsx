"use client";
import { useEffect, useState } from "react";
import { productApi } from "../lib/client";
import { errorMessage, type Protocol } from "../lib/useProtocol";
import { exportJson } from "../lib/export";
import { formatGen } from "../lib/genlayer";
type Overview = {
  rpcHealth: {
    successes?: number;
    failures?: number;
    lastSuccessAt?: number;
    lastFailureAt?: number;
  } | null;
  recordStages: { status: string; count: number }[];
  queue: { id: string; title: string; action: string; observedAt: number }[];
  attention: {
    hash: string;
    payout_state: string;
    status: string;
    record_id: string;
  }[];
  coverage: {
    indexed: number;
    total: number;
    complete: boolean;
    membershipPending: number;
  };
  scope: string;
  records: {
    id: string;
    title: string;
    hidden: number;
    moderation_reason: string;
  }[];
  intentCounts: { status: string; count: number }[];
  payoutCounts: { payout_state: string; count: number }[];
  indexer: { error: string; updatedAt: number } | null;
};
type Ticket = {
  id: string;
  category: string;
  body: string;
  response: string;
  status: string;
  record_id: string;
  tx_hash: string;
  created_at: number;
};
export function OwnerDesk({
  protocol,
  onOpen,
}: {
  protocol: Protocol;
  onOpen: (id: string) => void;
}) {
  const [verified, setVerified] = useState(
    protocol.session?.ownerVerified ?? false,
  );
  const [overview, setOverview] = useState<Overview | null>(null),
    [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [working, setWorking] = useState(false);
  async function load() {
    const [report, support] = await Promise.all([
      productApi<Overview>("owner/overview"),
      productApi<{ items: Ticket[] }>("owner/support"),
    ]);
    setOverview(report);
    setTickets(support.items);
  }
  useEffect(() => {
    let stopped = false;
    const task = window.setTimeout(() => {
      if (verified)
        void load().catch((e) => {
          if (!stopped) setError(errorMessage(e));
        });
    }, 0);
    return () => {
      stopped = true;
      window.clearTimeout(task);
    };
  }, [verified]);
  async function run(task: () => Promise<void>) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  async function verify() {
    const provider = window.ethereum;
    if (!provider || !protocol.wallet)
      throw new Error("Connect the deployed owner wallet first.");
    const challenge = await productApi<{ id: string; message: string }>(
      "owner/challenge",
      { wallet: protocol.wallet },
    );
    const hex =
      "0x" +
      Array.from(new TextEncoder().encode(challenge.message), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    const signature = await provider.request({
      method: "personal_sign",
      params: [hex, protocol.wallet],
    });
    await productApi("owner/verify", { id: challenge.id, signature });
    setVerified(true);
    setMessage(
      "Owner access verified for this signed-in account for eight hours. No funds or contract authority were delegated.",
    );
  }
  return (
    <section className="product-stack mt-8">
      <div className="product-panel product-stack">
        <div className="product-toolbar">
          <div>
            <p className="product-kicker">Private operator workspace</p>
            <h2>Support, exceptions & service health</h2>
          </div>
          <span className="product-state">
            {verified ? "Owner session verified" : "Wallet proof required"}
          </span>
        </div>
        <p className="product-muted">
          A short-lived wallet signature protects private tickets and directory
          controls. On-chain owner actions still require their own wallet
          confirmations.
        </p>
        <div className="product-toolbar">
          {!verified ? (
            <button
              className="product-button"
              disabled={
                working || !protocol.wallet || !protocol.session?.signedIn
              }
              onClick={() => void run(verify)}
            >
              Verify owner wallet
            </button>
          ) : (
            <>
              <button
                className="product-button-secondary"
                disabled={working}
                onClick={() => void run(load)}
              >
                Refresh operator view
              </button>
              <button
                className="product-button-secondary"
                disabled={working}
                onClick={() =>
                  void run(async () => {
                    await productApi("owner/logout", {});
                    setVerified(false);
                    setOverview(null);
                    setTickets([]);
                  })
                }
              >
                End owner session
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="product-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="product-muted" role="status">
            {message}
          </p>
        )}
      </div>
      {verified && overview && (
        <>
          <div className="product-panel product-stack">
            <div className="product-toolbar">
              <h2>Operational coverage</h2>
              <button
                className="product-button-secondary"
                onClick={() => exportJson("operator-report.json", overview)}
              >
                Export operator report
              </button>
            </div>
            <p className="product-muted">{overview.scope}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <strong className="text-2xl">
                  {overview.coverage.indexed}/{overview.coverage.total}
                </strong>
                <p className="product-muted">
                  Records indexed ·{" "}
                  {overview.coverage.complete ? "covered" : "partial"}
                </p>
              </div>
              <div>
                <strong className="text-2xl">
                  {overview.attention.length}
                </strong>
                <p className="product-muted">
                  Tracked payout / execution exceptions (up to 50)
                </p>
              </div>
              <div>
                <strong className="text-2xl">
                  {tickets.filter((t) => t.status === "open").length}
                </strong>
                <p className="product-muted">
                  Open tickets in loaded page (up to 100)
                </p>
              </div>
            </div>
            {overview.indexer?.error && (
              <p className="product-error">Indexer: {overview.indexer.error}</p>
            )}
            <div>
              <h3 className="font-bold">Observed RPC health</h3>
              <p className="product-muted">
                {overview.rpcHealth
                  ? String(overview.rpcHealth.successes ?? 0) +
                    " successful / " +
                    String(overview.rpcHealth.failures ?? 0) +
                    " failed uncached requests · last success " +
                    (overview.rpcHealth.lastSuccessAt
                      ? new Date(
                          overview.rpcHealth.lastSuccessAt,
                        ).toLocaleString()
                      : "not recorded")
                  : "No RPC observations yet."}
              </p>
              <p className="product-muted">
                Indexed stages:{" "}
                {overview.recordStages
                  .map(
                    (stage) =>
                      stage.status.replaceAll("_", " ") + " " + stage.count,
                  )
                  .join(" · ")}
                . These operational counts include automated fixtures; they are
                not evidence of real-user adoption.
              </p>
            </div>
            <div className="product-toolbar">
              <button
                className="product-button-secondary"
                disabled={working}
                onClick={() =>
                  void run(async () => {
                    await productApi("directory/sync", {});
                    await load();
                    setMessage(
                      "One bounded indexing pass completed. Refresh again if coverage is partial.",
                    );
                  })
                }
              >
                Run one index refresh
              </button>
              <p className="product-muted">
                No unattended signing service is enabled.
              </p>
            </div>
          </div>
          {protocol.wallet &&
            protocol.wallet.toLowerCase() ===
              String(protocol.config?.owner ?? "").toLowerCase() && (
              <div className="product-panel product-stack">
                <h2>Actual owner-wallet credit</h2>
                <p className="text-xl font-black">
                  {protocol.credit === null
                    ? "Unavailable"
                    : formatGen(protocol.credit) + " GEN"}
                </p>
                <p className="product-muted">
                  This is the connected owner wallet’s withdrawable contract
                  credit, not lifetime fees accrued. Credits can include any
                  participant allocations for the same wallet. Delivery is
                  verified separately in Activity.
                </p>
                <button
                  className="product-button"
                  disabled={
                    Boolean(protocol.busy) ||
                    !protocol.ready ||
                    protocol.credit === null ||
                    BigInt(protocol.credit) <= 0n
                  }
                  onClick={() =>
                    void protocol.transact(
                      "Withdraw owner-wallet credit",
                      "withdraw",
                    )
                  }
                >
                  Withdraw my credit
                </button>
              </div>
            )}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section className="product-panel product-stack">
              <h2>Deadline & resolution queue</h2>
              <p className="product-muted">
                Based on the latest indexed state. Open and refresh each record
                before acting. The operator cannot take party-only actions.
              </p>
              {!overview.queue.length ? (
                <p className="product-muted">
                  No deadline actions in the current indexed page.
                </p>
              ) : (
                overview.queue.map((item) => (
                  <article
                    className="product-ticket"
                    key={item.id + item.action}
                  >
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="product-muted">{item.action}</p>
                    <button
                      className="product-text-button"
                      onClick={() => onOpen(item.id)}
                    >
                      Review live state →
                    </button>
                  </article>
                ))
              )}
            </section>
            <section className="product-panel product-stack">
              <h2>Delivery exceptions</h2>
              <p className="product-muted">
                Investigate these public receipts. Do not recredit or re-send a
                withdrawal based only on an unconfirmed child transfer.
              </p>
              {!overview.attention.length ? (
                <p className="product-muted">No tracked exceptions.</p>
              ) : (
                overview.attention.map((tx) => (
                  <article key={tx.hash} className="product-ticket">
                    <strong>
                      {tx.payout_state} · {tx.status}
                    </strong>
                    <code className="product-hash">{tx.hash}</code>
                    <button
                      className="product-button-secondary"
                      disabled={working}
                      onClick={() =>
                        void run(async () => {
                          await productApi("owner/transaction", {
                            hash: tx.hash,
                          });
                          await load();
                        })
                      }
                    >
                      Recheck delivery
                    </button>
                    {tx.record_id && (
                      <button
                        className="product-text-button"
                        onClick={() => onOpen(tx.record_id)}
                      >
                        Open record
                      </button>
                    )}
                  </article>
                ))
              )}
            </section>
          </div>
          <section className="product-panel product-stack">
            <h2>Support desk</h2>
            <p className="product-muted">
              Responses are delivered to the signed-in requester in Help. Never
              ask for a recovery phrase or private key.
            </p>
            {!tickets.length ? (
              <p className="product-muted">No tickets yet.</p>
            ) : (
              tickets.map((ticket) => (
                <form
                  className="product-ticket product-stack"
                  key={ticket.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void run(async () => {
                      await productApi("owner/support", {
                        id: ticket.id,
                        response: data.get("response"),
                        status: data.get("status"),
                      });
                      await load();
                      setMessage(
                        "Response saved to the requester's support history.",
                      );
                    });
                  }}
                >
                  <div className="product-toolbar">
                    <strong>
                      {ticket.category} · {ticket.status}
                    </strong>
                    <small>
                      {new Date(ticket.created_at).toLocaleString()}
                    </small>
                  </div>
                  <p className="whitespace-pre-wrap">{ticket.body}</p>
                  <code className="product-hash">{ticket.tx_hash}</code>
                  {ticket.record_id && (
                    <button
                      className="product-text-button"
                      type="button"
                      onClick={() => onOpen(ticket.record_id)}
                    >
                      Open {ticket.record_id}
                    </button>
                  )}
                  <label className="product-field">
                    <span>Operator response</span>
                    <textarea
                      name="response"
                      defaultValue={ticket.response}
                      required
                      maxLength={2000}
                      rows={3}
                    />
                  </label>
                  <label className="product-field">
                    <span>Ticket status</span>
                    <select name="status" defaultValue={ticket.status}>
                      <option value="open">Keep open</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                  <button
                    className="product-button-secondary"
                    disabled={working}
                  >
                    Save response
                  </button>
                </form>
              ))
            )}
          </section>
          <form
            className="product-panel product-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void run(async () => {
                await productApi("owner/moderation", {
                  id: data.get("id"),
                  reason: data.get("reason"),
                  hidden: data.get("visibility") === "hide",
                });
                await load();
                setMessage(
                  "Directory visibility updated. The contract, evidence, funds and direct record link are unchanged.",
                );
              });
            }}
          >
            <h2>Directory moderation</h2>
            <p className="product-muted">
              Hide abusive public listings with a reason, or restore them. This
              cannot remove or rewrite blockchain records.
            </p>
            <label className="product-field">
              <span>Indexed record</span>
              <select name="id" required>
                <option value="">Choose a record</option>
                {overview.records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.hidden ? "Hidden · " : ""}
                    {r.title} · {r.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="product-field">
              <span>Directory visibility</span>
              <select name="visibility">
                <option value="hide">Hide from directory</option>
                <option value="show">Restore to directory</option>
              </select>
            </label>
            <label className="product-field">
              <span>Reason (visible on the record history)</span>
              <textarea name="reason" required maxLength={240} rows={2} />
            </label>
            <button className="product-button-secondary" disabled={working}>
              Update directory visibility
            </button>
          </form>
        </>
      )}
    </section>
  );
}
