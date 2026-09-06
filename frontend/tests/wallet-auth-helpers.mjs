import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { handleWalletAuth, authenticateWallet } from "../server/wallet-auth.ts";
import { handleProductRequest } from "../server/api.ts";
import { product } from "../lib/product.ts";
export const alice = privateKeyToAccount("0x" + "31".repeat(32));
export const bob = privateKeyToAccount("0x" + "42".repeat(32));
export const net = {
  coreAddress: "0x" + "11".repeat(20),
  captureAddress: "0x" + "22".repeat(20),
  ownerAddress: alice.address.toLowerCase(),
  read: async () => ({ protocol_version: 4, max_source_bytes: 6000 }),
  methods: () => ({
    join: { readonly: false, params: ["id"] },
    fund_agreement: { readonly: false, params: ["id"] },
  }),
};
export class AuthBrowser {
  constructor(
    db,
    origin = "https://wallet.example",
    app = product,
    clientAddress = "203.0.113.10",
  ) {
    this.db = db;
    this.origin = origin;
    this.app = app;
    this.clientAddress = clientAddress;
    this.cookies = new Map();
  }
  cookie() {
    return [...this.cookies]
      .map(([name, value]) => name + "=" + value)
      .join("; ");
  }
  accept(response) {
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(";")[0],
        at = pair.indexOf("=");
      if (pair.slice(at + 1))
        this.cookies.set(pair.slice(0, at), pair.slice(at + 1));
      else this.cookies.delete(pair.slice(0, at));
    }
  }
  request(path, input, extra = {}) {
    return new Request(this.origin + "/api/" + path, {
      method: input === undefined ? "GET" : "POST",
      headers: {
        cookie: this.cookie(),
        ...(input === undefined
          ? {}
          : { origin: this.origin, "content-type": "application/json" }),
        ...extra,
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
  }
  async auth(path, input, extra) {
    const response = await handleWalletAuth(
      this.request("auth/" + path, input, extra),
      this.db,
      this.app,
      this.clientAddress,
    );
    this.accept(response);
    return response;
  }
  async challenge(account = alice) {
    const response = await this.auth("challenge", {
      wallet: account.address,
      chainId: 61999,
    });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  async login(account = alice) {
    const challenge = await this.challenge(account);
    const signature = await account.signMessage({ message: challenge.message });
    const response = await this.auth("verify", { id: challenge.id, signature });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  async api(path, input, extra) {
    return handleProductRequest(
      this.request("product/" + path, input, extra),
      this.db,
      net,
      (request) => authenticateWallet(this.db, request, this.app),
    );
  }
}
