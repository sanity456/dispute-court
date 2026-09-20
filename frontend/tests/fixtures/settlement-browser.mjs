// Isolated component exercise, not a contract/wallet test or evidence of execution.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { SettlementPanel } from "../../components/SettlementPanel.tsx";
import { normalizeAgreement } from "../../lib/lifecycle.ts";
import {
  settlementAllocation,
  NEGOTIATION_POLICY,
} from "../../lib/settlement.ts";
export { formatGen } from "../../lib/amounts.ts";
import "../../app/globals.css";
export const errorMessage = (error) => error.message;
export const shortAddress = (value) =>
  value.slice(0, 6) + "…" + value.slice(-4);
const a = "0x" + "aa".repeat(20),
  b = "0x" + "bb".repeat(20);
const h = React.createElement;
const offers = [];
export const readContract = async (method, [, offset, limit]) => {
  if (method !== "list_settlement_offers")
    throw new Error("Unexpected fixture read");
  return {
    items: structuredClone(offers.slice(offset, offset + limit)),
    total: offers.length,
  };
};
function Fixture() {
  const [wallet, setWallet] = useState(a),
    [now, setNow] = useState(1800000000);
  const [disabled, setDisabled] = useState(false),
    [notice, setNotice] = useState("");
  const [agreement, setAgreement] = useState(() =>
    normalizeAgreement({
      id: "mock-negotiation",
      title: "LOCAL MOCK — not a live case",
      terms_hash: "fixture-terms",
      amount_wei: "1000000000000000000",
      party_a: a,
      party_b: b,
      protocol_version: 5,
      negotiation_policy: NEGOTIATION_POLICY,
      status: "funded",
      settlement_offer_count: 0,
      party_a_offer_count: 0,
      party_b_offer_count: 0,
    }),
  );
  const protocol = {
    wallet,
    now,
    ready: !disabled,
    busy: "",
    config: { protocol_version: 5, negotiation_policy: NEGOTIATION_POLICY },
    session: {
      wallet,
      coreAddress: "0x" + "cc".repeat(20),
      captureAddress: "0x" + "ee".repeat(20),
      chainId: 61999,
    },
    transact: async (title, method, args) => {
      setNotice(
        "MOCK ONLY: " +
          method +
          " " +
          JSON.stringify(args) +
          ". No wallet request or transaction was sent.",
      );
      let next = { ...agreement };
      if (method === "propose_settlement") {
        if (offers.at(-1)?.status === "pending")
          offers.at(-1).status = "superseded";
        const n = agreement.settlement_offer_count + 1;
        const offer = {
          agreement_id: agreement.id,
          terms_hash: agreement.terms_hash,
          number: n,
          proposer: wallet,
          recipient: wallet === a ? b : a,
          party_a_pct: 100 - args[1],
          party_b_pct: args[1],
          ...settlementAllocation(agreement.amount_wei, args[1]),
          created_at: now,
          expires_at: now + args[2],
          effective_expires_at: now + args[2],
          status: "pending",
        };
        offers.push(offer);
        next.settlement_offer_count = n;
        next.settlement_offer = offer;
        next[wallet === a ? "party_a_offer_count" : "party_b_offer_count"]++;
      } else if (
        [
          "accept_settlement",
          "reject_settlement",
          "cancel_settlement",
        ].includes(method)
      ) {
        const status = {
          accept_settlement: "accepted",
          reject_settlement: "rejected",
          cancel_settlement: "cancelled",
        }[method];
        offers.at(-1).status = status;
        next.settlement_offer = { ...offers.at(-1) };
        if (status === "accepted") next.status = "resolved";
      } else throw new Error("Unsupported isolated action");
      setAgreement(next);
      return true;
    },
  };
  return h(
    "main",
    { style: { maxWidth: 680, margin: "24px auto", padding: 16 } },
    h(
      "h1",
      { style: { background: "#fde68a", padding: 16 } },
      "LOCAL MOCK · NO WALLETS OR REAL TRANSACTIONS",
    ),
    h("p", null, "Testing as Party " + (wallet === a ? "A" : "B")),
    h(
      "div",
      {
        style: {
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          padding: "16px 0",
        },
      },
      h(
        "button",
        {
          className: "court-secondary",
          onClick: () => setWallet(wallet === a ? b : a),
        },
        "Switch test wallet",
      ),
      h(
        "button",
        { className: "court-secondary", onClick: () => setNow(now + 604801) },
        "Expire test offers",
      ),
      h(
        "button",
        { className: "court-secondary", onClick: () => setDisabled(!disabled) },
        "Toggle stale data",
      ),
    ),
    h("p", { role: "status", style: { overflowWrap: "anywhere" } }, notice),
    h(SettlementPanel, { key: wallet, agreement, protocol, disabled }),
  );
}
createRoot(document.getElementById("root")).render(h(Fixture));
