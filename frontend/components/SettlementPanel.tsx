"use client";

import { useState } from "react";
import { type Agreement } from "../lib/lifecycle";
import { type Protocol, errorMessage } from "../lib/useProtocol";
import { formatGen, readContract, shortAddress } from "../lib/genlayer";
import { agreementReviewKey, workspaceIdentity } from "../lib/workspace-review";
import {
  negotiationSupported,
  settlementActions,
  settlementAllocation,
} from "../lib/settlement";
import { exportJson } from "../lib/export";

type OfferPage = { items: Record<string, unknown>[]; total: number };
const time = (value: unknown) =>
  new Date(Number(value) * 1000).toLocaleString();

export function SettlementPanel({
  agreement,
  protocol,
  disabled,
}: {
  agreement: Agreement;
  protocol: Protocol;
  disabled: boolean;
}) {
  const { transact } = protocol;
  const [percentage, setPercentage] = useState("50");
  const [duration, setDuration] = useState("86400");
  const [reviewed, setReviewed] = useState("");
  const [accepted, setAccepted] = useState("");
  const [history, setHistory] = useState<OfferPage | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const actions = settlementActions(agreement, protocol.wallet, protocol.now);
  const context =
    workspaceIdentity(protocol.session) + agreementReviewKey(agreement);
  const proposalReview = [context, percentage, duration].join("|");
  const offer = agreement.settlement_offer;
  const displayStatus =
    offer?.status === "pending" &&
    protocol.now >= Number(offer.effective_expires_at)
      ? "expired (refresh to confirm)"
      : String(offer?.status ?? "");
  let allocation: ReturnType<typeof settlementAllocation> | null = null;
  try {
    if (/^\d{1,3}$/.test(percentage))
      allocation = settlementAllocation(
        agreement.amount_wei,
        Number(percentage),
      );
  } catch {
    /* The form explains invalid input; never guess a payout. */
  }
  if (!negotiationSupported(agreement, protocol.config)) return null;
  const blocked = disabled || !protocol.ready || Boolean(protocol.busy);
  async function loadHistory() {
    setHistoryBusy(true);
    setHistoryError("");
    try {
      const page = (await readContract("list_settlement_offers", [
        agreement.id,
        0,
        50,
      ])) as OfferPage;
      if (
        !Array.isArray(page.items) ||
        !Number.isInteger(page.total) ||
        page.total < 0 ||
        page.total > 100
      )
        throw new Error("Settlement history could not be verified.");
      const items = [...page.items];
      if (page.total > 50) {
        const second = (await readContract("list_settlement_offers", [
          agreement.id,
          50,
          50,
        ])) as OfferPage;
        if (second.total !== page.total || !Array.isArray(second.items))
          throw new Error("Offers changed while loading. Refresh history.");
        items.push(...second.items);
      }
      if (items.length !== page.total)
        throw new Error("Settlement history is incomplete. Try again.");
      setHistory({ items, total: page.total });
    } catch (error) {
      setHistory(null);
      setHistoryError(errorMessage(error));
    } finally {
      setHistoryBusy(false);
    }
  }
  return (
    <article className="court-surface p-6" aria-labelledby="settlement-heading">
      <p className="court-eyebrow">Mutual agreement · no court fee</p>
      <h3 id="settlement-heading" className="mt-2 text-xl font-black">
        Negotiate a settlement
      </h3>
      <p className="mt-3 text-sm leading-7 text-[#70817c]">
        Agree on a split without an AI ruling. Case deadlines keep running.
      </p>
      {offer && (
        <div className="mt-4 rounded-xl border border-[#a17925]/30 p-4">
          <p className="font-bold">
            Offer #{String(offer.number)} · {displayStatus.replaceAll("_", " ")}
          </p>
          {actions.validOffer ? (
            <>
              <p className="mt-2 text-sm">
                From {shortAddress(String(offer.proposer))}
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt>Party A · refund ({String(offer.party_a_pct)}%)</dt>
                  <dd className="break-all font-bold">
                    {formatGen(String(offer.party_a_wei))} GEN
                  </dd>
                </div>
                <div>
                  <dt>Party B · payment ({String(offer.party_b_pct)}%)</dt>
                  <dd className="break-all font-bold">
                    {formatGen(String(offer.party_b_wei))} GEN
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs">
                Offer expiry: {time(offer.effective_expires_at)}. Contract time
                decides eligibility.
              </p>
            </>
          ) : (
            <p role="alert" className="mt-2 text-sm">
              Offer details could not be verified. Refresh before continuing.
            </p>
          )}
          {actions.accept && (
            <>
              <label className="mt-4 flex items-start gap-3 text-xs leading-6">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accepted === context}
                  disabled={blocked}
                  onChange={(e) => setAccepted(e.target.checked ? context : "")}
                />
                <span>
                  I accept offer #{String(offer.number)} and the exact
                  allocations above. This closes the case; each party withdraws
                  their credit separately.
                </span>
              </label>
              <button
                className="court-primary mt-3 w-full"
                disabled={blocked || accepted !== context}
                onClick={() => {
                  setAccepted("");
                  void transact(
                    "Accept settlement offer",
                    "accept_settlement",
                    [agreement.id, offer.number],
                  );
                }}
              >
                Accept offer
              </button>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            {actions.reject && (
              <button
                className="court-secondary"
                disabled={blocked}
                onClick={() =>
                  void transact(
                    "Reject settlement offer",
                    "reject_settlement",
                    [agreement.id, offer.number],
                  )
                }
              >
                Reject offer
              </button>
            )}
            {actions.cancel && (
              <button
                className="court-secondary"
                disabled={blocked}
                onClick={() =>
                  void transact(
                    "Cancel settlement offer",
                    "cancel_settlement",
                    [agreement.id, offer.number],
                  )
                }
              >
                Cancel my offer
              </button>
            )}
          </div>
        </div>
      )}
      {actions.propose && (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (blocked || !allocation || reviewed !== proposalReview) return;
            setReviewed("");
            void transact("Propose settlement split", "propose_settlement", [
              agreement.id,
              Number(percentage),
              Number(duration),
              agreement.settlement_offer_count,
            ]);
          }}
        >
          <h4 className="font-bold">
            {actions.active ? "Make a replacement offer" : "Propose a split"}
          </h4>
          <label className="court-field">
            <span>Party B payment (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              required
              value={percentage}
              disabled={blocked}
              onChange={(e) => setPercentage(e.target.value)}
            />
          </label>
          <label className="court-field">
            <span>Offer valid for</span>
            <select
              value={duration}
              disabled={blocked}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="3600">1 hour</option>
              <option value="21600">6 hours</option>
              <option value="86400">24 hours</option>
              <option value="259200">3 days</option>
              <option value="604800">7 days</option>
            </select>
          </label>
          {allocation ? (
            <div className="space-y-2 text-sm" aria-live="polite">
              <p className="break-all">
                Party A refund:{" "}
                <strong>{formatGen(allocation.party_a_wei)} GEN</strong>
              </p>
              <p className="break-all">
                Party B payment:{" "}
                <strong>{formatGen(allocation.party_b_wei)} GEN</strong>
              </p>
              <p className="text-xs">
                No court fee. Rounding remainder goes to Party B. Expiry is
                capped by the applicable response or resolution deadline.
              </p>
            </div>
          ) : (
            <p role="alert" className="text-sm">
              Enter a whole percentage from 0 to 100.
            </p>
          )}
          <label className="flex items-start gap-3 text-xs leading-6">
            <input
              type="checkbox"
              className="mt-1"
              disabled={blocked || !allocation}
              checked={reviewed === proposalReview}
              onChange={(e) =>
                setReviewed(e.target.checked ? proposalReview : "")
              }
            />
            <span>
              I approve these terms. If the other party accepts in time, the
              split is final. This replaces any previous offer.
            </span>
          </label>
          <button
            className="court-primary w-full"
            type="submit"
            disabled={blocked || !allocation || reviewed !== proposalReview}
          >
            Send offer to wallet
          </button>
          <p className="text-xs text-[#70817c]">
            {actions.remaining} offers remaining for your wallet. No additional
            escrow deposit; network fees may apply.
          </p>
        </form>
      )}
      {!actions.open && (
        <p className="mt-4 text-sm">
          No settlement action is available for this wallet or case stage.
        </p>
      )}
      {actions.open && !actions.propose && (
        <p className="mt-4 text-sm">
          Your offer limit is reached. You can still respond to the other
          party’s offer or use the case-resolution actions.
        </p>
      )}
      <details className="mt-5 text-sm">
        <summary className="cursor-pointer font-bold">
          Settlement history
        </summary>
        <button
          className="court-secondary mt-3"
          disabled={historyBusy || blocked}
          onClick={() => void loadHistory()}
        >
          {historyBusy ? "Loading…" : "Load settlement history"}
        </button>
        {historyError && (
          <p role="alert" className="mt-2">
            {historyError}
          </p>
        )}
        {history && (
          <>
            <p className="mt-3">
              {history.total} recorded offers. Loaded snapshot; refresh for
              updates.
            </p>
            <ol className="mt-3 space-y-2">
              {history.items.map((item) => (
                <li key={String(item.number)}>
                  #{String(item.number)} · B {String(item.party_b_pct)}% ·{" "}
                  {String(item.status)} · {time(item.created_at)}
                </li>
              ))}
            </ol>
            <button
              className="court-secondary mt-3"
              onClick={() =>
                exportJson(agreement.id + "-settlement-offers.json", {
                  network: "studionet",
                  contract: protocol.session?.coreAddress,
                  agreementId: agreement.id,
                  termsHash: agreement.terms_hash,
                  exportedAt: new Date().toISOString(),
                  offers: history.items,
                  coverage:
                    "Contract offer records at read time, not proof of native payout delivery.",
                })
              }
            >
              Export offers
            </button>
          </>
        )}
      </details>
    </article>
  );
}
