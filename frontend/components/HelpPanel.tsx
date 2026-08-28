"use client";
import { useEffect, useState } from "react";
import { productApi } from "../lib/client";
import {
  errorMessage,
  type Preferences,
  type Protocol,
} from "../lib/useProtocol";
import { product } from "../lib/product";
type Ticket = {
  id: string;
  category: string;
  body: string;
  status: string;
  response: string;
  created_at: number;
  record_id: string;
  tx_hash: string;
};
export function HelpPanel({
  protocol,
  context,
}: {
  protocol: Protocol;
  context: { hash: string; id: string };
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [working, setWorking] = useState(false);
  const preferences = protocol.session?.preferences;
  const [prefs, setPrefs] = useState<Preferences>(
    preferences ?? {
      timezone: "UTC",
      browserReminders: false,
      reminderMinutes: 60,
      includeFixtures: false,
      analyticsConsent: false,
    },
  );
  useEffect(() => {
    if (!protocol.session?.signedIn) return;
    void productApi<{ items: Ticket[] }>("support")
      .then((v) => setTickets(v.items))
      .catch((e) => setError(errorMessage(e)));
  }, [protocol.session?.signedIn]);
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
  return (
    <div className="product-stack">
      <header>
        <p className="product-kicker">Help & settings</p>
        <h1 className="product-title">Know where things stand.</h1>
        <p className="product-muted">
          Save preferences, get help with a specific record, and understand the
          limits of this Studionet product.
        </p>
      </header>
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
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <form
          className="product-panel product-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const saved = await productApi<Preferences>("preferences", prefs);
              setPrefs(saved);
              protocol.refresh();
              setMessage("Preferences saved to your account.");
            });
          }}
        >
          <h2>Your reminders & display</h2>
          <label className="product-field">
            <span>Timezone for next-step deadlines</span>
            <input
              value={prefs.timezone}
              maxLength={80}
              onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
              placeholder="Africa/Lagos"
              required
            />
          </label>
          <button
            type="button"
            className="product-text-button"
            onClick={() =>
              setPrefs({
                ...prefs,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              })
            }
          >
            Use this device’s timezone
          </button>
          <label className="product-field">
            <span>Reminder lead time</span>
            <select
              value={prefs.reminderMinutes}
              onChange={(e) =>
                setPrefs({ ...prefs, reminderMinutes: Number(e.target.value) })
              }
            >
              <option value={15}>15 minutes</option>
              <option value={60}>One hour</option>
              <option value={1440}>One day</option>
            </select>
          </label>
          <label className="product-check">
            <input
              type="checkbox"
              checked={prefs.browserReminders}
              onChange={(e) => {
                if (!e.target.checked)
                  setPrefs({ ...prefs, browserReminders: false });
                else
                  void run(async () => {
                    if (!("Notification" in window))
                      throw new Error(
                        "This browser does not support notifications. Use a calendar reminder instead.",
                      );
                    const permission = await Notification.requestPermission();
                    if (permission !== "granted")
                      throw new Error(
                        "Notification permission was not granted. Calendar reminders still work.",
                      );
                    setPrefs({ ...prefs, browserReminders: true });
                    setMessage(
                      "Permission granted on this device. Save preferences to enable reminders.",
                    );
                  });
              }}
            />
            <span>Remind me while I am viewing a record</span>
          </label>
          <p className="product-muted">
            Browser reminders only run while the record is open. Calendar
            downloads work with your calendar app when this site is closed. No
            background email or push delivery is claimed.
          </p>
          <label className="product-check">
            <input
              type="checkbox"
              checked={prefs.includeFixtures}
              onChange={(e) =>
                setPrefs({ ...prefs, includeFixtures: e.target.checked })
              }
            />
            <span>Show automated test fixtures in the directory</span>
          </label>
          <button
            className="product-button"
            disabled={working || !protocol.session?.signedIn}
          >
            Save preferences
          </button>
        </form>
        <form
          className="product-panel product-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              data = new FormData(form);
            void run(async () => {
              const result = await productApi<{ id: string }>("support", {
                category: data.get("category"),
                recordId: data.get("recordId"),
                hash: data.get("hash"),
                body: data.get("body"),
              });
              setTickets(
                (await productApi<{ items: Ticket[] }>("support")).items,
              );
              form.reset();
              setMessage(
                "Support request " +
                  result.id +
                  " saved. Responses appear below; no delivery-time promise is made.",
              );
            });
          }}
        >
          <h2>Ask for help or report a problem</h2>
          <p className="product-muted">
            Private to your signed-in account and the verified product operator.
            Never include a seed phrase, private key, password, or confidential
            evidence.
          </p>
          <label className="product-field">
            <span>Category</span>
            <select
              name="category"
              defaultValue={context.hash ? "transaction" : "feedback"}
            >
              <option value="transaction">Transaction / payout</option>
              <option value="evidence">Evidence / capture</option>
              <option value="abuse">Abuse / public content</option>
              <option value="feedback">Product feedback</option>
              <option value="privacy">Account data / privacy</option>
            </select>
          </label>
          <label className="product-field">
            <span>Record ID (optional)</span>
            <input name="recordId" maxLength={80} defaultValue={context.id} />
          </label>
          <label className="product-field">
            <span>Transaction hash (optional)</span>
            <input
              name="hash"
              pattern="0x[a-fA-F0-9]{64}"
              maxLength={66}
              defaultValue={context.hash}
            />
          </label>
          <label className="product-field">
            <span>What happened?</span>
            <textarea
              name="body"
              required
              minLength={3}
              maxLength={2000}
              rows={5}
              placeholder="What you tried, what you expected, and what appeared."
            />
          </label>
          <button
            className="product-button"
            disabled={working || !protocol.session?.signedIn}
          >
            Save support request
          </button>
        </form>
      </div>
      <section className="product-panel product-stack">
        <h2>Your support requests</h2>
        {!tickets.length ? (
          <p className="product-muted">No support requests have been saved.</p>
        ) : (
          tickets.map((ticket) => (
            <article className="product-ticket" key={ticket.id}>
              <div className="product-toolbar">
                <strong>
                  {ticket.category} · {ticket.status}
                </strong>
                <small>{new Date(ticket.created_at).toLocaleString()}</small>
              </div>
              <p className="whitespace-pre-wrap">{ticket.body}</p>
              <p className="product-muted">Reference: {ticket.id}</p>
              {ticket.response ? (
                <div className="product-response">
                  <strong>Operator response</strong>
                  <p className="whitespace-pre-wrap">{ticket.response}</p>
                </div>
              ) : (
                <p className="product-muted">Awaiting an operator response.</p>
              )}
            </article>
          ))
        )}
      </section>
      <section className="product-panel product-stack">
        <h2>Before you use {product.name}</h2>
        <details>
          <summary>Getting started on Studionet</summary>
          <p className="product-muted">
            Sign in for saved history, then connect a compatible Ethereum
            wallet. The app verifies chain 61999 before each write. It can
            request adding Studionet to your wallet. This is a sandbox using
            test GEN; never send real assets or share wallet recovery secrets.
            Creating terms does not move money.
          </p>
        </details>
        <details>
          <summary>A transaction is stuck or a payout has not arrived</summary>
          <p className="product-muted">
            Open Activity and check the exact hash. Do not resend a pending
            transaction. A finalized parent withdrawal is not a delivered
            payout: the app checks the native child transfer, recipient, exact
            amount and credited flag. If delivery remains unknown, submit a
            support request with the hash; the operator cannot safely invent
            credit or override the contract.
          </p>
        </details>
        <details>
          <summary>Evidence changed or could not be captured</summary>
          <p className="product-muted">
            Use a small, stable public HTTPS page without a login. Capture its
            full rendered text with validators and review it before committing.
            Dynamic pages can differ between validators or change after capture.
            Never upload confidential material. A digest proves a content match,
            not that the content or AI conclusion is true.
          </p>
        </details>
        <details>
          <summary>Privacy, ownership & account data</summary>
          <p className="product-muted">
            Pool/agreement terms, statements, evidence captures and chain
            transactions are public blockchain data, even when this website is
            private. Signed-in preferences, your request journal and support
            messages are stored separately in this product’s database. Support
            and display moderation require verified owner access. Signing out
            does not erase on-chain records. Use the privacy category to request
            account-data help. No third-party behavioral analytics is enabled.
          </p>
        </details>
        <details>
          <summary>What the owner can and cannot do</summary>
          <p className="product-muted">
            The owner can answer support requests, hide abusive entries from
            this directory, inspect operational queues and schedule future fees
            within the contract’s limits. They cannot edit accepted terms, pick
            winners, replace parties, rewrite verdicts or reverse finalized
            payouts. Hidden records remain accessible by ID and on-chain.
          </p>
        </details>
        <details>
          <summary>Known sandbox limitations</summary>
          <p className="product-muted">
            Studionet can be unavailable or reset. AI outcomes are not
            guaranteed correct; submit clear criteria and evidence and
            understand the accepted fallback. The directory and history have
            explicit indexing limits. Notification delivery while the site is
            closed requires a calendar app; unattended operator automation needs
            separately configured hosting.{" "}
            {product.id === "dispute-court"
              ? "Dispute Court is not a legal court or legal advice."
              : ""}
          </p>
        </details>
      </section>
    </div>
  );
}
