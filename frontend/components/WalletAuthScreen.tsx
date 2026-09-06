"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { product } from "../lib/product";
import { loginWithWallet, logoutWallet } from "../lib/wallet-auth-client";
import { userFacingError } from "../lib/recovery";

export default function WalletAuthScreen({
  signOut = false,
}: {
  signOut?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (signOut) await logoutWallet();
      else await loginWithWallet();
      // Local destination only. Old reset-link tokens and untrusted redirects are discarded.
      window.location.replace("/");
    } catch (failure) {
      setError(userFacingError(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="auth-shell">
      <section
        className="product-panel auth-card"
        aria-labelledby="wallet-title"
      >
        <Link className="auth-brand" href="/">
          {product.name}
        </Link>
        <p className="product-muted">Studionet · Test network</p>
        <h1 id="wallet-title">
          {signOut ? "Sign out?" : "Your wallet is your account."}
        </h1>
        <p className="product-muted">
          {signOut
            ? "Your history stays saved. Pending transactions continue; your wallet stays connected."
            : "Sign a message to continue. No gas fee or transfers."}
        </p>
        <form onSubmit={submit} className="product-stack">
          {error && (
            <p className="product-error" role="alert">
              {error}
            </p>
          )}
          {busy && (
            <p className="product-muted" role="status">
              {signOut
                ? "Ending your session…"
                : "Confirm or cancel in your wallet."}
            </p>
          )}
          <button className="product-button-primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : signOut
                ? "Sign out"
                : "Sign in with wallet"}
          </button>
        </form>
        <nav aria-label="Wallet account options" className="auth-links">
          <Link href="/">Back to {product.name}</Link>
        </nav>
        {!signOut && (
          <details className="product-muted">
            <summary>Wallet help</summary>
            <p>
              Open in a wallet-enabled browser on GenLayer Studionet.
              Smart-contract wallets are not supported.
            </p>
          </details>
        )}
      </section>
    </main>
  );
}
