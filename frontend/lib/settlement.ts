import { agreementRole, type Agreement } from "./lifecycle.ts";

export const NEGOTIATION_POLICY = "bilateral_percentage_offers_v1";
export const OFFER_LIMIT = 50;
export const OFFER_DURATIONS = [3600, 21600, 86400, 259200, 604800];
const states = new Set([
  "funded",
  "awaiting_response",
  "evidence",
  "ready_for_resolution",
  "resolution_stalled",
]);

export function settlementAllocation(amountWei: string, partyBPct: number) {
  if (!/^[1-9]\d*$/.test(amountWei) || BigInt(amountWei) >= 1n << 256n)
    throw new Error("Invalid escrow amount.");
  if (!Number.isInteger(partyBPct) || partyBPct < 0 || partyBPct > 100)
    throw new Error("Enter a whole percentage from 0 to 100.");
  const amount = BigInt(amountWei);
  const partyA = (amount * BigInt(100 - partyBPct)) / 100n;
  return {
    party_a_wei: String(partyA),
    party_b_wei: String(amount - partyA),
    fee_wei: "0",
  };
}

export function negotiationSupported(
  a: Agreement,
  config: Record<string, unknown> | null,
) {
  return (
    a.protocol_version === 5 &&
    a.negotiation_policy === NEGOTIATION_POLICY &&
    config?.protocol_version === 5 &&
    config.negotiation_policy === NEGOTIATION_POLICY
  );
}

export function settlementActions(a: Agreement, wallet: string, now: number) {
  const role = agreementRole(a, wallet);
  const participant = role !== "visitor";
  const deadline =
    a.status === "awaiting_response"
      ? a.response_deadline
      : a.resolution_deadline;
  const open =
    a.protocol_version === 5 &&
    a.negotiation_policy === NEGOTIATION_POLICY &&
    participant &&
    Number.isFinite(now) &&
    now > 0 &&
    states.has(a.status) &&
    (!deadline || now < deadline);
  const offer = a.settlement_offer;
  let validOffer = false;
  try {
    if (offer) {
      const expected = settlementAllocation(
        a.amount_wei,
        Number(offer.party_b_pct),
      );
      const proposerIsA =
        String(offer.proposer).toLowerCase() === a.party_a.toLowerCase();
      validOffer =
        offer.agreement_id === a.id &&
        offer.terms_hash === a.terms_hash &&
        Number.isInteger(offer.number) &&
        Number(offer.number) > 0 &&
        offer.number === a.settlement_offer_count &&
        typeof offer.party_b_pct === "number" &&
        offer.party_a_pct === 100 - Number(offer.party_b_pct) &&
        offer.party_a_wei === expected.party_a_wei &&
        offer.party_b_wei === expected.party_b_wei &&
        offer.fee_wei === "0" &&
        [a.party_a.toLowerCase(), a.party_b.toLowerCase()].includes(
          String(offer.proposer).toLowerCase(),
        ) &&
        String(offer.recipient).toLowerCase() ===
          (proposerIsA ? a.party_b : a.party_a).toLowerCase() &&
        typeof offer.effective_expires_at === "number" &&
        Number.isSafeInteger(offer.effective_expires_at);
    }
  } catch {
    /* Invalid or incomplete chain data cannot authorize an action. */
  }
  const active = Boolean(
    open &&
    validOffer &&
    offer?.status === "pending" &&
    now < Number(offer.effective_expires_at),
  );
  const recipient =
    String(offer?.recipient).toLowerCase() === wallet.toLowerCase();
  const ownCount =
    role === "party_a" ? a.party_a_offer_count : a.party_b_offer_count;
  return {
    open,
    validOffer,
    active,
    propose:
      open &&
      Number.isInteger(a.settlement_offer_count) &&
      a.settlement_offer_count >= 0 &&
      a.settlement_offer_count < 100 &&
      Number.isInteger(ownCount) &&
      ownCount >= 0 &&
      ownCount < OFFER_LIMIT,
    accept: active && recipient,
    reject: active && recipient,
    cancel: active && !recipient,
    remaining: participant ? Math.max(0, OFFER_LIMIT - ownCount) : 0,
  };
}
