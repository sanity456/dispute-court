"use client";
import { useEffect, useRef, useState } from "react";
export type PublishDraft = {
  id: string;
  args: unknown[];
  fields: [string, string][];
};
export function PublishReview({
  draft,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  draft: PublishDraft;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      className="product-dialog"
      aria-labelledby="publish-review-title"
      aria-describedby="publish-review-description"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="product-stack">
        <div className="product-toolbar">
          <h2 id="publish-review-title" className="text-2xl font-black">
            Review before publishing
          </h2>
          <button
            className="product-text-button"
            aria-label="Close review"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p id="publish-review-description" className="product-muted">
          This publishes immutable public terms on Studionet. Creation moves no
          funds. Review the text and schedule carefully before opening your
          wallet.
        </p>
        <dl className="product-review-fields">
          {draft.fields.map(([title, value]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <label className="product-check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={busy}
          />
          <span>
            I reviewed the parties or cohort, amounts, criteria, schedule and
            consequences. I understand these terms cannot be edited after
            publication.
          </span>
        </label>
        {error && (
          <p className="product-error" role="alert">
            {error}
          </p>
        )}
        <div className="product-toolbar">
          <button
            className="product-button"
            disabled={busy || !accepted}
            onClick={() => void onConfirm()}
          >
            {busy ? "Waiting for wallet / finality…" : "Confirm & open wallet"}
          </button>
          <button
            className="product-button-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Back to edit
          </button>
        </div>
      </div>
    </dialog>
  );
}
