"use client";
import { signInPath, signOutPath, usesNeonAuth } from "../lib/auth-mode";
import { useEffect, useRef, useState } from "react";
import { productApi } from "../lib/client";
import { product } from "../lib/product";
import { readContract } from "../lib/genlayer";
import { errorMessage, type Protocol } from "../lib/useProtocol";
import { calendarFile, formatDeadline, nextStep } from "../lib/reminders";
import { downloadFile, exportJson } from "../lib/export";
type History = {
  moderation: { hidden: number; moderation_reason: string } | null;
  observations: { at: number; status: string }[];
  transactions: Record<string, unknown>[];
};
export function RecordTools({
  record,
  participant,
  protocol,
  onSupport,
}: {
  record: Record<string, unknown>;
  participant?: Record<string, unknown> | null;
  protocol: Protocol;
  onSupport: (hash: string, id: string) => void;
}) {
  const id = String(record.id),
    guide = nextStep(record, protocol.wallet, protocol.now, participant);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const [history, setHistory] = useState<History | null>(null),
    [attempts, setAttempts] = useState<unknown[]>([]);
  const notified = useRef(new Set<string>());
  const timezone = protocol.session?.preferences.timezone ?? "UTC";
  const url =
    product.origin + "/" + product.recordPath + "/" + encodeURIComponent(id);
  useEffect(() => {
    const prefs = protocol.session?.preferences;
    if (!prefs?.browserReminders || !guide.deadline) return;
    function remind() {
      const key = id + ":" + guide.deadline;
      const remaining = guide.deadline * 1000 - Date.now();
      if (
        remaining <= 0 ||
        remaining > Number(prefs?.reminderMinutes ?? 60) * 60000 ||
        notified.current.has(key)
      )
        return;
      notified.current.add(key);
      setMessage(
        "Deadline approaching: " +
          guide.deadlineLabel +
          ". Submit early enough for validator consensus.",
      );
      if ("Notification" in window && Notification.permission === "granted")
        new Notification(product.name + " deadline", {
          body: String(record.title) + " — " + guide.deadlineLabel,
          tag: product.id + ":" + key,
        });
    }
    const initial = window.setTimeout(remind, 0),
      timer = window.setInterval(remind, 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [
    guide.deadline,
    guide.deadlineLabel,
    id,
    record.title,
    protocol.session?.preferences,
  ]);
  async function run(task: () => Promise<void>) {
    setWorking(true);
    setError("");
    try {
      await task();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setWorking(false);
    }
  }
  async function loadHistory() {
    const result = await productApi<History>(
      "records/" + encodeURIComponent(id),
    );
    setHistory(result);
    return result;
  }
  return (
    <article className="product-panel product-stack">
      <div>
        <p className="product-kicker">Next step</p>
        <h3 className="text-xl font-black">{guide.title}</h3>
        <p className="product-muted">{guide.detail}</p>
      </div>
      {guide.deadline > 0 && (
        <p className="product-deadline">
          <strong>{guide.deadlineLabel}</strong>
          <br />
          {formatDeadline(guide.deadline, timezone)}
          <br />
          <small>
            Device time is a guide. Contract time and finality decide
            eligibility.
          </small>
        </p>
      )}
      <div className="product-toolbar">
        <button
          type="button"
          className="product-button-secondary"
          onClick={() =>
            void run(async () => {
              try {
                await navigator.clipboard.writeText(url);
                setMessage(
                  "Invitation link copied. Access still follows this private site's sharing settings.",
                );
              } catch {
                setMessage("Copy the invitation link below.");
              }
            })
          }
        >
          Copy invitation
        </button>
        {protocol.now > 0 && guide.deadline > protocol.now && (
          <button
            className="product-button-secondary"
            onClick={() =>
              void run(async () => {
                downloadFile(
                  id + ".ics",
                  calendarFile(
                    id,
                    String(record.title),
                    guide,
                    protocol.session?.preferences.reminderMinutes ?? 60,
                  ),
                  "text/calendar;charset=utf-8",
                );
                setMessage(
                  "Calendar reminder downloaded. It is a snapshot: update it if the record's deadline changes.",
                );
              })
            }
          >
            Add calendar reminder
          </button>
        )}
        <button
          className="product-button-secondary"
          disabled={working}
          onClick={() =>
            void run(async () => {
              const data = await loadHistory();
              const fullRecord = await readContract(product.detailMethod, [id]);
              let participants: unknown[] = [];
              if (product.id === "commitment-pools") {
                const first = (await readContract("list_participants", [
                  id,
                  0,
                  50,
                ])) as { items: unknown[]; total: number };
                participants = first.items;
                if (first.total > 50)
                  participants.push(
                    ...(
                      (await readContract("list_participants", [
                        id,
                        50,
                        50,
                      ])) as { items: unknown[] }
                    ).items,
                  );
              }
              exportJson(id + "-record.json", {
                product: product.id,
                network: "studionet",
                contract: protocol.session?.coreAddress,
                url,
                exportedAt: new Date().toISOString(),
                record: fullRecord,
                participants,
                history: data,
                coverage:
                  "Observed state changes and tracked transactions, not a complete blockchain archive.",
              });
            })
          }
        >
          Export record
        </button>
        <button
          className="product-text-button"
          onClick={() => onSupport("", id)}
        >
          Report a problem
        </button>
      </div>
      <a
        className="product-record-link"
        href={"/" + product.recordPath + "/" + encodeURIComponent(id)}
      >
        {url}
      </a>
      {message && (
        <p className="product-muted" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      <details>
        <summary>Record history & proof attempts</summary>
        <p className="product-muted">
          State observations begin when this service sees the record. Older
          chain actions can be imported in Activity; missing history is not
          evidence that nothing happened.
        </p>
        <button
          className="product-button-secondary"
          disabled={working}
          onClick={() =>
            void run(async () => {
              await loadHistory();
              if (product.id === "dispute-court") {
                const values = [];
                for (
                  let n = 1;
                  n <=
                  Math.min(3, Number(record.resolution_attempt_count ?? 0));
                  n++
                )
                  values.push(
                    await readContract("get_resolution_attempt", [id, n]),
                  );
                setAttempts(values);
              }
            })
          }
        >
          Load recorded history
        </button>
        {history?.moderation?.hidden === 1 && (
          <p className="product-error">
            Hidden from the directory: {history.moderation.moderation_reason}.
            The on-chain record is unchanged.
          </p>
        )}
        {history && (
          <>
            <ol className="product-timeline">
              {history.observations.map((item) => (
                <li key={item.at + item.status}>
                  <strong>{item.status.replaceAll("_", " ")}</strong>
                  <span>{new Date(item.at).toLocaleString()}</span>
                </li>
              ))}
            </ol>
            <p className="product-muted">
              {history.transactions.length} tracked transactions for this record
              (up to 100 shown).
            </p>
            <details>
              <summary>Tracked transaction hashes</summary>
              {history.transactions.map((tx) => (
                <p key={String(tx.hash)}>
                  <strong>{String(tx.method).replaceAll("_", " ")}</strong>
                  <code className="product-hash">{String(tx.hash)}</code>
                </p>
              ))}
            </details>
          </>
        )}
        {product.id === "commitment-pools" &&
          protocol.wallet &&
          participant && (
            <form
              className="product-stack mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void run(async () =>
                  setAttempts([
                    await readContract("get_attempt", [
                      id,
                      protocol.wallet,
                      Number(data.get("round")),
                      Number(data.get("attempt")),
                    ]),
                  ]),
                );
              }}
            >
              <p className="product-muted">
                Look up one of your immutable attempts. A round can have up to
                three attempts; nonexistent or unavailable attempts are
                reported, not inferred.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="product-field">
                  <span>Round</span>
                  <input
                    name="round"
                    type="number"
                    min="1"
                    max={Number(record.rounds_required)}
                    defaultValue="1"
                    required
                  />
                </label>
                <label className="product-field">
                  <span>Attempt</span>
                  <input
                    name="attempt"
                    type="number"
                    min="1"
                    max="3"
                    defaultValue="1"
                    required
                  />
                </label>
              </div>
              <button className="product-button-secondary" disabled={working}>
                Read my proof attempt
              </button>
            </form>
          )}
        {attempts.map((attempt, index) => (
          <pre className="product-source mt-4" key={index}>
            {JSON.stringify(attempt, null, 2)}
          </pre>
        ))}
      </details>
    </article>
  );
}
export function SessionStrip({ protocol }: { protocol: Protocol }) {
  if (protocol.session?.signedIn)
    return (
      <div className="product-session">
        <span>Account history is saved independently of your wallet.</span>
        <a href={signOutPath}>Sign out</a>
      </div>
    );
  return (
    <div className="product-session">
      <span>
        {protocol.sessionError || "Checking account access…"} Sign in to use
        durable history and actions.
      </span>
      <a href={signInPath}>
        {usesNeonAuth ? "Sign in / Create account →" : "Sign in with ChatGPT →"}
      </a>
    </div>
  );
}
