"use client";

import { FormEvent, useState } from "react";
import { type Agreement } from "../lib/lifecycle";
import { type Protocol, errorMessage } from "../lib/useProtocol";
import { agreementReviewKey, workspaceIdentity } from "../lib/workspace-review";
import { appealActions, appealSupported } from "../lib/appeal";
import { EvidenceCapture } from "./EvidenceCapture";

function when(value: unknown) {
  const seconds = Number(value);
  return seconds > 0 ? new Date(seconds * 1000).toLocaleString() : "Pending";
}

export function AppealPanel({
  agreement,
  protocol,
  disabled,
}: {
  agreement: Agreement;
  protocol: Protocol;
  disabled: boolean;
}) {
  const [reason, setReason] = useState("");
  const [consentKey, setConsentKey] = useState("");
  const [evidenceReady, setEvidenceReady] = useState(false);
  const [captureCycle, setCaptureCycle] = useState(0);
  const [error, setError] = useState("");
  const actions = appealActions(agreement, protocol.wallet, protocol.now);
  const context =
    workspaceIdentity(protocol.session) + agreementReviewKey(agreement);
  const currentConsent = context + "|" + reason.trim();
  const appeal = agreement.appeal;
  const provisional = agreement.provisional_verdict;
  const blocked = disabled || Boolean(protocol.busy) || !protocol.ready;
  if (!appealSupported(agreement, protocol.config)) return null;
  if (!Object.keys(provisional).length) return null;

  async function submitReason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || !actions.file || consentKey !== currentConsent) return;
    const text = reason.trim();
    if (!text || text.length > 2000) return;
    const ok = await protocol.transact("File appeal", "file_appeal", [
      agreement.id,
      text,
    ]);
    if (ok) {
      setReason("");
      setConsentKey("");
    }
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || !actions.submitEvidence || !evidenceReady) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const note = String(data.get("note") ?? "").trim();
    const url = String(data.get("url") ?? "");
    const digest = String(data.get("digest") ?? "");
    if (!note || !/^https:\/\//.test(url) || !/^[a-f0-9]{64}$/i.test(digest)) {
      setError("Capture and review a public source before committing it.");
      return;
    }
    setError("");
    const ok = await protocol.transact(
      "Submit appeal evidence",
      "submit_appeal_evidence",
      [agreement.id, note, url, digest],
    );
    if (ok) {
      setEvidenceReady(false);
      setCaptureCycle((value) => value + 1);
      form.reset();
    }
  }

  const appealEvidence = agreement.evidence.filter(
    (item) => item.stage === "appeal",
  );
  return (
    <article className="court-surface p-6" aria-labelledby="appeal-heading">
      <p className="court-eyebrow">
        Consensus decision · escrow held until final
      </p>
      <h3 id="appeal-heading" className="mt-2 text-xl font-black">
        Challenge or finalize the decision
      </h3>
      <p className="mt-3 text-sm leading-7 text-[#70817c]">
        Initial result:{" "}
        <strong>{String(provisional.reason_code ?? "Pending")}</strong>
        {" · "}Party B performance:{" "}
        {String(provisional.performance_level ?? "undetermined")}. No
        withdrawable credit is issued while this decision can be challenged.
      </p>
      {agreement.status === "appeal_window" && (
        <>
          <p className="mt-3 text-sm">
            Appeal deadline: {when(agreement.appeal_deadline)}. The contract
            uses chain time.
          </p>
          {actions.file && (
            <form
              onSubmit={(event) => void submitReason(event)}
              className="mt-5 space-y-4"
            >
              <label className="court-field">
                <span>Why should the decision be reconsidered?</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={2000}
                  required
                  rows={4}
                />
              </label>
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={consentKey === currentConsent}
                  onChange={(event) =>
                    setConsentKey(event.target.checked ? currentConsent : "")
                  }
                />
                <span>
                  I reviewed the current ruling. This reason will be public, and
                  escrow remains locked during reconsideration.
                </span>
              </label>
              <button
                className="court-primary"
                disabled={
                  blocked || !reason.trim() || consentKey !== currentConsent
                }
              >
                File one appeal
              </button>
            </form>
          )}
          {actions.finalizeUnappealed && (
            <button
              className="court-primary mt-5"
              disabled={blocked}
              onClick={() =>
                void protocol.transact(
                  "Finalize unappealed decision",
                  "finalize_unappealed",
                  [agreement.id],
                )
              }
            >
              Finalize unappealed decision
            </button>
          )}
        </>
      )}
      {Object.keys(appeal).length > 0 && (
        <div className="mt-5 rounded-xl border border-[#a17925]/30 p-4 text-sm leading-7">
          <p>
            <strong>Appeal by {String(appeal.filed_by ?? "party")}</strong>
          </p>
          <p className="mt-2 whitespace-pre-wrap">
            {String(appeal.reason ?? "")}
          </p>
          <p className="mt-2">
            Evidence closes: {when(appeal.evidence_deadline)} · Final review
            deadline: {when(appeal.resolution_deadline)}
          </p>
          <p>
            Party A: {appeal.party_a_ready ? "ready" : "not ready"} · Party B:{" "}
            {appeal.party_b_ready ? "ready" : "not ready"}
          </p>
          {appealEvidence.length > 0 && (
            <ul className="mt-3 list-disc pl-5">
              {appealEvidence.map((item) => (
                <li key={String(item.id)}>
                  {String(item.id)} · {String(item.party)} ·{" "}
                  <a
                    href={String(item.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    public source
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {agreement.status === "appeal_evidence" && (
        <>
          {actions.submitEvidence && (
            <form
              onSubmit={(event) => void submitEvidence(event)}
              className="mt-5 space-y-4"
            >
              <label className="court-field">
                <span>What does this additional evidence establish?</span>
                <textarea name="note" maxLength={800} required rows={3} />
              </label>
              <EvidenceCapture
                key={context + "|" + captureCycle}
                protocol={protocol}
                disabled={blocked}
                reviewContext={context}
                onReviewChange={setEvidenceReady}
              />
              <button
                className="court-primary"
                disabled={blocked || !evidenceReady}
              >
                Commit appeal evidence
              </button>
            </form>
          )}
          {actions.markReady && (
            <button
              className="court-primary mt-5"
              disabled={blocked}
              onClick={() =>
                void protocol.transact(
                  "Mark appeal ready",
                  "mark_appeal_ready",
                  [agreement.id],
                )
              }
            >
              My appeal evidence is ready
            </button>
          )}
          {actions.closeEvidence && (
            <button
              className="court-primary mt-5"
              disabled={blocked}
              onClick={() =>
                void protocol.transact(
                  "Close appeal evidence",
                  "close_appeal_evidence",
                  [agreement.id],
                )
              }
            >
              Close expired evidence window
            </button>
          )}
        </>
      )}
      {actions.resolve && (
        <button
          className="court-primary mt-5"
          disabled={blocked}
          onClick={() =>
            void protocol.transact(
              "Run appeal consensus review",
              "resolve_appeal",
              [agreement.id],
            )
          }
        >
          Run appeal consensus review
        </button>
      )}
      {agreement.status === "appeal_stalled" && (
        <p className="mt-3 text-sm leading-7">
          Verified evidence was insufficient. Either party may retry review
          before the fixed deadline; the original decision stands if
          reconsideration remains unresolved.
        </p>
      )}
      {actions.finalizeTimeout && (
        <button
          className="court-primary mt-5"
          disabled={blocked}
          onClick={() =>
            void protocol.transact(
              "Finalize original decision after appeal timeout",
              "finalize_appeal_timeout",
              [agreement.id],
            )
          }
        >
          Finalize original decision after timeout
        </button>
      )}
      {agreement.status === "resolved" && Object.keys(appeal).length > 0 && (
        <p className="mt-4 text-sm leading-7">
          Final reason:{" "}
          <strong>
            {String(
              agreement.verdict.reason_code ??
                appeal.final_reason_code ??
                "Recorded",
            )}
          </strong>
          . Compare it with the initial result above; withdrawal remains a
          separate action.
        </p>
      )}
      {error && (
        <p role="alert" className="product-error mt-3">
          {errorMessage(error)}
        </p>
      )}
    </article>
  );
}
