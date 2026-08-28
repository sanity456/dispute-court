import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { hexToString } from "viem";
import {
  signWalletLogin,
  validateLoginChallenge,
} from "../lib/wallet-login.ts";
import {
  walletLoginMessage,
  CHALLENGE_TTL_MS,
  SESSION_TTL_MS,
} from "../lib/wallet-auth-policy.ts";
import { productApi, setExpectedWallet } from "../lib/client.ts";
import { rememberHash, recoverOutbox } from "../lib/recovery.ts";
import { product } from "../lib/product.ts";
import { alice, bob } from "./wallet-auth-helpers.mjs";
function flow() {
  const wallet = alice.address.toLowerCase(),
    origin = "https://wallet.example",
    now = Date.now();
  const challenge = {
    id: "ad".repeat(32),
    wallet,
    chainId: 61999,
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
  };
  challenge.message = walletLoginMessage({
    wallet,
    origin,
    nonce: challenge.id,
    issuedAt: now,
    expiresAt: challenge.expiresAt,
  });
  const state = {
    account: wallet,
    chain: "0xf22f",
    methods: [],
    verifies: 0,
    signed: "",
    onSign: null,
    onVerify: null,
  };
  const provider = {
    request: async ({ method, params }) => {
      state.methods.push(method);
      if (method === "eth_accounts") return [state.account];
      if (method === "eth_chainId") return state.chain;
      if (method === "personal_sign") {
        assert.equal(params[1], wallet);
        state.signed = hexToString(params[0]);
        if (state.onSign) await state.onSign();
        return alice.signMessage({ message: state.signed });
      }
      throw new Error("Unexpected wallet method: " + method);
    },
  };
  const api = async (path, input) => {
    if (path === "challenge") {
      assert.equal(input.chainId, 61999);
      return challenge;
    }
    assert.equal(path, "verify");
    assert.equal(input.id, challenge.id);
    state.verifies++;
    if (state.onVerify) state.onVerify();
    return {
      authenticated: true,
      wallet,
      chainId: 61999,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
  };
  return { wallet, origin, challenge, state, provider, api };
}
test("Wallet sign-in requests only account/chain reads and one personal signature, never a transaction", async () => {
  const f = flow();
  const session = await signWalletLogin(f.provider, f.wallet, f.origin, f.api);
  assert.equal(session.wallet, f.wallet);
  assert.equal(f.state.signed, f.challenge.message);
  assert.equal(f.state.methods.filter((m) => m === "personal_sign").length, 1);
  assert.ok(
    f.state.methods.every((m) =>
      ["personal_sign", "eth_accounts", "eth_chainId"].includes(m),
    ),
  );
  assert.equal(f.state.verifies, 1);
});
test("Client rejects altered domain, chain, address, nonce, time, permissions and product before signing", async () => {
  const modifiers = [
    (v) => {
      v.message = v.message.replace("wallet.example", "evil.example");
    },
    (v) => {
      v.chainId = 1;
    },
    (v) => {
      v.wallet = bob.address.toLowerCase();
    },
    (v) => {
      v.id = "bc".repeat(32);
    },
    (v) => {
      v.issuedAt = Date.now() + 60000;
    },
    (v) => {
      v.expiresAt = Date.now() - 1;
    },
    (v) => {
      v.message += "\nResources:\n- https://evil.example/approve";
    },
    (v) => {
      v.message = v.message.replace(
        "Request ID: " + product.id,
        "Request ID: different-product",
      );
    },
  ];
  for (const mutate of modifiers) {
    const f = flow();
    mutate(f.challenge);
    await assert.rejects(
      signWalletLogin(f.provider, f.wallet, f.origin, f.api),
      /could not be verified/,
    );
    assert.equal(f.state.methods.includes("personal_sign"), false);
    assert.equal(f.state.verifies, 0);
  }
  const f = flow();
  assert.throws(
    () =>
      validateLoginChallenge(f.challenge, f.wallet, "https://other.example"),
    /could not be verified/,
  );
});
test("Rejected signatures and wallet/network switches stop verification", async () => {
  for (const changed of [
    (f) => {
      f.state.onSign = () => {
        throw Object.assign(new Error("User rejected sign-in"), { code: 4001 });
      };
    },
    (f) => {
      f.state.onSign = () => {
        f.state.account = bob.address;
      };
    },
    (f) => {
      f.state.onSign = () => {
        f.state.chain = "0x1";
      };
    },
    (f) => {
      f.state.account = bob.address;
    },
  ]) {
    const f = flow();
    changed(f);
    await assert.rejects(
      signWalletLogin(f.provider, f.wallet, f.origin, f.api),
    );
    assert.equal(f.state.verifies, 0);
  }
});
test("A wallet change during server verification cannot report a successful client login", async () => {
  const f = flow();
  f.state.onVerify = () => {
    f.state.account = bob.address;
  };
  await assert.rejects(
    signWalletLogin(f.provider, f.wallet, f.origin, f.api),
    /active wallet changed/,
  );
  assert.equal(f.state.verifies, 1);
});
test("Late private API responses are discarded after a wallet switch and carry the expected wallet", async (t) => {
  let release, requestHeaders;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    requestHeaders = init.headers;
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  setExpectedWallet(alice.address);
  const request = productApi("preferences");
  assert.equal(requestHeaders["X-Product-Wallet"], alice.address.toLowerCase());
  setExpectedWallet(bob.address);
  release(Response.json({ timezone: "Europe/London" }));
  await assert.rejects(request, (e) => e.code === "wallet_session_changed");
  setExpectedWallet("");
});
test("Recovery outboxes are separated by wallet and never auto-import legacy account entries", async (t) => {
  const values = new Map(),
    previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
    },
  });
  t.after(() =>
    previous
      ? Object.defineProperty(globalThis, "localStorage", previous)
      : delete globalThis.localStorage,
  );
  const hash = "0x" + "ba".repeat(32),
    calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    return Response.json({ ok: true });
  });
  values.set(
    product.id + ":emergency-hash-outbox:v1",
    JSON.stringify([{ intentId: "legacy-private", hash }]),
  );
  rememberHash("alice-private", hash, alice.address);
  assert.deepEqual(await recoverOutbox(bob.address), {
    recovered: 0,
    pending: 0,
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(await recoverOutbox(alice.address), {
    recovered: 1,
    pending: 0,
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /alice-private$/);
  assert.ok(
    values
      .get(product.id + ":emergency-hash-outbox:v1")
      .includes("legacy-private"),
  );
});
test("Both hosting targets use wallet auth and shipped UI has no credential forms or provider fallback", () => {
  const read = (file) =>
    readFileSync(new URL("../" + file, import.meta.url), "utf8");
  for (const file of ["next.config.ts", "vite.config.ts"]) {
    assert.match(read(file), /auth\.wallet\.ts/);
    assert.doesNotMatch(read(file), /auth\.(neon|sites)\.ts/);
  }
  const ui = read("components/WalletAuthScreen.tsx");
  assert.doesNotMatch(
    ui,
    /type="(?:email|password)"|name="(?:email|password)"|signIn\.email|signUp\.email/,
  );
  assert.match(ui, /Sign in with wallet/);
  assert.match(
    read("components/ProductHome.tsx"),
    /key=\{protocol\.session\?\.wallet \?\? "signed-out"\}/,
  );
  assert.match(read("lib/wallet-auth-client.ts"), /await logoutWallet\(\)/);
  assert.match(read("lib/useProtocol.ts"), /subscribeToWalletSession/);
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["@neondatabase/auth"], undefined);
  for (const old of [
    "components/AuthScreen.tsx",
    "lib/auth-client.ts",
    "server/auth.neon.ts",
    "server/auth.sites.ts",
  ])
    assert.equal(existsSync(new URL("../" + old, import.meta.url)), false);
});
