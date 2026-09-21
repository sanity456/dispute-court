import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recordLink } from "../lib/record-link.ts";
import { calendarFile } from "../lib/reminders.ts";

test("invitations keep the preview origin and exact registered release", () => {
  const origin = "https://candidate.example";
  assert.equal(
    recordLink("same case", "v5", origin),
    origin + "/agreements/same%20case?release=v5",
  );
  assert.equal(
    recordLink("same case", "v4", origin),
    origin + "/agreements/same%20case?release=v4",
  );
  assert.equal(
    recordLink("id", "v5", "http://127.0.0.1:4211"),
    "http://127.0.0.1:4211/agreements/id?release=v5",
  );
  for (const invalid of [
    "javascript:alert(1)",
    "http://remote.example",
    origin + "/path",
    origin + "?x=1",
    "https://user:secret@candidate.example",
  ])
    assert.throws(() => recordLink("id", "v5", invalid));
  assert.throws(() => recordLink("id", "v6", origin));
});

test("calendar links and identities distinguish same-ID cases across retained versions", () => {
  const guide = {
    deadline: 2000,
    deadlineLabel: "Response",
    detail: "Test reminder",
  };
  const origin = "https://candidate.example";
  const values = ["v4", "v5"].map((releaseId) =>
    calendarFile("same-case", "Case", guide, 60, 1000, { origin, releaseId }),
  );
  for (let i = 0; i < values.length; i++) {
    assert.ok(
      values[i].includes(
        "URL:" + origin + "/agreements/same-case?release=v" + (i + 4),
      ),
    );
    assert.ok(
      values[i].includes(
        "UID:same-case-v" + (i + 4) + "-2000@candidate.example",
      ),
    );
    assert.ok(
      !values[i].includes("https://dispute-court-studionet.vercel.app"),
    );
  }
  assert.notEqual(values[0], values[1]);
});

test("UI copy, export and calendar actions bind links to this document's origin and release", () => {
  const source = readFileSync(
    new URL("../components/RecordTools.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /recordLink\(id, clientRelease\(\)\.id, window\.location\.origin\)/,
  );
  assert.match(source, /clipboard\.writeText\(shareUrl\(\)\)/);
  assert.match(source, /url: shareUrl\(\)/);
  assert.match(source, /origin: window\.location\.origin/);
  assert.doesNotMatch(source, /product\.origin\s*\+/);
});
