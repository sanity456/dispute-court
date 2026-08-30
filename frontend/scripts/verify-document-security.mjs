// GET-only document checks. No wallet interaction, credentials, or state changes.
import assert from "node:assert/strict";

const base = new URL(process.argv[2] ?? "");
assert.ok(
  base.protocol === "https:" ||
    (base.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(base.hostname)),
  "Use HTTPS or a local loopback preview",
);
assert.ok(
  !base.username &&
    !base.password &&
    base.pathname === "/" &&
    !base.search &&
    !base.hash,
  "Pass only the app origin, without credentials",
);
const seen = new Set();
for (const path of ["/", "/", "/auth/sign-in"]) {
  const response = await fetch(new URL(path, base), {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    headers: {
      "x-nonce": "attacker-controlled",
      "content-security-policy": "script-src *",
    },
  });
  assert.equal(
    response.status,
    200,
    path + ": document unavailable; check private-preview access separately",
  );
  const policy = response.headers.get("content-security-policy") ?? "";
  const scriptPolicy =
    policy.split(";").find((value) => value.trim().startsWith("script-src ")) ??
    "";
  const nonce = scriptPolicy.match(/'nonce-([A-Za-z0-9+/]{32})'/)?.[1];
  assert.ok(nonce, path + ": missing strong script nonce");
  assert.ok(!seen.has(nonce), path + ": cached/reused nonce");
  seen.add(nonce);
  assert.ok(scriptPolicy.includes("'strict-dynamic'"));
  assert.ok(
    !scriptPolicy.includes("unsafe-inline") &&
      !scriptPolicy.includes("unsafe-eval"),
    path + ": production script policy is relaxed",
  );
  assert.ok(
    policy.includes("frame-ancestors 'none'") &&
      policy.includes("object-src 'none'"),
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.ok(response.headers.get("permissions-policy")?.includes("camera=()"));
  assert.ok(response.headers.get("cache-control")?.includes("no-store"));
  const html = await response.text();
  const executable = [...html.matchAll(/<script\b([^>]*)>/gi)]
    .map((match) => match[1])
    .filter(
      (attributes) =>
        !/type=["'](?:application\/(?:ld\+json|json)|text\/plain)["']/i.test(
          attributes,
        ),
    );
  assert.ok(executable.length > 0, path + ": no executable app scripts");
  for (const attributes of executable)
    assert.ok(
      attributes.includes('nonce="' + nonce + '"'),
      path + ": an executable script lacks the response nonce",
    );
  if (path === "/auth/sign-in") {
    assert.ok(
      /Sign in with wallet/i.test(html),
      "Wallet sign-in was not rendered",
    );
    assert.ok(
      !/<input[^>]+type=["'](?:email|password)["']/i.test(html),
      "Credential form found",
    );
  }
  console.log(
    JSON.stringify({
      origin: base.origin,
      path,
      status: 200,
      nonceFresh: true,
      scriptCount: executable.length,
      noncesMatched: true,
      productionPolicy: true,
    }),
  );
}
