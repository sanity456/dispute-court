"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  connectWallet,
  contractAddress,
  digestText,
  formatGen,
  isLiveConfigured,
  parseGen,
  readContract,
  shortAddress,
  writeContract,
} from "../lib/genlayer";

type Tab = "cases" | "agreements" | "create" | "owner";
type Notice = { kind: "success" | "error" | "info"; text: string } | null;
type Agreement = {
  id: string;
  title: string;
  party_a: string;
  party_b: string;
  amount_wei: string;
  status: string;
  fee_bps: number;
  acceptance_deadline: number;
  funding_deadline: number;
  performance_due_at: number;
  terms_hash: string;
};

const GEN = 10n ** 18n;
const partyA = "0xa1480000000000000000000000000000000072c1";
const partyB = "0xb2490000000000000000000000000000000083d2";
const demoAgreements: Agreement[] = [
  { id: "DC-0148", title: "Milestone delivery against signed product brief", party_a: partyA, party_b: partyB, amount_wei: String(42n * GEN / 10n), status: "evidence", fee_bps: 200, acceptance_deadline: 1786924800, funding_deadline: 1787011200, performance_due_at: 1787875200, terms_hash: "d30b83743c6f8c08fc97f83c0062371f0c9ded67fbba99bc52fe815c91e4305e" },
  { id: "AG-0192", title: "Editorial package for September launch", party_a: partyA, party_b: "0xc3510000000000000000000000000000000094e3", amount_wei: String(6n * GEN), status: "awaiting_acceptance", fee_bps: 200, acceptance_deadline: 1788134400, funding_deadline: 0, performance_due_at: 0, terms_hash: "ac2efc7d84a8c7c67a46f9838735bb82bda11f045fc46a786264ed962a3b1021" },
  { id: "AG-0177", title: "Research synthesis and source appendix", party_a: "0xd46200000000000000000000000000000000a5f4", party_b: partyB, amount_wei: String(26n * GEN / 10n), status: "funded", fee_bps: 200, acceptance_deadline: 1786147200, funding_deadline: 1786233600, performance_due_at: 1788393600, terms_hash: "b932c6a64cb6a3aedc74b5ca9658dd96a2217751653442c40ac68fa6d01f58d0" },
];

const fallbackStats = { agreements_created: 126, agreements_accepted: 108, agreements_funded: 94, agreements_resolved: 71, agreements_cancelled: 11, disputes_opened: 29, disputes_answered: 24, evidence_submitted: 86, needs_evidence_results: 7, cooperative_resolutions: 53, no_show_resolutions: 4, value_resolved_wei: String(388n * GEN), fees_accrued_wei: String(775n * GEN / 100n), payouts_emitted: 132 };

const timeline = [
  ["Agreement accepted", "Both parties accepted the final terms and fallback policy", "complete"],
  ["Escrow funded", "4.2 GEN locked under the accepted agreement", "complete"],
  ["Evidence open", "Both parties may add hash-committed public exhibits", "active"],
  ["Consensus ruling", "Exact 0 / 25 / 50 / 75 / 100 payout bucket", "upcoming"],
  ["Finalized withdrawal", "Emission and child-transaction delivery shown separately", "upcoming"],
];

function object(value: unknown): Record<string, unknown> {
  if (value instanceof Map) return Object.fromEntries(value);
  return (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
}

function normalize(value: unknown): Agreement {
  const item = object(value);
  return { id: String(item.id ?? ""), title: String(item.title ?? "Untitled agreement"), party_a: String(item.party_a ?? ""), party_b: String(item.party_b ?? ""), amount_wei: String(item.amount_wei ?? "0"), status: String(item.status ?? "awaiting_acceptance"), fee_bps: Number(item.fee_bps ?? 0), acceptance_deadline: Number(item.acceptance_deadline ?? 0), funding_deadline: Number(item.funding_deadline ?? 0), performance_due_at: Number(item.performance_due_at ?? 0), terms_hash: String(item.terms_hash ?? "") };
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function date(timestamp: number) {
  if (!timestamp) return "Pending prior step";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp * 1000));
}

