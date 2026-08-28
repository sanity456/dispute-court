"use client";
import { useState } from "react";
import { readContractAt } from "../lib/genlayer";
import { errorMessage, type Protocol } from "../lib/useProtocol";
import {
  validateEvidenceUrl,
  type EvidenceCapture as Capture,
} from "../lib/evidence";
export function EvidenceCapture({
  protocol,
  urlName = "url",
  digestName = "digest",
}: {
  protocol: Protocol;
  urlName?: string;
  digestName?: string;
}) {
  const [url, setUrl] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [recoveryId, setRecoveryId] = useState("");
  const target = protocol.session?.captureAddress ?? "";
  async function load(nonce: string) {
    if (!protocol.wallet || !target)
      throw new Error("Connect the wallet that created the capture.");
    const value = (await readContractAt(target, "get_capture", [
      protocol.wallet,
      nonce,
    ])) as Capture;
    if (
      value.product_contract.toLowerCase() !==
      protocol.session?.coreAddress.toLowerCase()
    )
      throw new Error("This capture belongs to a different product.");
    setCapture(value);
    setUrl(value.url);
    setReviewed(false);
  }
  async function create() {
    setError("");
    setWorking(true);
    try {
      const checked = validateEvidenceUrl(url),
        nonce = crypto.randomUUID();
      setRecoveryId(nonce);
      const ok = await protocol.transact(
        "Capture public evidence",
        "capture",
        [checked, nonce],
        0n,
        target,
      );
      if (ok) await load(nonce);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setWorking(false);
    }
  }
  return (
    <fieldset className="product-evidence">
      <legend>Capture evidence</legend>
      <p className="product-muted">
        Capture the full page and digest in a zero-value Studionet transaction.
        Keep the source unchanged; a capture is not a verdict.
      </p>
      <label className="product-field">
        <span>Public source URL</span>
        <input
          type="url"
          maxLength={2048}
          value={url}
          placeholder="https://…"
          onChange={(e) => {
            setUrl(e.target.value);
            setCapture(null);
            setReviewed(false);
          }}
        />
      </label>
      <p className="product-muted">
        Captured text is public and permanent. No confidential content or
        private links.
      </p>
      <button
        className="product-button"
        type="button"
        disabled={
          working ||
          Boolean(protocol.busy) ||
          !protocol.ready ||
          !protocol.wallet ||
          !url
        }
        onClick={() => void create()}
      >
        {working ? "Capturing…" : "Capture source"}
      </button>
      {!protocol.wallet && (
        <p className="product-muted">
          Connect your wallet before capturing a source.
        </p>
      )}
      {error && (
        <p className="product-error" role="alert">
          {error}
        </p>
      )}
      {capture && (
        <div className="product-capture-result">
          <p>
            <strong>Capture complete</strong> ·{" "}
            {capture.byte_length.toLocaleString()} bytes ·{" "}
            {new Date(capture.captured_at * 1000).toLocaleString()}
          </p>
          <details open>
            <summary>Review captured text</summary>
            <pre className="product-source">{capture.text}</pre>
          </details>
          <code className="product-hash">{capture.digest}</code>
          <label className="product-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            <span>I reviewed this public text and it supports my proof.</span>
          </label>
          <p className="product-muted">
            Recovery ID: <code>{capture.request_id}</code>. It is also in
            Activity.
          </p>
        </div>
      )}
      <details>
        <summary>Recover a capture after a reload</summary>
        <label className="product-field">
          <span>Capture request ID from Activity</span>
          <input
            value={recoveryId}
            onChange={(e) => setRecoveryId(e.target.value)}
            maxLength={80}
          />
        </label>
        <button
          className="product-button-secondary"
          type="button"
          disabled={!protocol.wallet || working || !recoveryId}
          onClick={() => {
            setWorking(true);
            setError("");
            void load(recoveryId)
              .catch((failure) => setError(errorMessage(failure)))
              .finally(() => setWorking(false));
          }}
        >
          Load saved capture
        </button>
      </details>
      <input
        type="hidden"
        name={urlName}
        value={reviewed ? (capture?.url ?? "") : ""}
      />
      <input
        type="hidden"
        name={digestName}
        value={reviewed ? (capture?.digest ?? "") : ""}
      />
    </fieldset>
  );
}
