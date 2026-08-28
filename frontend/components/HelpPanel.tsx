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
            Browser reminders need this page open. Use a calendar download for
            reminders when it is closed.
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
        <h2>Quick help</h2>
        <details>
          <summary>Getting started</summary>
          <p className="product-muted">
            Sign in with your wallet on GenLayer Studionet. Use test GEN only.
            Creating terms moves no funds.
          </p>
        </details>
        <details>
          <summary>Pending transaction or payout</summary>
          <p className="product-muted">
            Check the hash in Activity. Do not resend a pending transaction.
            Withdrawal execution and payout delivery are separate. If delivery
            is unconfirmed, contact support with the hash.
          </p>
        </details>
        <details>
          <summary>Evidence issues</summary>
          <p className="product-muted">
            Use a stable, public HTTPS page. Review the captured text and keep
            the source unchanged. Never submit confidential content. A matching
            digest does not guarantee a correct verdict.
          </p>
        </details>
        <details>
          <summary>Privacy & account data</summary>
          <p className="product-muted">
            Terms, evidence and transactions are public and permanent, even on a
            private preview. Settings, history and support belong to your wallet
            account; verified owners can read support. Signing out does not
            erase chain records. Request data help under Privacy.
          </p>
        </details>
        <details>
          <summary>Owner permissions</summary>
          <p className="product-muted">
            Owners manage support, directory visibility and permitted future
            fees. They cannot change accepted terms, parties, verdicts or
            finalized payouts. Hidden records remain accessible by ID.
          </p>
        </details>
        <details>
          <summary>Studionet limits</summary>
          <p className="product-muted">
            Studionet may reset or go offline. AI rulings can be wrong; review
            the agreed fallback. Index coverage can be partial. Closed-app
            reminders require a calendar app.{" "}
            {product.id === "dispute-court"
              ? "Dispute Court is not a legal court or legal advice."
              : ""}
          </p>
        </details>
      </section>
    </div>
  );
}