function Field({ label: title, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="court-field"><span>{title}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Stat({ label: title, value, note }: { label: string; value: string; note: string }) {
  return <div className="stat-card"><p className="court-eyebrow">{title}</p><p className="mt-3 text-3xl font-black tracking-[-.04em]">{value}</p><p className="mt-1 text-xs font-semibold text-[#70817c]">{note}</p></div>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("cases");
  const [wallet, setWallet] = useState("");
  const [agreements, setAgreements] = useState<Agreement[]>(demoAgreements);
  const [stats, setStats] = useState<Record<string, unknown>>(fallbackStats);
  const [config, setConfig] = useState<Record<string, unknown>>({ owner: "0x916300000000000000000000000000000000b605", fee_bps: 200, pending_fee_bps: 200, pending_fee_effective_at: 0 });
  const [selectedId, setSelectedId] = useState("DC-0148");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState("");

  const loadLive = useCallback(async () => {
    if (!isLiveConfigured) return;
    try {
      const [listingRaw, statsRaw, configRaw] = await Promise.all([readContract("list_agreements", [0, 50]), readContract("get_stats"), readContract("get_config")]);
      const listing = object(listingRaw);
      const items = Array.isArray(listing.items) ? listing.items.map(normalize) : [];
      setAgreements(items);
      setStats(object(statsRaw));
      setConfig(object(configRaw));
      if (items[0]) setSelectedId(items[0].id);
    } catch (error) {
      setNotice({ kind: "error", text: `Live court data is unavailable: ${String((error as Error).message ?? error)}` });
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadLive(), 0);
    return () => window.clearTimeout(task);
  }, [loadLive]);
  useEffect(() => {
    const changed = (...args: unknown[]) => setWallet(String((args[0] as string[])?.[0] ?? ""));
    window.ethereum?.on?.("accountsChanged", changed);
    return () => window.ethereum?.removeListener?.("accountsChanged", changed);
  }, []);

  const selected = useMemo(() => agreements.find((item) => item.id === selectedId) ?? agreements[0] ?? demoAgreements[0], [agreements, selectedId]);
  const owner = String(config.owner ?? "");
  const isOwner = Boolean(wallet && owner && wallet.toLowerCase() === owner.toLowerCase());

  async function handleConnect() {
    try {
      setBusy("connect");
      const account = await connectWallet();
      setWallet(account);
      setNotice({ kind: "success", text: `Wallet connected: ${shortAddress(account)}` });
    } catch (error) { setNotice({ kind: "error", text: String((error as Error).message ?? error) }); }
    finally { setBusy(""); }
  }

  async function ensureWallet() {
    if (wallet) return wallet;
    const account = await connectWallet();
    setWallet(account);
    return account;
  }

  async function transact(title: string, method: string, args: unknown[] = [], value = 0n) {
    try {
      setBusy(title);
      setNotice({ kind: "info", text: `${title}: waiting for wallet approval and validator consensus…` });
      const account = await ensureWallet();
      const hash = await writeContract(account, method, args, value);
      setNotice({ kind: "success", text: `${title} finalized. Transaction ${shortAddress(hash)}.` });
      await loadLive();
    } catch (error) { setNotice({ kind: "error", text: String((error as Error).message ?? error) }); }
    finally { setBusy(""); }
  }

  async function createAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const id = String(data.get("agreement_id") ?? "").trim() || `agreement-${Date.now().toString(36)}`;
    await transact("Create agreement", "create_agreement", [id, String(data.get("party_b") ?? ""), title, String(data.get("summary") ?? ""), String(data.get("criteria") ?? ""), parseGen(String(data.get("amount") ?? "0")), Number(data.get("acceptance_days") ?? 3) * 86400, Number(data.get("funding_days") ?? 3) * 86400, Number(data.get("performance_days") ?? 14) * 86400, Number(data.get("response_days") ?? 3) * 86400, Number(data.get("evidence_days") ?? 3) * 86400]);
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const snapshot = String(data.get("snapshot") ?? "");
    const digest = snapshot ? await digestText(snapshot) : String(data.get("digest") ?? "");
    await transact("Submit evidence", "submit_evidence", [selected.id, String(data.get("note") ?? ""), String(data.get("url") ?? ""), digest]);
  }

  async function openDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await transact("Open dispute", "open_dispute", [selected.id, String(data.get("claim") ?? "")]);
  }

  return <main className="min-h-screen bg-[#edf1ef] text-[#172522]">
    <nav className="sticky top-0 z-40 border-b border-[#173d39]/8 bg-[#edf1ef]/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1460px] items-center justify-between gap-4 px-5 py-4 sm:px-10 lg:px-14">
        <button className="flex items-center gap-3 text-left" onClick={() => setTab("cases")}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#163d3a] text-lg font-black text-[#f1c969] shadow-lg">§</span><span><strong className="block text-[15px] tracking-tight">Dispute Court</strong><small className="block text-[10px] font-bold uppercase tracking-[.17em] text-[#657975]">Agreement-first resolution</small></span></button>
        <div className="hidden items-center gap-1 rounded-full bg-white/55 p-1 text-sm font-bold md:flex">{(["cases", "agreements", "create", "owner"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`court-nav-pill ${tab === item ? "court-nav-active" : ""}`}>{item === "create" ? "New agreement" : label(item)}</button>)}</div>
        <button className="court-wallet" onClick={handleConnect} disabled={busy === "connect"}><span className={`h-2 w-2 rounded-full ${wallet ? "bg-[#f1c969]" : "bg-white/40"}`} />{wallet ? shortAddress(wallet) : busy === "connect" ? "Connecting…" : "Connect wallet"}</button>
      </div>
      <div className="mx-auto flex max-w-[1460px] gap-2 overflow-x-auto px-5 pb-3 md:hidden">{(["cases", "agreements", "create", "owner"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`court-mobile-tab ${tab === item ? "court-mobile-active" : ""}`}>{item === "create" ? "New" : label(item)}</button>)}</div>
    </nav>

    <div className="mx-auto max-w-[1460px] px-5 pt-4 sm:px-10 lg:px-14">
      <div className={`court-mode ${isLiveConfigured ? "court-live" : "court-preview"}`}><strong>{isLiveConfigured ? "Live court" : "Product preview"}</strong><span>{isLiveConfigured ? `${shortAddress(contractAddress)} · finalized writes only` : "Sample cases are clearly labeled. Transactions remain blocked until deployment is configured."}</span></div>
      {notice && <div className={`court-notice court-notice-${notice.kind}`} role="status"><b>{notice.kind === "success" ? "✓" : notice.kind === "error" ? "!" : "…"}</b><p>{notice.text}</p><button onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
    </div>

    {tab === "cases" && <section className="mx-auto max-w-[1460px] px-5 pb-20 pt-8 sm:px-10 lg:px-14 lg:pt-12">
      <div className="grid items-end gap-8 border-b border-[#173d39]/15 pb-10 lg:grid-cols-[1fr_auto]"><div><div className="mb-5 flex w-fit items-center gap-2 rounded-full bg-[#dce7e3] px-3 py-2 text-xs font-extrabold text-[#315651]"><span className="h-2 w-2 rounded-full bg-[#be8e27]" /> Every case begins with terms both parties accepted</div><h1 className="max-w-5xl text-[clamp(3.2rem,7vw,7rem)] font-black leading-[.9] tracking-[-.067em] text-[#163d3a]">Resolve the disagreement.<br/><span className="font-serif font-normal italic text-[#9b711c]">Preserve the record.</span></h1></div><div className="max-w-sm pb-1"><p className="text-base leading-7 text-[#5c706b]">A bounded, evidence-grounded path from bilateral agreement to finalized settlement—without changing the deal after escrow is funded.</p><button className="court-secondary mt-5" onClick={() => setTab("create")}>Create an agreement</button></div></div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.12fr_.88fr]">
        <article className="overflow-hidden rounded-[30px] bg-[#163d3a] text-white shadow-[0_28px_70px_rgba(22,61,58,.2)]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-6 sm:p-8"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[#b7cbc6]"><span className="h-2 w-2 rounded-full bg-[#f1c969]" /> Active case · {selected.id}</div><h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight">{selected.title}</h2></div><span className="rounded-full bg-[#f1c969] px-3 py-1.5 text-xs font-black text-[#163d3a]">{label(selected.status)}</span></div>
          <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[1fr_290px]"><div><div className="mb-7 grid grid-cols-3 gap-3">{[["Escrow",`${formatGen(selected.amount_wei)} GEN`],["Fee locked",`${(selected.fee_bps / 100).toFixed(2)}%`],["Evidence closes","18h"]].map(([title,value]) => <div key={title} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#a9c0ba]">{title}</p><p className="mt-2 text-xl font-black">{value}</p></div>)}</div><div className="space-y-1">{timeline.map(([title,detail,state], index) => <div key={title} className="grid grid-cols-[28px_1fr] gap-3"><div className="flex flex-col items-center"><span className={`mt-1 h-4 w-4 rounded-full border-4 ${state === "complete" ? "border-[#f1c969] bg-[#f1c969]" : state === "active" ? "border-[#f1c969] bg-[#163d3a]" : "border-white/25 bg-[#163d3a]"}`} />{index < timeline.length - 1 && <span className="h-14 w-px bg-white/15" />}</div><div><p className={`font-extrabold ${state === "upcoming" ? "text-white/45" : ""}`}>{title}</p><p className={`mt-1 text-xs ${state === "upcoming" ? "text-white/30" : "text-[#a9c0ba]"}`}>{detail}</p></div></div>)}</div></div>
            <div className="rounded-[22px] bg-[#f3efe5] p-5 text-[#172522]"><p className="court-eyebrow">Your next action</p><h3 className="mt-2 text-xl font-black tracking-tight">Add a verifiable exhibit</h3><p className="mt-2 text-xs leading-5 text-[#697974]">Every URL is fetched by validators and must match the SHA-256 digest committed here.</p><form onSubmit={submitEvidence} className="mt-5 grid gap-3"><Field label="Evidence note"><textarea name="note" required rows={2} placeholder="What this exhibit establishes…" /></Field><Field label="Public HTTPS URL"><input name="url" type="url" required placeholder="https://…" /></Field><Field label="Expected digest"><input name="digest" pattern="[0-9a-fA-F]{64}" placeholder="64 hexadecimal characters" /></Field><Field label="Optional source snapshot" hint="Calculates the digest locally."><textarea name="snapshot" rows={2} placeholder="Visible source text…" /></Field><button className="court-primary w-full" disabled={Boolean(busy)} type="submit">{busy === "Submit evidence" ? "Waiting for consensus…" : "Submit exhibit"}</button></form><div className="mt-3 grid grid-cols-2 gap-2"><button className="court-secondary compact" onClick={() => void transact("Mark ready", "mark_ready", [selected.id])}>Mark ready</button><button className="court-secondary compact" onClick={() => void transact("Resolve case", "resolve", [selected.id])}>Resolve</button></div></div>
          </div>
        </article>

        <aside className="grid content-start gap-5 sm:grid-cols-2 lg:grid-cols-1"><div className="court-surface p-6"><div className="flex items-center justify-between"><p className="court-eyebrow">Case selector</p><span className="court-status">{agreements.filter((item) => item.status.includes("evidence") || item.status.includes("response") || item.status.includes("resolution")).length || 1} open</span></div><div className="mt-5 grid gap-2">{agreements.map((agreement) => <button key={agreement.id} className={`case-selector ${selected.id === agreement.id ? "case-selected" : ""}`} onClick={() => setSelectedId(agreement.id)}><span><strong>{agreement.id}</strong><small>{agreement.title}</small></span><b>{formatGen(agreement.amount_wei)} GEN</b></button>)}</div></div><div className="rounded-[28px] bg-[#f1c969] p-6 text-[#2c321f] shadow-sm"><p className="court-eyebrow text-[#6f5b24]">Resolution standard</p><h3 className="mt-4 text-2xl font-black tracking-tight">Facts first.<br/>Exact payout buckets.</h3><p className="mt-3 text-sm leading-6 text-[#66592f]">Validators must agree on the outcome, source digest bundle, and material evidence references. A leader cannot invent a free-form percentage.</p><div className="mt-5 flex gap-1">{[0,25,50,75,100].map((bucket) => <span key={bucket} className="bucket">{bucket}%</span>)}</div></div></aside>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">{[["Unanswered dispute","After the signed response window, the opener wins by deterministic contract rule—not by AI."],["Evidence problem","Unavailable or digest-mismatched evidence produces needs_evidence and no payout."],["Bounded fallback","After two evidence reopens, either party can execute the accepted 50/50 fallback."]].map(([title,copy]) => <article className="court-surface p-5" key={title}><p className="text-sm font-black">{title}</p><p className="mt-2 text-xs leading-5 text-[#6b7b76]">{copy}</p></article>)}</div>
    </section>}

    {tab === "agreements" && <section className="mx-auto max-w-[1460px] px-5 py-10 sm:px-10 lg:px-14 lg:py-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="court-eyebrow">Bilateral agreement inbox</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em] sm:text-5xl">Agree first. Fund second.</h1><p className="mt-3 max-w-2xl text-[#62736e]">Acceptance, funding, cooperative release, refund authorization, and dispute opening are separate actions. That separation is the product’s safety model.</p></div><button className="court-secondary" onClick={() => void transact("Emit withdrawal", "withdraw")}>Emit available withdrawal</button></div><div className="mt-8 grid gap-5 lg:grid-cols-3">{agreements.map((agreement) => <article className="agreement-card" key={agreement.id}><div className="flex items-start justify-between gap-4"><span className="court-status">{label(agreement.status)}</span><strong className="text-lg">{formatGen(agreement.amount_wei)} GEN</strong></div><h2 className="mt-5 min-h-14 text-xl font-black leading-7">{agreement.title}</h2><div className="mt-5 grid gap-2 text-xs"><div className="agreement-row"><span>Party A</span><b>{shortAddress(agreement.party_a)}</b></div><div className="agreement-row"><span>Party B</span><b>{shortAddress(agreement.party_b)}</b></div><div className="agreement-row"><span>Performance due</span><b>{date(agreement.performance_due_at)}</b></div><div className="agreement-row"><span>Adjudication fee</span><b>{(agreement.fee_bps / 100).toFixed(2)}%</b></div></div><div className="mt-5 rounded-2xl bg-[#edf1ef] p-3 font-mono text-[10px] text-[#74847f]">Terms {agreement.terms_hash.slice(0, 16)}…</div><div className="mt-5 grid gap-2">{agreement.status === "awaiting_acceptance" && <button className="court-primary" onClick={() => void transact("Accept agreement", "accept_agreement", [agreement.id])}>Review & accept terms</button>}{agreement.status === "awaiting_funding" && <button className="court-primary" onClick={() => void transact("Fund escrow", "fund_agreement", [agreement.id], BigInt(agreement.amount_wei))}>Fund exact escrow</button>}{agreement.status === "funded" && <><div className="grid grid-cols-2 gap-2"><button className="court-primary" onClick={() => void transact("Release escrow", "release_to_party_b", [agreement.id])}>Release to B</button><button className="court-secondary compact" onClick={() => void transact("Authorize refund", "refund_to_party_a", [agreement.id])}>Refund A</button></div><form onSubmit={(event) => { setSelectedId(agreement.id); void openDispute(event); }} className="mt-2"><Field label="Open a dispute"><textarea name="claim" required rows={2} placeholder="State the material disagreement…" /></Field><button className="court-secondary mt-2 w-full" type="submit">Open bounded dispute</button></form></>}{!["awaiting_acceptance","awaiting_funding","funded"].includes(agreement.status) && <button className="court-primary" onClick={() => { setSelectedId(agreement.id); setTab("cases"); }}>Open case workspace</button>}</div></article>)}</div></section>}

    {tab === "create" && <section className="mx-auto grid max-w-[1460px] gap-8 px-5 py-10 sm:px-10 lg:grid-cols-[1fr_390px] lg:px-14 lg:py-14"><div><p className="court-eyebrow">Agreement builder</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em] sm:text-5xl">Make the hard decisions<br/>while everyone agrees.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[#62736e]">The parties, amount, criteria, time windows, fee snapshot, exact ruling buckets, and fallback policy become one immutable terms hash.</p><form className="court-surface mt-8 p-6 sm:p-8" onSubmit={createAgreement}><div className="grid gap-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="Agreement title"><input name="title" required maxLength={140} placeholder="Milestone delivery for product brief" /></Field><Field label="Agreement ID" hint="Optional; generated if blank."><input name="agreement_id" maxLength={80} placeholder="milestone-04" /></Field></div><Field label="Party B wallet address"><input name="party_b" required pattern="0x[0-9a-fA-F]{40}" placeholder="0x…" /></Field><Field label="Plain-language agreement"><textarea name="summary" required maxLength={1000} rows={4} placeholder="What will be delivered, to whom, and in what form?" /></Field><Field label="Decision criteria" hint="State how evidence should map to Party A, Party B, or a split."><textarea name="criteria" required maxLength={4000} rows={6} placeholder="Award Party B when… Award Party A when… Use a split when…" /></Field><div className="grid gap-5 sm:grid-cols-3"><Field label="Escrow (GEN)"><input name="amount" type="number" min="0.000001" step="0.000001" defaultValue="5" required /></Field><Field label="Acceptance (days)"><input name="acceptance_days" type="number" min="1" max="30" defaultValue="3" required /></Field><Field label="Funding (days)"><input name="funding_days" type="number" min="1" max="30" defaultValue="3" required /></Field></div><div className="grid gap-5 sm:grid-cols-3"><Field label="Performance (days)"><input name="performance_days" type="number" min="1" max="365" defaultValue="14" required /></Field><Field label="Response (days)"><input name="response_days" type="number" min="1" max="30" defaultValue="3" required /></Field><Field label="Evidence (days)"><input name="evidence_days" type="number" min="1" max="30" defaultValue="3" required /></Field></div></div><div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#173d39]/10 pt-6"><p className="max-w-lg text-xs leading-5 text-[#70817c]">Creation moves no money. Party B accepts the exact hash; only then may Party A fund the escrow.</p><button className="court-primary" disabled={Boolean(busy)} type="submit">{busy === "Create agreement" ? "Waiting for consensus…" : "Publish for acceptance"}</button></div></form></div><aside className="space-y-5 lg:pt-24"><div className="rounded-[28px] bg-[#f1c969] p-6"><p className="court-eyebrow text-[#705c27]">Built-in settlement policy</p><h2 className="mt-4 text-2xl font-black">0 · 25 · 50 · 75 · 100</h2><p className="mt-3 text-sm leading-6 text-[#655930]">These are percentages of net escrow awarded to Party A. Party B receives the remainder. No free-form “close enough” rulings.</p></div><div className="court-surface p-6"><p className="court-eyebrow">Before you publish</p><ul className="court-checklist mt-5"><li>Both parties are correctly identified</li><li>Deliverables are objectively described</li><li>Decision criteria cover partial delivery</li><li>Public evidence can be shared safely</li><li>The 50/50 bounded fallback is acceptable</li></ul></div><div className="rounded-[24px] border border-[#173d39]/10 p-5 text-xs leading-5 text-[#64756f]"><strong className="text-[#163d3a]">Fee policy:</strong> cooperative release and authorized refund are fee-free. The snapshotted court fee applies only when the contract adjudicates.</div></aside></section>}

    {tab === "owner" && <section className="mx-auto max-w-[1460px] px-5 py-10 sm:px-10 lg:px-14 lg:py-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="court-eyebrow">Court owner console</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em] sm:text-5xl">Govern the fee schedule.<br/>Never govern a verdict.</h1><p className="mt-3 max-w-2xl text-[#62736e]">The owner can schedule a future fee after a 24-hour delay. Agreement terms, evidence, deadlines, rulings, credits, and fallback execution remain outside owner control.</p></div><span className={`rounded-full px-4 py-2 text-xs font-black ${isOwner ? "bg-[#f1c969]" : "bg-white/70"}`}>{isOwner ? "Connected as owner" : `Owner ${shortAddress(owner)}`}</span></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Agreements funded" value={String(stats.agreements_funded ?? 0)} note={`${stats.agreements_created ?? 0} created`}/><Stat label="Resolved" value={String(stats.agreements_resolved ?? 0)} note={`${stats.cooperative_resolutions ?? 0} cooperative`}/><Stat label="Value resolved" value={`${formatGen(String(stats.value_resolved_wei ?? 0))} GEN`} note={`${stats.disputes_opened ?? 0} disputes opened`}/><Stat label="Fees accrued" value={`${formatGen(String(stats.fees_accrued_wei ?? 0))} GEN`} note="Adjudication only"/></div><div className="mt-7 grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><form className="court-surface p-6 sm:p-8" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void transact("Schedule fee", "schedule_fee_bps", [Number(data.get("fee_bps") ?? 0)]); }}><p className="court-eyebrow">Future adjudication fee</p><div className="mt-4 flex items-end gap-3"><Field label="New fee (basis points)" hint="Maximum 1,000 bps / 10%."><input name="fee_bps" type="number" min="0" max="1000" defaultValue={String(config.fee_bps ?? 0)} /></Field><button className="court-primary mb-[22px] shrink-0" disabled={Boolean(busy) || (isLiveConfigured && !isOwner)} type="submit">Schedule</button></div><div className="mt-5 rounded-2xl bg-[#e7ecea] p-4 text-sm"><div className="flex justify-between"><span>Current adjudication fee</span><strong>{(Number(config.fee_bps ?? 0) / 100).toFixed(2)}%</strong></div><div className="mt-2 flex justify-between"><span>Cooperative settlements</span><strong>0%</strong></div><div className="mt-2 flex justify-between"><span>Activation delay</span><strong>24 hours</strong></div><div className="mt-2 flex justify-between"><span>Signed agreements</span><strong>Unaffected</strong></div></div><button type="button" className="court-secondary mt-4 w-full" onClick={() => void transact("Apply scheduled fee", "apply_scheduled_fee")}>Apply matured change</button></form><article className="rounded-[28px] bg-[#163d3a] p-6 text-white sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#aac0ba]">Authority boundary</p><h2 className="mt-2 text-2xl font-black">The court owner has no gavel.</h2></div><span className="grid h-12 w-12 place-items-center rounded-full bg-[#f1c969] text-xl font-black text-[#163d3a]">§</span></div><div className="mt-7 grid gap-3 sm:grid-cols-2">{[["Agreement edits","Impossible after creation"],["Evidence deletion","No owner method"],["Verdict override","No owner method"],["Free-form payouts","Exact buckets only"],["Evidence retries","Bounded to two"],["Fallback","Accepted 50/50 rule"]].map(([title,value]) => <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/8" key={title}><p className="text-xs text-[#aac0ba]">{title}</p><p className="mt-1 text-sm font-black">{value}</p></div>)}</div></article></div></section>}

    <footer className="border-t border-[#173d39]/10"><div className="mx-auto flex max-w-[1460px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs font-semibold text-[#70817c] sm:px-10 lg:px-14"><p>Dispute Court · independent GenLayer product</p><p>Bilateral terms · verified evidence · bounded adjudication</p></div></footer>
  </main>;
}
