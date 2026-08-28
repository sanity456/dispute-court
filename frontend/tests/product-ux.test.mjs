import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  normalizeEvidence,
  evidenceDigest,
  validateEvidenceUrl,
} from "../lib/evidence.ts";
import { calendarFile, nextStep } from "../lib/reminders.ts";
import { intentDescription, canonicalArgs } from "../lib/activity-model.ts";
import { walletRejected } from "../lib/recovery.ts";
import { product } from "../lib/product.ts";
test("evidence normalization matches Python whitespace, including NEL and record separator", async () => {
  const raw = " \nFirst\u0085second\u001cthird\u2003fourth  ";
  assert.equal(normalizeEvidence(raw), "First second third fourth");
  assert.equal(
    normalizeEvidence("\ufeffKeep BOM\ufeff"),
    "\ufeffKeep BOM\ufeff",
  );
  assert.equal(
    await evidenceDigest(raw),
    createHash("sha256").update("First second third fourth").digest("hex"),
  );
});
test("capture URL validation rejects private, credentialed and ambiguous addresses", () => {
  assert.equal(
    validateEvidenceUrl("https://example.com/evidence?q=1"),
    "https://example.com/evidence?q=1",
  );
  for (const url of [
    "http://example.com",
    "HTTPS://example.com",
    "https://localhost",
    "https://127.1",
    "https://2130706433",
    "https://[::1]/",
    "https://user:secret@example.com",
    "https://example.com:80",
    "https://host.internal",
    "https://127.0.0.1.nip.io",
    "https://example.com/#token",
    "https://example.com\\@localhost",
    "https://example.com/\nheader",
    "https://example..com/",
  ]) {
    assert.throws(() => validateEvidenceUrl(url), url);
  }
});
test("calendar reminders use UTC, safe line folding and explicit snapshot semantics", () => {
  const guide = {
    title: "Act",
    detail: "Line one\nLine two",
    deadline: 2000000000,
    deadlineLabel: "Deadline",
  };
  const ics = calendarFile(
    "record",
    "A".repeat(100) + "\nBEGIN:VEVENT",
    guide,
    60,
    1000,
  );
  assert.match(ics, /DTSTART:20330518T033320Z/);
  assert.match(ics, /TRIGGER:-PT60M/);
  assert.equal(ics.match(/\r\nBEGIN:VEVENT\r\n/g).length, 1);
  assert.match(ics, /\\nBEGIN:VEVENT/);
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  assert.throws(
    () => calendarFile("id", "x", { ...guide, deadline: 1 }, 60, 2000),
    /no future deadline/,
  );
  assert.throws(() => calendarFile("id", "x", guide, 3, 1000), /Unsupported/);
});
test("deadline guidance explains role and expiration without authorizing a transaction", () => {
  const r =
    product.id === "commitment-pools"
      ? { status: "forming", join_deadline: 100 }
      : {
          status: "awaiting_response",
          response_deadline: 100,
          dispute_responder: "0xabc",
        };
  assert.match(nextStep(r, "0xabc", 101).title, /ended|passed/);
  assert.equal(nextStep(r, "0xabc", 99).deadline, 100);
});
test("activity separates delivered transfer from successful parent execution", () => {
  const row = { status: "success", transaction: { payout_state: "pending" } };
  assert.match(intentDescription(row), /transfer pending/);
  assert.equal(
    intentDescription({ ...row, transaction: { payout_state: "delivered" } }),
    "Payout delivered",
  );
  assert.match(intentDescription({ status: "review" }), /wallet history/);
});
test("only explicit EIP-1193 rejection is safe to classify as unsigned cancellation", () => {
  assert.equal(walletRejected({ code: 4001 }), true);
  assert.equal(walletRejected({ cause: { cause: { code: 4001 } } }), true);
  assert.equal(walletRejected(new Error("Timeout")), false);
  assert.equal(walletRejected({ code: -32000 }), false);
  assert.deepEqual(canonicalArgs([1, 1000000000000000001n]), [
    "1",
    "1000000000000000001",
  ]);
});
