import { product } from "./product.ts";
export type Guide = {
  title: string;
  detail: string;
  deadline: number;
  deadlineLabel: string;
};
function number(value: unknown) {
  return Number(value ?? 0);
}
export function nextStep(
  r: Record<string, unknown>,
  wallet: string,
  now: number,
  participant?: Record<string, unknown> | null,
): Guide {
  const status = String(r.status ?? ""),
    same = (a: unknown) =>
      Boolean(wallet) && String(a ?? "").toLowerCase() === wallet.toLowerCase();
  if (product.id === "commitment-pools") {
    if (status === "forming")
      return number(r.join_deadline) <= now
        ? {
            title: "Formation has ended",
            detail:
              "A connected wallet can activate this pool. If its cohort or activation window is insufficient, participants receive refund credit instead.",
            deadline: 0,
            deadlineLabel: "",
          }
        : {
            title: participant
              ? "You are in. Watch the start time."
              : "Review the commitment before joining",
            detail:
              "Check the exact stake, proof policy and schedule. Published terms cannot be edited. Activation must happen promptly after formation ends.",
            deadline: number(r.join_deadline),
            deadlineLabel: "Formation ends / rounds start",
          };
    if (status === "active") {
      if (participant?.status === "success")
        return {
          title: "Your rounds are complete",
          detail:
            "Settlement is available once everyone is terminal or the activity ends. Allocation and wallet withdrawal are separate steps.",
          deadline: number(r.activity_ends_at),
          deadlineLabel: "Activity ends",
        };
      if (participant?.status === "active") {
        const round = number(participant.rounds_passed) + 1,
          opens =
            number(r.activity_starts_at) +
            (round - 1) * number(r.round_window_seconds),
          closes = opens + number(r.round_window_seconds);
        return {
          title:
            now < opens
              ? "Your next round opens soon"
              : now < closes
                ? "Your proof window is open"
                : "This round's deadline has passed",
          detail:
            now < closes
              ? "Submit a measurable proof early enough for consensus. Up to three attempts are available only for unclear results."
              : "A missed round must be recorded or included in settlement. Do not submit a late proof expecting it to count.",
          deadline: now < opens ? opens : closes,
          deadlineLabel:
            now < opens ? "Round opens" : "Proof must finalize before",
        };
      }
      return {
        title: "Follow the cohort's progress",
        detail:
          "Only active participants can submit proof. View the rules and recorded attempts below.",
        deadline: number(r.activity_ends_at),
        deadlineLabel: "Activity ends",
      };
    }
    if (status === "refunding")
      return {
        title:
          participant && !participant.refund_claimed
            ? "Claim your formation refund"
            : "Formation refunds are available",
        detail:
          "Each participant claims full refund credit, then withdraws it. Activity verifies the separate native payout.",
        deadline: 0,
        deadlineLabel: "",
      };
    return {
      title:
        status === "settled"
          ? "Review your allocation, then withdraw"
          : "This pool is closed",
      detail:
        "The public terms and history remain available. A finalized withdrawal still needs its native child transfer checked.",
      deadline: 0,
      deadlineLabel: "",
    };
  }
  const isA = same(r.party_a),
    isB = same(r.party_b),
    party = isA || isB;
  const resolutionDeadline =
    number(r.protocol_version) >= 3 ? number(r.resolution_deadline) : 0;
  if (
    resolutionDeadline > 0 &&
    now >= resolutionDeadline &&
    ["evidence", "ready_for_resolution", "resolution_stalled"].includes(status)
  )
    return {
      title: party
        ? "Apply the fee-free timeout split"
        : "Resolution deadline passed",
      detail: "Either party can split the full escrow equally without a fee.",
      deadline: resolutionDeadline,
      deadlineLabel: "Resolution timeout",
    };
  const guides: Record<string, Guide> = {
    awaiting_acceptance: {
      title: isB
        ? "Your invitation is ready to review"
        : "Waiting for Party B to accept",
      detail:
        "Only the named counterparty can accept. No escrow moves at this step.",
      deadline: number(r.acceptance_deadline),
      deadlineLabel: "Acceptance deadline",
    },
    awaiting_funding: {
      title: isA
        ? "Fund the exact agreed amount"
        : "Waiting for Party A to fund",
      detail:
        "Acceptance is recorded. Party A must fund before the deadline; no automatic debit occurs.",
      deadline: number(r.funding_deadline),
      deadlineLabel: "Funding deadline",
    },
    funded: {
      title: party
        ? "Perform the agreement or settle cooperatively"
        : "Agreement funded",
      detail:
        "Party A can release to B; Party B can refund A. Either party can open a dispute. The performance date does not automatically release funds.",
      deadline: number(r.performance_due_at),
      deadlineLabel: "Performance target",
    },
    awaiting_response: {
      title: same(r.dispute_responder)
        ? "Your response is required"
        : "Waiting for the named response",
      detail:
        "Missing this deadline allows the opener to receive the entire net escrow under the accepted no-show rule.",
      deadline: number(r.response_deadline),
      deadlineLabel: "Response must finalize before",
    },
    evidence: {
      title: party
        ? "Submit your complete public evidence"
        : "Evidence stage is open",
      detail:
        "Capture and review sources, then mark ready. Both ready flags close evidence early; otherwise anyone can close the expired window.",
      deadline: number(r.evidence_deadline),
      deadlineLabel: "Evidence deadline",
    },
    ready_for_resolution: {
      title: "Request validator resolution",
      detail:
        "A connected wallet can request resolution. A capture supports source integrity, not the correctness of the ruling.",
      deadline: resolutionDeadline,
      deadlineLabel: resolutionDeadline ? "Resolution timeout" : "",
    },
    resolution_stalled: {
      title: "Review the accepted fallback",
      detail:
        "The bounded evidence retries are exhausted. Either party may apply the agreed 50/50 split of net escrow.",
      deadline: resolutionDeadline,
      deadlineLabel: resolutionDeadline ? "Fee-free resolution timeout" : "",
    },
    resolved: {
      title: "Review the result and withdraw your credit",
      detail:
        "Amounts in the ruling are allocations. Use Activity to verify that any withdrawal's separate native transfer was delivered.",
      deadline: 0,
      deadlineLabel: "",
    },
    cancelled: {
      title: "This agreement is closed",
      detail:
        "No further funding or evidence actions are available. Keep the immutable record for reference.",
      deadline: 0,
      deadlineLabel: "",
    },
  };
  const guide = guides[status] ?? {
    title: "Review the current record",
    detail: "Refresh the finalized contract state before acting.",
    deadline: 0,
    deadlineLabel: "",
  };
  if (
    guide.deadline &&
    guide.deadline <= now &&
    [
      "awaiting_acceptance",
      "awaiting_funding",
      "awaiting_response",
      "evidence",
    ].includes(status)
  )
    return {
      ...guide,
      title: "The current deadline has passed",
      detail:
        "Refresh the record and use the available close, cancellation or no-show action. Do not send a late acceptance, payment, response or exhibit.",
    };
  return guide;
}
export function formatDeadline(seconds: number, timezone: string) {
  if (!seconds) return "";
  return (
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(seconds * 1000)) +
    " · " +
    timezone
  );
}
function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
function stamp(ms: number) {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
function fold(line: string) {
  const encoder = new TextEncoder();
  let bytes = 0,
    out = "";
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 73) {
      out += "\r\n ";
      bytes = 1;
    }
    out += char;
    bytes += size;
  }
  return out;
}
export function calendarFile(
  id: string,
  title: string,
  guide: Guide,
  minutes = 60,
  now = Date.now(),
) {
  if (
    !guide.deadline ||
    !Number.isFinite(guide.deadline) ||
    guide.deadline * 1000 <= now
  )
    throw new Error("There is no future deadline to add.");
  if (![15, 60, 1440].includes(minutes))
    throw new Error("Unsupported reminder interval.");
  const url =
    product.origin + "/" + product.recordPath + "/" + encodeURIComponent(id);
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//" + product.name + "//Studionet//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" +
        encodeURIComponent(id) +
        "-" +
        guide.deadline +
        "@" +
        new URL(product.origin).hostname,
      "DTSTAMP:" + stamp(now),
      "DTSTART:" + stamp(guide.deadline * 1000),
      "DTEND:" + stamp((guide.deadline + 900) * 1000),
      "SUMMARY:" + escapeIcs(title + " — " + guide.deadlineLabel),
      "DESCRIPTION:" +
        escapeIcs(
          guide.detail +
            " Submit early: consensus takes time. This reminder is a snapshot; recheck the app after state changes.",
        ),
      "URL:" + url,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT" + minutes + "M",
      "DESCRIPTION:" + escapeIcs(guide.deadlineLabel),
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
