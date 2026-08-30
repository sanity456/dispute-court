"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  contractAddress,
  formatGen,
  isLiveConfigured,
  parseGen,
  readContract,
  shortAddress,
} from "../lib/genlayer";
import {
  agreementActions,
  agreementDeadline,
  agreementRole,
  normalizeAgreement,
  record,
  type Agreement,
} from "../lib/lifecycle";
import { errorMessage, useProtocol, type Protocol } from "../lib/useProtocol";
import { EvidenceCapture } from "./EvidenceCapture";
import { ActivityPanel } from "./ActivityPanel";
import { DirectoryPanel } from "./DirectoryPanel";
import { RecordTools, SessionStrip } from "./RecordTools";
import { HelpPanel } from "./HelpPanel";
import { OwnerDesk } from "./OwnerDesk";
import { PublishReview, type PublishDraft } from "./PublishReview";
import { templates } from "../lib/templates";

type Tab =
  "cases" | "agreements" | "mywork" | "create" | "activity" | "help" | "owner";
const tabs: [Tab, string][] = [
  ["cases", "Case workspace"],
  ["agreements", "Agreements"],
  ["mywork", "My work"],
  ["create", "Create"],
  ["activity", "Activity"],
  ["help", "Help & settings"],
  ["owner", "Owner"],
];
const shell = "mx-auto max-w-[1420px] px-5 sm:px-10 lg:px-14";
function label(value: string) {
  return value.replaceAll("_", " ");
}
function date(value: number) {
  return value
    ? new Date(value * 1000).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Pending prior step";
}
function Field({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="court-field">
      <span>{title}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Stat({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="stat-card">
      <p className="court-eyebrow">{title}</p>
      <p className="mt-3 break-words text-3xl font-black tracking-tight">
        {value}
      </p>
      <p className="mt-2 text-xs text-[#70817c]">{note}</p>
    </div>
  );
}
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="court-surface p-8">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-[#657b73]">{children}</p>
    </div>
  );
}
function publicUrl(value: unknown) {
  const url = String(value ?? "");
  return /^https:\/\//i.test(url) ? url : "";
}

export default function ProductHome({
  initialId = "",
}: {
  initialId?: string;
}) {
  const protocol = useProtocol("list_agreements");
  return (
    <ProductWorkspace
      key={protocol.session?.wallet ?? "signed-out"}
      protocol={protocol}
      initialId={initialId}
    />
  );
}
function ProductWorkspace({
  protocol,
  initialId,
}: {
  protocol: Protocol;
  initialId: string;
}) {
  const router = useRouter();
  const {
    wallet,
    stats,
    config,
    credit,
    busy,
    ready,
    now,
    notice,
    setNotice,
    transact,
  } = protocol;
  const [tab, setTab] = useState<Tab>("cases");
  const [selectedId, setSelectedId] = useState(initialId);
  const [supportContext, setSupportContext] = useState({ hash: "", id: "" });
  const [draft, setDraft] = useState<PublishDraft | null>(null);
  const [templateIndex, setTemplateIndex] = useState(0);
  const template = templates[templateIndex];
  function support(hash: string, id: string) {
    setSupportContext({ hash, id });
    setTab("help");
  }
  const [detail, setDetail] = useState<{
    key: string;
    agreement: Agreement;
    attempt: Record<string, unknown> | null;
  } | null>(null);
  const [detailError, setDetailError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [settlementConfirmed, setSettlementConfirmed] = useState(false);
  const agreements = useMemo(
    () =>
      protocol.items
        .map(normalizeAgreement)
        .filter(
          (p) =>
            protocol.session?.preferences.includeFixtures ||
            !/^(lifecycle-|value-probe-|verified-source-)/.test(p.id),
        ),
    [protocol.items, protocol.session?.preferences],
  );
  const agreementId = selectedId || agreements[0]?.id || "";
  const detailKey = [agreementId, protocol.revision].join("|");
  const selected = detail?.key === detailKey ? detail : null;
  const agreement = selected?.agreement;
  const role = agreement ? agreementRole(agreement, wallet) : "visitor";
  const actions = agreement ? agreementActions(agreement, wallet, now) : null;
  const owner = String(config?.owner ?? "");
  const isOwner = Boolean(
    wallet && owner && wallet.toLowerCase() === owner.toLowerCase(),
  );
  const disabled = Boolean(busy) || !ready;
  const pendingFeeAt = Number(config?.pending_fee_effective_at ?? 0);

  useEffect(() => {
    let cancelled = false;
    const task = window.setTimeout(async () => {
      setReviewed(false);
      setSettlementConfirmed(false);
      setDetailError("");
      if (!agreementId || !isLiveConfigured || !protocol.session?.signedIn)
        return;
      try {
        const value = normalizeAgreement(
          await readContract("get_agreement", [agreementId]),
        );
        const attempt = value.resolution_attempt_count
          ? record(
              await readContract("get_resolution_attempt", [
                agreementId,
                value.resolution_attempt_count,
              ]),
            )
          : null;
        if (!cancelled)
          setDetail({ key: detailKey, agreement: value, attempt });
      } catch (failure) {
        if (!cancelled) setDetailError(errorMessage(failure));
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(task);
    };
  }, [agreementId, detailKey, protocol.session?.signedIn]);
  useEffect(() => {
    const task = window.setTimeout(() => {
      setReviewed(false);
      setSettlementConfirmed(false);
    }, 0);
    return () => window.clearTimeout(task);
  }, [wallet]);

  function openAgreement(id: string) {
    if (!id) return;
    router.push("/agreements/" + encodeURIComponent(id));
    setSelectedId(id);
    setReviewed(false);
    setSettlementConfirmed(false);
    setTab("cases");
  }
  async function createAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const partyB = String(data.get("party_b")).trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(partyB) || /^0x0{40}$/.test(partyB))
        throw new Error("Party B must be a non-zero wallet address.");
      if (wallet && partyB.toLowerCase() === wallet.toLowerCase())
        throw new Error("Party B must be a different wallet.");
      const amount = parseGen(String(data.get("amount")));
      if (amount <= 0n)
        throw new Error("Escrow amount must be greater than zero.");
      const id =
        String(data.get("agreement_id") ?? "").trim() ||
        "agreement-" + crypto.randomUUID().slice(0, 12);
      const args = [
        id,
        partyB,
        String(data.get("title")),
        String(data.get("summary")),
        String(data.get("criteria")),
        amount,
        ...[
          "acceptance_days",
          "funding_days",
          "performance_days",
          "response_days",
          "evidence_days",
        ].map((key) => Number(data.get(key)) * 86400),
      ];
      setDraft({
        id,
        args,
        fields: [
          ["Agreement ID", id],
          ["Party A", wallet || "The wallet that signs creation"],
          ["Party B", partyB],
          ["Title", String(data.get("title"))],
          ["Summary", String(data.get("summary"))],
          ["Decision criteria", String(data.get("criteria"))],
          ["Test escrow", formatGen(amount.toString()) + " GEN"],
          ["Future adjudication fee", Number(config?.fee_bps ?? 0) / 100 + "%"],
          [
            "Windows",
            "Accept " +
              data.get("acceptance_days") +
              "d · fund " +
              data.get("funding_days") +
              "d · perform " +
              data.get("performance_days") +
              "d · respond " +
              data.get("response_days") +
              "d · evidence " +
              data.get("evidence_days") +
              "d",
          ],
          [
            "Accepted consequences",
            "Missing the response deadline permits a no-show ruling. Bounded retries end in a 50/50 split of net escrow.",
          ],
        ],
      });
    } catch (failure) {
      setNotice({ kind: "error", text: errorMessage(failure) });
    }
  }
  async function publishAgreement() {
    if (!draft) return;
    if (await transact("Create agreement", "create_agreement", draft.args)) {
      const id = draft.id;
      setDraft(null);
      openAgreement(id);
    }
  }
  async function evidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreement || !actions?.evidence) return;
    const data = new FormData(event.currentTarget);
    try {
      const digest = String(data.get("digest") ?? "").trim();
      if (!/^[0-9a-fA-F]{64}$/.test(digest))
        throw new Error(
          "Capture and review the public source before committing evidence.",
        );
      const url = String(data.get("url") ?? "");
      if (
        agreement.evidence.some(
          (exhibit) =>
            String(exhibit.submitted_by).toLowerCase() ===
              wallet.toLowerCase() &&
            exhibit.url === url &&
            exhibit.expected_digest === digest.toLowerCase(),
        )
      )
        throw new Error(
          "You already submitted this source and digest. Review the existing exhibit instead of spending another evidence slot.",
        );
      await transact("Submit evidence", "submit_evidence", [
        agreement.id,
        String(data.get("note")),
        url,
        digest,
      ]);
    } catch (failure) {
      setNotice({ kind: "error", text: errorMessage(failure) });
    }
  }

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[#edf1ef] text-[#172522]"
    >
      <nav className="sticky top-0 z-40 border-b border-[#163d3a]/10 bg-[#edf1ef]/95 backdrop-blur-xl">
        <div
          className={shell + " flex items-center justify-between gap-4 py-4"}
        >
          <button
            className="flex items-center gap-3 text-left"
            onClick={() => setTab("cases")}
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#163d3a] text-sm font-black text-[#f1c969]">
              DC
            </span>
            <span>
              <strong className="block text-sm">Dispute Court</strong>
              <small className="text-[10px] font-bold uppercase tracking-widest text-[#70817c]">
                Agreement-first resolution
              </small>
            </span>
          </button>
          <div className="hidden rounded-full bg-white/60 p-1 text-sm 2xl:flex">
            {tabs.map(([id, title]) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                className={
                  "court-nav-pill " + (tab === id ? "court-nav-active" : "")
                }
                onClick={() => setTab(id)}
              >
                {title}
              </button>
            ))}
          </div>
          <button
            className="court-wallet"
            disabled={Boolean(busy)}
            onClick={() => void protocol.connect()}
          >
            {wallet ? shortAddress(wallet) : "Sign in with wallet"}
          </button>
        </div>
        <div className={shell + " flex gap-2 overflow-x-auto pb-3 2xl:hidden"}>
          {tabs.map(([id, title]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              className={
                "court-mobile-tab " + (tab === id ? "court-mobile-active" : "")
              }
              onClick={() => setTab(id)}
            >
              {title}
            </button>
          ))}
        </div>
      </nav>
      <div className={shell + " pt-4"}>
        <div className="court-mode court-live">
          <strong>Studionet · sandbox</strong>
          <span>
            {isLiveConfigured
              ? shortAddress(contractAddress) +
                " · finalized contract data · test GEN only"
              : "Contract not configured. Transactions are disabled."}
          </span>
          <button
            className="ml-auto underline"
            onClick={protocol.refresh}
            disabled={protocol.loading || Boolean(busy)}
          >
            {protocol.loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <SessionStrip protocol={protocol} />
        {protocol.error && (
          <div className="court-notice court-notice-error" role="alert">
            <b>!</b>
            <p>
              {protocol.error} Previous data may be stale; actions are disabled.
            </p>
            <button aria-label="Retry loading" onClick={protocol.refresh}>
              ↻
            </button>
          </div>
        )}
        {notice && (
          <div
            className={"court-notice court-notice-" + notice.kind}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            <b>{notice.kind === "success" ? "✓" : "!"}</b>
            <div>
              <p>{notice.text}</p>
              {notice.hash && (
                <code className="mt-2 block break-all text-[11px]">
                  {notice.hash}
                </code>
              )}
            </div>
            <button
              aria-label="Dismiss message"
              onClick={() => setNotice(null)}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {tab === "cases" && (
        <>
          <section
            className={shell + " grid gap-8 py-12 lg:grid-cols-[1.06fr_.94fr]"}
          >
            <div className="py-6">
              <p className="court-eyebrow">
                A shared record. A defined way forward.
              </p>
              <h1 className="mt-7 text-[clamp(3.3rem,7vw,6.6rem)] font-black leading-[.92] tracking-[-.07em] text-[#163d3a]">
                Agree first.
                <br />
                Resolve with
                <br />
                <span className="text-[#9d7828]">a clear record.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#60756e]">
                Define the work and the fallback before escrow is funded. If
                things go wrong, both parties get a visible process—not a
                surprise ruling.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  className="court-primary"
                  onClick={() => setTab("create")}
                >
                  Create an agreement ↗
                </button>
                <button
                  className="court-secondary"
                  onClick={() =>
                    document
                      .getElementById("workspace")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Open case workspace
                </button>
              </div>
            </div>
            <aside className="rounded-[34px] bg-[#163d3a] p-7 text-white shadow-xl sm:p-9">
              <p className="text-xs font-bold uppercase tracking-widest text-[#b4c9c3]">
                The process both parties accept
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight">
                No escrow before agreement.
                <br />
                No ruling without a process.
              </h2>
              <ol className="mt-8 space-y-5">
                {[
                  [
                    "01",
                    "Agree",
                    "Party A publishes. Named Party B reviews and accepts the exact terms.",
                  ],
                  [
                    "02",
                    "Fund & perform",
                    "Party A funds the exact amount. Release or refund cooperatively with no court fee.",
                  ],
                  [
                    "03",
                    "Respond & present evidence",
                    "A named responder gets a deadline. Missing it allows a no-show ruling.",
                  ],
                  [
                    "04",
                    "Resolve & claim credit",
                    "Consensus uses fixed payout buckets. Bounded evidence retries end in the accepted 50/50 fallback.",
                  ],
                ].map(([step, title, description]) => (
                  <li key={step} className="flex gap-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f1c969] text-xs font-black text-[#163d3a]">
                      {step}
                    </span>
                    <div>
                      <h3 className="text-sm font-black">{title}</h3>
                      <p className="mt-1 text-xs leading-5 text-[#bbcdc7]">
                        {description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-7 border-t border-white/15 pt-5 text-xs leading-6 text-[#bbcdc7]">
                A Studionet product experiment—not a legal court, legal advice,
                or a promise of a correct AI ruling. Evidence is public.
              </p>
            </aside>
          </section>
          <section id="workspace" className={shell + " pb-16"}>
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="court-eyebrow">Case workspace</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  The record, not the noise.
                </h2>
              </div>
              <div className="w-full sm:w-96">
                <Field title="Select an agreement">
                  <select
                    value={agreementId}
                    onChange={(e) => openAgreement(e.target.value)}
                  >
                    <option value="" disabled>
                      Select an agreement
                    </option>
                    {agreements.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <form
              className="mt-5 flex max-w-xl gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                openAgreement(
                  String(new FormData(e.currentTarget).get("lookup")).trim(),
                );
              }}
            >
              <Field title="Open an agreement by ID">
                <input
                  name="lookup"
                  required
                  maxLength={80}
                  placeholder="Agreement ID from your counterparty"
                />
              </Field>
              <button className="court-secondary self-end" type="submit">
                Open
              </button>
            </form>
            <div className="court-surface mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="court-eyebrow">
                  Your withdrawable contract credit
                </p>
                <p className="mt-2 text-xl font-black">
                  {wallet
                    ? credit === null
                      ? "Loading…"
                      : formatGen(credit) + " GEN"
                    : "Connect wallet to view"}
                </p>
                {protocol.creditError && (
                  <p className="mt-2 text-xs text-red-800">
                    Credit unavailable: {protocol.creditError}
                  </p>
                )}
                <p className="mt-2 text-xs text-[#70817c]">
                  Credits aggregate across your agreements. Withdrawal emits a
                  separate transfer.
                </p>
              </div>
              <button
                className="court-primary"
                disabled={disabled || credit === null || BigInt(credit) <= 0n}
                onClick={() => void transact("Withdraw credit", "withdraw")}
              >
                Withdraw credit
              </button>
            </div>
            {detailError ? (
              <div className="mt-6" role="alert">
                <Empty title="Agreement could not be loaded">
                  {detailError}
                </Empty>
              </div>
            ) : !agreement ? (
              <div className="mt-6">
                <Empty
                  title={
                    agreementId ? "Loading agreement…" : "No agreement selected"
                  }
                >
                  {agreementId
                    ? "Reading the full terms, evidence, and current state."
                    : "Create an agreement or enter its ID above. There are no fabricated cases or outcomes in this workspace."}
                </Empty>
              </div>
            ) : (
              <div className="mt-7 grid items-start gap-6 lg:grid-cols-[1.15fr_.85fr]">
                <div className="space-y-6">
                  <article className="court-surface p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="court-eyebrow break-all">
                        {agreement.id}
                      </span>
                      <span className="court-status">
                        {label(agreement.status)}
                      </span>
                    </div>
                    <h2 className="mt-4 text-3xl font-black tracking-tight">
                      {agreement.title}
                    </h2>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#60756e]">
                      {agreement.summary}
                    </p>
                    <h3 className="mt-6 text-sm font-black">
                      Agreed decision criteria
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-[#e5ebe7] p-4 text-sm leading-7">
                      {agreement.criteria}
                    </p>
                    <dl className="mt-6 grid grid-cols-2 gap-5 text-sm">
                      {[
                        ["Party A · funder", agreement.party_a],
                        ["Party B · counterparty", agreement.party_b],
                        ["Escrow", formatGen(agreement.amount_wei) + " GEN"],
                        ["Adjudication fee", agreement.fee_bps / 100 + "%"],
                        [
                          "Acceptance deadline",
                          date(agreement.acceptance_deadline),
                        ],
                        [
                          "Funding window",
                          agreement.funding_window_seconds / 3600 +
                            " hours after acceptance",
                        ],
                        [
                          "Performance window",
                          agreement.performance_window_seconds / 3600 +
                            " hours after funding",
                        ],
                        [
                          "Response window",
                          agreement.response_window_seconds / 3600 +
                            " hours after dispute",
                        ],
                        [
                          "Evidence window",
                          agreement.evidence_window_seconds / 3600 +
                            " hours after response",
                        ],
                        ["Fallback", "50/50 after two evidence reopens"],
                        ...(agreement.protocol_version === 3
                          ? [
                              ["Timeout split", "50/50, no fee"],
                              [
                                "Resolution deadline",
                                agreement.resolution_deadline
                                  ? date(agreement.resolution_deadline)
                                  : "Response window + 3 evidence windows + 48 hours after dispute",
                              ],
                              ["Source limit", "6 KB per complete source"],
                            ]
                          : []),
                      ].map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-xs text-[#70817c]">{key}</dt>
                          <dd className="mt-1 break-words font-bold">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-6 rounded-2xl border border-[#a17925]/20 bg-[#f6edcf] p-4 text-xs leading-6">
                      <strong>Key risks.</strong> Disputes can start immediately
                      after funding. Missing the response deadline can cost you
                      the entire net escrow.
                      <details className="mt-2">
                        <summary className="cursor-pointer font-bold">
                          Fees & outcomes
                        </summary>
                        <p>
                          Cooperative release or refund has no court fee.
                          Rulings and no-shows charge the agreed fee. Party A
                          receives 0/25/50/75/100% after fees; the evidence
                          fallback is 50/50 after bounded retries.
                          {agreement.protocol_version === 3 &&
                            " After the fixed resolution deadline, either party can split the full escrow equally without a fee."}
                        </p>
                      </details>
                    </div>
                    <details className="mt-5 text-xs">
                      <summary className="cursor-pointer font-bold">
                        Immutable terms hash
                      </summary>
                      <code className="mt-3 block break-all">
                        {agreement.terms_hash}
                      </code>
                    </details>
                    {(actions?.accept || actions?.fund) && (
                      <div className="mt-6 border-t border-[#163d3a]/10 pt-5">
                        <label className="flex items-start gap-3 text-xs leading-6">
                          <input
                            className="mt-1"
                            type="checkbox"
                            checked={reviewed}
                            onChange={(e) => setReviewed(e.target.checked)}
                          />
                          <span>
                            I reviewed the parties, exact{" "}
                            {formatGen(agreement.amount_wei)} GEN amount,
                            deadlines, fee, no-show rule, and fallback. This is
                            a Studionet test agreement.
                          </span>
                        </label>
                        {actions.accept && (
                          <button
                            className="court-primary mt-4"
                            disabled={disabled || !reviewed}
                            onClick={() =>
                              void transact(
                                "Accept agreement",
                                "accept_agreement",
                                [agreement.id],
                              )
                            }
                          >
                            Accept immutable agreement
                          </button>
                        )}
                        {actions.fund && (
                          <button
                            className="court-primary mt-4"
                            disabled={disabled || !reviewed}
                            onClick={() =>
                              void transact(
                                "Fund agreement",
                                "fund_agreement",
                                [agreement.id],
                                BigInt(agreement.amount_wei),
                              )
                            }
                          >
                            Fund exactly {formatGen(agreement.amount_wei)} GEN
                          </button>
                        )}
                      </div>
                    )}
                    {!wallet && (
                      <button
                        className="court-primary mt-6"
                        disabled={Boolean(busy)}
                        onClick={() => void protocol.connect()}
                      >
                        Connect your party wallet
                      </button>
                    )}
                    {actions?.cancel && (
                      <button
                        className="court-secondary mt-5"
                        disabled={disabled}
                        onClick={() =>
                          void transact(
                            "Cancel unfunded agreement",
                            "cancel_expired_agreement",
                            [agreement.id],
                          )
                        }
                      >
                        Cancel unfunded agreement
                      </button>
                    )}
                  </article>
                  {(agreement.opening_claim || agreement.response) && (
                    <article className="court-surface p-6">
                      <h3 className="text-xl font-black">
                        The parties’ statements
                      </h3>
                      <div className="mt-5">
                        <p className="court-eyebrow">
                          Opening claim ·{" "}
                          {shortAddress(agreement.dispute_opener)}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                          {agreement.opening_claim}
                        </p>
                      </div>
                      <div className="mt-6 border-t border-[#163d3a]/10 pt-5">
                        <p className="court-eyebrow">
                          Response · {shortAddress(agreement.dispute_responder)}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                          {agreement.response ||
                            "No response has been recorded."}
                        </p>
                      </div>
                    </article>
                  )}
                  <article className="court-surface p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black">Evidence record</h3>
                      <span className="court-status">
                        {agreement.evidence.length} exhibits
                      </span>
                    </div>
                    {!agreement.evidence.length ? (
                      <p className="mt-4 text-sm text-[#70817c]">
                        No exhibits have been submitted.
                      </p>
                    ) : (
                      <ol className="mt-5 space-y-4">
                        {agreement.evidence.map((exhibit) => (
                          <li
                            key={String(exhibit.id)}
                            className="rounded-2xl bg-[#e5ebe7] p-4"
                          >
                            <p className="text-xs font-black">
                              {String(exhibit.id)} ·{" "}
                              {label(String(exhibit.party))}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                              {String(exhibit.note)}
                            </p>
                            {publicUrl(exhibit.url) && (
                              <a
                                className="mt-3 block break-all text-xs underline"
                                href={publicUrl(exhibit.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Open public source ↗
                              </a>
                            )}
                            <details className="mt-3 text-xs">
                              <summary>Committed digest & timestamp</summary>
                              <code className="mt-2 block break-all">
                                {String(exhibit.expected_digest)}
                              </code>
                              <p className="mt-2">
                                {String(exhibit.submitted_at)}
                              </p>
                            </details>
                          </li>
                        ))}
                      </ol>
                    )}
                  </article>
                  {agreement.status === "resolved" && (
                    <article className="rounded-[28px] bg-[#163d3a] p-7 text-white">
                      <p className="text-xs uppercase tracking-widest text-[#b4c9c3]">
                        Recorded resolution
                      </p>
                      <h3 className="mt-3 text-2xl font-black">
                        {label(
                          String(
                            agreement.verdict.resolution_type ?? "resolved",
                          ),
                        )}
                      </h3>
                      <p className="mt-4 text-sm leading-7 text-[#bbcdc7]">
                        {String(agreement.verdict.reasoning ?? "")}
                      </p>
                      <div className="mt-6 grid grid-cols-3 gap-4">
                        {[
                          ["Party A", agreement.paid.party_a_wei],
                          ["Party B", agreement.paid.party_b_wei],
                          ["Fee", agreement.paid.fee_wei],
                        ].map(([title, value]) => (
                          <div key={String(title)}>
                            <p className="text-xs text-[#bbcdc7]">
                              {String(title)}
                            </p>
                            <p className="mt-2 break-words font-black">
                              {formatGen(String(value ?? "0"))} GEN
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-6 text-xs leading-6 text-[#bbcdc7]">
                        These are contract credit allocations, not proof of
                        delivered wallet funds. Explanation provenance:{" "}
                        {label(
                          String(agreement.verdict.reasoning_provenance ?? ""),
                        )}
                        .
                      </p>
                    </article>
                  )}
                </div>
                <aside className="space-y-6">
                  <RecordTools
                    key={agreement.id}
                    record={agreement as unknown as Record<string, unknown>}
                    protocol={protocol}
                    onSupport={support}
                  />
                  <article className="rounded-[28px] bg-[#f1c969] p-6">
                    <p className="court-eyebrow text-[#735b27]">Your role</p>
                    <h3 className="mt-3 text-2xl font-black">
                      {role === "party_a"
                        ? "Party A · funder"
                        : role === "party_b"
                          ? "Party B · counterparty"
                          : "Read-only visitor"}
                    </h3>
                    <p className="mt-4 text-sm leading-7">
                      Current state: <strong>{label(agreement.status)}</strong>
                    </p>
                    {agreementDeadline(agreement) > 0 && (
                      <p className="mt-2 text-sm leading-7">
                        Current deadline:{" "}
                        <strong>{date(agreementDeadline(agreement))}</strong>
                      </p>
                    )}
                    <p className="mt-4 text-xs leading-6">
                      Your wallet controls which actions are available. Device
                      time is a guide; contract time decides deadlines. Allow
                      several minutes for consensus.
                    </p>
                  </article>
                  <article className="court-surface p-6">
                    <h3 className="text-lg font-black">Recorded milestones</h3>
                    <ol className="mt-5 space-y-4">
                      {[
                        ["Created", agreement.created_at],
                        ["Accepted", agreement.accepted_at],
                        ["Funded", agreement.funded_at],
                        ["Resolved / cancelled", agreement.resolved_at],
                      ].map(([title, time]) => (
                        <li
                          key={title}
                          className="border-l-2 border-[#a17925]/30 pl-4"
                        >
                          <p className="text-sm font-bold">{title}</p>
                          <p className="mt-1 text-xs text-[#70817c]">
                            {time
                              ? new Date(time).toLocaleString()
                              : "Not recorded"}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </article>
                  {(actions?.release || actions?.refund) && (
                    <article className="court-surface p-6">
                      <h3 className="text-xl font-black">
                        Settle cooperatively
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#70817c]">
                        {actions.release
                          ? "Release the entire escrow as Party B’s credit."
                          : "Return the entire escrow as Party A’s credit."}{" "}
                        No court fee applies. This cannot be undone.
                      </p>
                      <label className="mt-4 flex items-start gap-3 text-xs leading-6">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={settlementConfirmed}
                          onChange={(e) =>
                            setSettlementConfirmed(e.target.checked)
                          }
                        />
                        <span>
                          I confirm the full {formatGen(agreement.amount_wei)}{" "}
                          GEN allocation to{" "}
                          {actions.release ? "Party B" : "Party A"}.
                        </span>
                      </label>
                      <button
                        className="court-primary mt-4 w-full"
                        disabled={disabled || !settlementConfirmed}
                        onClick={() =>
                          void transact(
                            actions.release
                              ? "Release to Party B"
                              : "Refund Party A",
                            actions.release
                              ? "release_to_party_b"
                              : "refund_to_party_a",
                            [agreement.id],
                          )
                        }
                      >
                        {actions.release
                          ? "Release to Party B"
                          : "Refund Party A"}
                      </button>
                    </article>
                  )}
                  {actions?.dispute && (
                    <form
                      className="court-surface space-y-4 p-6"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void transact("Open dispute", "open_dispute", [
                          agreement.id,
                          String(new FormData(e.currentTarget).get("claim")),
                        ]);
                      }}
                    >
                      <h3 className="text-xl font-black">Open a dispute</h3>
                      <Field title="Explain the disagreement">
                        <textarea
                          name="claim"
                          required
                          maxLength={2000}
                          rows={4}
                        />
                      </Field>
                      <p className="text-xs leading-6 text-[#70817c]">
                        Starts the other party’s response deadline.
                        {agreement.protocol_version === 3 &&
                          " You can still give the full escrow to the other party."}
                      </p>
                      <button
                        className="court-secondary w-full"
                        disabled={disabled}
                      >
                        Submit opening claim
                      </button>
                    </form>
                  )}
                  {actions?.respond && (
                    <form
                      className="court-surface space-y-4 p-6"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void transact(
                          "Respond to dispute",
                          "respond_to_dispute",
                          [
                            agreement.id,
                            String(
                              new FormData(e.currentTarget).get("response"),
                            ),
                          ],
                        );
                      }}
                    >
                      <h3 className="text-xl font-black">
                        Your response is due
                      </h3>
                      <Field title="Respond to the opening claim">
                        <textarea
                          name="response"
                          required
                          maxLength={2000}
                          rows={5}
                        />
                      </Field>
                      <button
                        className="court-primary w-full"
                        disabled={disabled}
                      >
                        Submit response
                      </button>
                    </form>
                  )}
                  {actions?.evidence && (
                    <form
                      className="court-surface space-y-4 p-6"
                      onSubmit={evidence}
                    >
                      <h3 className="text-xl font-black">Add an exhibit</h3>
                      <Field title="What does this evidence establish?">
                        <textarea
                          name="note"
                          required
                          maxLength={800}
                          rows={3}
                        />
                      </Field>
                      <EvidenceCapture
                        key={agreement.id + "|" + wallet}
                        protocol={protocol}
                      />
                      <p className="text-xs leading-6 text-[#70817c]">
                        Public evidence only. URLs, notes and digests are
                        permanent. Ten exhibits per party; adding evidence
                        resets Ready.
                      </p>
                      <button
                        className="court-primary w-full"
                        disabled={disabled}
                      >
                        Commit evidence
                      </button>
                    </form>
                  )}
                  {agreement.status === "evidence" && (
                    <article className="court-surface p-6">
                      <h3 className="text-xl font-black">
                        Ready for a decision?
                      </h3>
                      <p className="mt-4 text-sm">
                        Party A:{" "}
                        {agreement.party_a_ready ? "ready" : "not ready"} ·
                        Party B:{" "}
                        {agreement.party_b_ready ? "ready" : "not ready"}
                      </p>
                      <p className="mt-3 text-xs leading-6 text-[#70817c]">
                        When both parties are ready, evidence closes early.
                        Otherwise anyone can close it after the deadline.
                      </p>
                      {actions?.ready && (
                        <button
                          className="court-primary mt-5"
                          disabled={disabled}
                          onClick={() =>
                            void transact("Mark evidence ready", "mark_ready", [
                              agreement.id,
                            ])
                          }
                        >
                          I have finished submitting evidence
                        </button>
                      )}
                      {actions?.closeEvidence && (
                        <button
                          className="court-secondary mt-5"
                          disabled={disabled}
                          onClick={() =>
                            void transact(
                              "Close evidence window",
                              "close_evidence",
                              [agreement.id],
                            )
                          }
                        >
                          Close expired evidence window
                        </button>
                      )}
                    </article>
                  )}
                  {actions?.noShow && (
                    <article className="court-surface p-6">
                      <h3 className="text-xl font-black">
                        Response window expired
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#70817c]">
                        The signed no-show rule allocates the net escrow to{" "}
                        {shortAddress(agreement.dispute_opener)}. The
                        adjudication fee applies.
                      </p>
                      <button
                        className="court-primary mt-5"
                        disabled={disabled}
                        onClick={() =>
                          void transact(
                            "Apply no-show rule",
                            "resolve_no_show",
                            [agreement.id],
                          )
                        }
                      >
                        Apply agreed no-show rule
                      </button>
                    </article>
                  )}
                  {actions?.resolve && (
                    <article className="court-surface p-6">
                      <h3 className="text-xl font-black">
                        Ready for consensus
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#70817c]">
                        Validators will evaluate the terms and evidence. An
                        unclear result may reopen evidence instead of settling.
                      </p>
                      <button
                        className="court-primary mt-5"
                        disabled={disabled}
                        onClick={() =>
                          void transact("Request resolution", "resolve", [
                            agreement.id,
                          ])
                        }
                      >
                        Request consensus resolution
                      </button>
                    </article>
                  )}
                  {actions?.timeout && (
                    <article className="court-surface p-6">
                      <h3 className="text-xl font-black">
                        Resolution timed out
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#70817c]">
                        Split the full escrow equally. No court fee applies.
                      </p>
                      <button
                        className="court-primary mt-5"
                        disabled={disabled}
                        onClick={() =>
                          void transact(
                            "Apply fee-free timeout split",
                            "resolve_timeout_split",
                            [agreement.id],
                          )
                        }
                      >
                        Apply agreed timeout split
                      </button>
                    </article>
                  )}
                  {actions?.fallback && (
                    <article className="court-surface p-6">
                      <h3 className="text-xl font-black">
                        Evidence retries exhausted
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#70817c]">
                        Either party can apply the previously accepted 50/50
                        split of net escrow. The snapshotted fee applies.
                      </p>
                      <button
                        className="court-primary mt-5"
                        disabled={disabled}
                        onClick={() =>
                          void transact(
                            "Apply 50/50 fallback",
                            "resolve_fallback_split",
                            [agreement.id],
                          )
                        }
                      >
                        Apply agreed 50/50 fallback
                      </button>
                    </article>
                  )}
                  {selected?.attempt && (
                    <article className="court-surface p-6">
                      <p className="court-eyebrow">Latest consensus attempt</p>
                      <h3 className="mt-3 text-xl font-black">
                        {label(String(selected.attempt.outcome ?? ""))}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[#70817c]">
                        {String(selected.attempt.reasoning ?? "")}
                      </p>
                      <p className="mt-4 text-xs text-[#70817c]">
                        Attempt {agreement.resolution_attempt_count} · evidence
                        reopens {agreement.reopen_count}/2 · leader explanation
                        is non-authoritative.
                      </p>
                      {agreement.last_source_observations.length > 0 && (
                        <ul className="mt-4 space-y-2 text-xs text-[#70817c]">
                          {agreement.last_source_observations.map((source) => (
                            <li key={String(source.id)}>
                              {String(source.id)} ·{" "}
                              {source.status === "verified"
                                ? "Verified"
                                : "Excluded: " + label(String(source.status))}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  )}
                </aside>
              </div>
            )}
          </section>
        </>
      )}

      {tab === "agreements" && (
        <section className={shell + " py-12"}>
          <DirectoryPanel protocol={protocol} onOpen={openAgreement} />
        </section>
      )}

      {tab === "create" && (
        <section
          className={shell + " grid gap-8 py-12 lg:grid-cols-[1fr_340px]"}
        >
          <div>
            <p className="court-eyebrow">Agreement builder</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Agree on what good
              <br />
              looks like.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#60756e]">
              Your connected wallet becomes Party A. Party B must accept before
              you can fund. Creation itself does not move funds.
            </p>
            <div className="product-template mt-7">
              <label className="product-field">
                <span>Start from a template</span>
                <select
                  value={templateIndex}
                  onChange={(e) => setTemplateIndex(Number(e.target.value))}
                >
                  {templates.map((t, i) => (
                    <option key={t.id} value={i}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="product-muted">
                Changing templates replaces unsaved form fields. Review and
                tailor all terms.
              </p>
            </div>
            <form
              key={template.id}
              className="court-surface mt-8 space-y-5 p-6 sm:p-8"
              onSubmit={createAgreement}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field title="Agreement title">
                  <input
                    name="title"
                    required
                    maxLength={140}
                    defaultValue={template.title}
                  />
                </Field>
                <Field
                  title="Agreement ID"
                  hint="Optional; generated if blank."
                >
                  <input name="agreement_id" maxLength={80} />
                </Field>
              </div>
              <Field title="Party B wallet address">
                <input
                  name="party_b"
                  required
                  pattern="0x[a-fA-F0-9]{40}"
                  maxLength={42}
                  placeholder="0x…"
                />
              </Field>
              <Field title="What is being agreed?">
                <textarea
                  name="summary"
                  required
                  maxLength={1000}
                  rows={3}
                  defaultValue={template.summary}
                />
              </Field>
              <Field
                title="Decision criteria"
                hint="Define deliverables, acceptance standards, evidence, and how partial completion should be assessed."
              >
                <textarea
                  name="criteria"
                  required
                  maxLength={4000}
                  rows={5}
                  defaultValue={template.rules}
                />
              </Field>
              <Field title="Test escrow amount (GEN)">
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  pattern="[0-9]+([.][0-9]{1,18})?"
                  defaultValue="0.001"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  ["acceptance_days", "Acceptance window (days)", 3, 30],
                  ["funding_days", "Funding window (days)", 3, 30],
                  ["performance_days", "Performance window (days)", 14, 365],
                  ["response_days", "Dispute response (days)", 3, 30],
                  ["evidence_days", "Evidence window (days)", 3, 30],
                ].map(([name, title, value, max]) => (
                  <Field key={String(name)} title={String(title)}>
                    <input
                      name={String(name)}
                      type="number"
                      min="1"
                      max={Number(max)}
                      defaultValue={Number(value)}
                      required
                    />
                  </Field>
                ))}
              </div>
              <label className="flex items-start gap-3 rounded-2xl bg-[#f6edcf] p-4 text-xs leading-6">
                <input type="checkbox" required className="mt-1" />
                <span>
                  I accept the no-show rule, fee, public evidence, payout
                  buckets and 50/50 fallback after bounded retries. The fee-free
                  timeout split becomes available after the response window,
                  three evidence windows and 48 hours from the dispute. These
                  terms become fixed once both parties accept.
                </span>
              </label>
              <button className="court-primary" disabled={disabled}>
                {busy === "Create agreement"
                  ? "Waiting for finality…"
                  : "Review agreement before publishing"}
              </button>
            </form>
          </div>
          <aside className="space-y-5 lg:pt-24">
            <article className="rounded-[28px] bg-[#f1c969] p-6">
              <p className="court-eyebrow">The order matters</p>
              <h2 className="mt-4 text-2xl font-black">
                Create → Accept → Fund
              </h2>
              <p className="mt-4 text-sm leading-7">
                Funding needs wallet approval. Check the amount and use test GEN
                only. Verify payout delivery in Activity.
              </p>
            </article>
            <article className="court-surface p-6">
              <h3 className="font-black">Good terms prevent disputes</h3>
              <ul className="court-checklist mt-5">
                <li>Specify measurable deliverables</li>
                <li>Use evidence both parties can access</li>
                <li>Allow enough time for consensus</li>
                <li>Explain partial-performance outcomes</li>
                <li>Keep confidential information off-chain</li>
              </ul>
            </article>
            <p className="p-4 text-xs leading-6 text-[#70817c]">
              The owner cannot edit your agreement, replace a party, decide your
              ruling, or withdraw your escrow.
            </p>
          </aside>
        </section>
      )}

      {tab === "owner" && (
        <section className={shell + " py-12"}>
          <p className="court-eyebrow">Owner console</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Run the service.
            <br />
            Stay out of the verdict.
          </h1>
          <p className="mt-5 break-all text-sm text-[#70817c]">
            {owner
              ? (isOwner
                  ? "Connected as contract owner · "
                  : "Read-only unless connected as owner · ") + owner
              : "Loading contract authority…"}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              title="Agreements"
              value={stats ? String(stats.agreements_created ?? 0) : "—"}
              note="Actual records on this contract"
            />
            <Stat
              title="Disputes opened"
              value={stats ? String(stats.disputes_opened ?? 0) : "—"}
              note="Not fabricated sample cases"
            />
            <Stat
              title="Fees accrued"
              value={
                stats
                  ? formatGen(String(stats.fees_accrued_wei ?? 0)) + " GEN"
                  : "—"
              }
              note="Adjudicated resolutions only"
            />
            <Stat
              title="Payouts emitted"
              value={stats ? String(stats.payouts_emitted ?? 0) : "—"}
              note="Delivery must be checked separately"
            />
          </div>
          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            <form
              className="court-surface p-7"
              onSubmit={(e) => {
                e.preventDefault();
                void transact("Schedule fee", "schedule_fee_bps", [
                  Number(new FormData(e.currentTarget).get("fee_bps")),
                ]);
              }}
            >
              <p className="court-eyebrow">Future adjudication fee</p>
              <h2 className="mt-3 text-2xl font-black">
                Current fee: {config ? Number(config.fee_bps) / 100 + "%" : "—"}
              </h2>
              <div className="mt-6">
                <Field
                  title="New fee (basis points)"
                  hint="100 bps = 1%. Maximum 1,000 / 10%."
                >
                  <input
                    name="fee_bps"
                    type="number"
                    min="0"
                    max="1000"
                    defaultValue="200"
                    required
                    disabled={!isOwner}
                  />
                </Field>
              </div>
              <button
                className="court-primary mt-5"
                disabled={disabled || !isOwner}
              >
                Schedule with 24h delay
              </button>
              <p className="mt-5 text-sm text-[#70817c]">
                {pendingFeeAt
                  ? "Scheduled: " +
                    Number(config?.pending_fee_bps) / 100 +
                    "% · can apply after " +
                    date(pendingFeeAt)
                  : "No fee change is scheduled."}
              </p>
              <button
                type="button"
                className="court-secondary mt-4"
                disabled={
                  disabled || !wallet || !pendingFeeAt || now < pendingFeeAt
                }
                onClick={() =>
                  void transact("Apply scheduled fee", "apply_scheduled_fee")
                }
              >
                Apply matured change
              </button>
              <p className="mt-3 text-xs text-[#70817c]">
                Anyone can apply a matured fee. Existing agreements retain their
                original fee.
              </p>
            </form>
            <article className="rounded-[28px] bg-[#163d3a] p-7 text-white">
              <p className="text-xs uppercase tracking-widest text-[#b4c9c3]">
                Bounded authority
              </p>
              <h2 className="mt-3 text-3xl font-black">
                An owner console,
                <br />
                not a judge’s override.
              </h2>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-[#bbcdc7]">
                <li>Cooperative settlement has no adjudication fee.</li>
                <li>
                  Fees apply only as specified in the immutable agreement.
                </li>
                <li>
                  Evidence reopens and fallback are bounded by contract rules.
                </li>
                <li>
                  Private support, index coverage and payout exceptions are
                  available in the operator workspace below.
                </li>
              </ul>
            </article>
          </div>
          <OwnerDesk protocol={protocol} onOpen={openAgreement} />
        </section>
      )}

      {tab === "mywork" && (
        <section className={shell + " py-12"}>
          <DirectoryPanel protocol={protocol} onOpen={openAgreement} onlyMine />
        </section>
      )}
      {tab === "activity" && (
        <section className={shell + " py-12"}>
          <ActivityPanel
            protocol={protocol}
            onOpen={openAgreement}
            onSupport={support}
          />
        </section>
      )}
      {tab === "help" && (
        <section className={shell + " py-12"}>
          <HelpPanel
            key={supportContext.hash + "|" + supportContext.id}
            protocol={protocol}
            context={supportContext}
          />
        </section>
      )}
      {draft && (
        <PublishReview
          draft={draft}
          busy={Boolean(busy)}
          error={notice?.kind === "error" ? notice.text : undefined}
          onClose={() => setDraft(null)}
          onConfirm={publishAgreement}
        />
      )}
      <footer className="border-t border-[#163d3a]/10">
        <div
          className={
            shell +
            " flex flex-wrap justify-between gap-3 py-8 text-xs text-[#70817c]"
          }
        >
          <p>Dispute Court · independent GenLayer product</p>
          <p>Studionet sandbox · not a legal court · evidence is public</p>
        </div>
      </footer>
    </main>
  );
}
