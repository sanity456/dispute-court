import React, { createContext, useContext, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import ProductHome from "../../components/ProductHome.tsx";
import { normalizeAgreement } from "../../lib/lifecycle.ts";
import { evidenceDigest } from "../../lib/evidence.ts";
export { formatGen, parseGen } from "../../lib/amounts.ts";
import "../../app/globals.css";

const h = React.createElement;
const Context = createContext(null);
export const useProtocol = () => useContext(Context);
export const errorMessage = (error) => error.message;
export const useRouter = () => ({ push: () => {} });
export const contractAddress = "0x" + "cc".repeat(20);
export const isLiveConfigured = true;
export const shortAddress = (value) =>
  value.slice(0, 6) + "…" + value.slice(-4);
const partyA = "0x" + "aa".repeat(20),
  partyB = "0x" + "bb".repeat(20);
let failRead = false;
let agreement = normalizeAgreement({
  id: "isolated-ui-test",
  title: "MOCK agreement · no live transactions",
  party_a: partyA,
  party_b: partyB,
  amount_wei: "1000",
  fee_bps: 200,
  terms_hash: "fixture-terms",
  protocol_version: 4,
  status: "awaiting_acceptance",
  acceptance_deadline: 500,
  evidence_deadline: 500,
  resolution_deadline: 1000,
  summary: "Local state-preservation test. No wallet or network is used.",
  criteria: "Preserve drafts only while the recorded agreement is unchanged.",
});
export async function readContract(method) {
  await new Promise((resolve) => setTimeout(resolve, 700));
  if (failRead) throw new Error("Simulated read outage");
  if (method === "get_agreement") return structuredClone(agreement);
  throw new Error("Unimplemented fixture read: " + method);
}
function updateFixture(update) {
  agreement = { ...agreement, ...update };
}
function setReadOutage(value) {
  failRead = value;
}
export async function productApi() {
  throw new Error("API writes are unavailable in this UI fixture.");
}
export async function readContractAt(core, method, args) {
  if (method !== "get_capture") throw new Error("Unexpected fixture method");
  const text = "Fixture source. No live capture or wallet transaction.";
  return {
    product_contract: contractAddress,
    url: "https://example.com/fixture",
    text,
    byte_length: new TextEncoder().encode(text).byteLength,
    digest: await evidenceDigest(text),
    captured_at: 100,
    request_id: args[1],
  };
}
function Fixture() {
  const [revision, revise] = useState(0),
    [wallet, setWallet] = useState(partyB);
  const [notice, setNotice] = useState(null);
  const refresh = () => revise((value) => value + 1);
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const change = (update) => {
    updateFixture(update);
    refresh();
  };
  const protocol = {
    wallet,
    session: {
      signedIn: true,
      wallet,
      coreAddress: contractAddress,
      captureAddress: "0x" + "ee".repeat(20),
      chainId: 61999,
      preferences: {
        timezone: "UTC",
        includeFixtures: true,
        browserReminders: false,
      },
    },
    revision,
    refresh,
    items: [agreement],
    total: 1,
    now: 100,
    busy: "",
    ready: true,
    config: { owner: partyA },
    stats: {},
    credit: "0",
    notice,
    setNotice,
    connect: async () => {},
    more: async () => {},
    transact: async (title, method) => {
      if (method !== "capture")
        throw new Error("Transactions are disabled in this isolated fixture.");
      setNotice({
        kind: "info",
        text: "MOCK capture only. No wallet request was sent.",
      });
      return true;
    },
  };
  const button = (title, action) =>
    h(
      "button",
      {
        type: "button",
        onClick: action,
        style: { padding: 8, border: "1px solid" },
      },
      title,
    );
  return h(
    Context.Provider,
    { value: protocol },
    h(
      "header",
      { style: { padding: 16, background: "#fde68a" } },
      h("h1", null, "ISOLATED UI TEST · NO REAL WALLETS OR TRANSACTIONS"),
      button("Fixture: change terms", () =>
        change({ terms_hash: agreement.terms_hash + "-changed" }),
      ),
      button("Fixture: evidence stage", () => change({ status: "evidence" })),
      button("Fixture: change evidence state", () =>
        change({ party_a_ready: !agreement.party_a_ready }),
      ),
      button("Fixture: read outage", () => {
        setReadOutage(true);
        refresh();
      }),
      button("Fixture: recover reads", () => {
        setReadOutage(false);
        refresh();
      }),
      button("Fixture: switch wallet", () =>
        setWallet((value) => (value === partyB ? partyA : partyB)),
      ),
    ),
    h(ProductHome, { initialId: agreement.id }),
  );
}
createRoot(document.getElementById("root")).render(h(Fixture));
