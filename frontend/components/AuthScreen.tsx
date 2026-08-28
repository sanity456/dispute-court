"use client";
import { useState } from "react";
import Link from "next/link";
import { product } from "../lib/product";
import { usesNeonAuth } from "../lib/auth-mode";

export type AuthView =
  "sign-in" | "sign-up" | "forgot-password" | "reset-password" | "sign-out";
const titles: Record<AuthView, string> = {
  "sign-in": "Welcome back.",
  "sign-up": "Create your account.",
  "forgot-password": "Reset your password.",
  "reset-password": "Choose a new password.",
  "sign-out": "Sign out of this product?",
};
export default function AuthScreen({ view }: { view: AuthView }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const signup = view === "sign-up";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    try {
      const { authClient } = await import("../lib/auth-client");
      if (view === "forgot-password") {
        const response = await authClient.requestPasswordReset({
          email,
          redirectTo: new URL("/auth/reset-password", window.location.origin)
            .href,
        });
        if (response.error)
          throw new Error(
            "The reset request could not be completed. Please try again.",
          );
        setNotice(
          "If that email has an account, a reset link is on its way. Check your inbox and spam folder.",
        );
        return;
      }
      if (view === "reset-password") {
        const token = new URL(window.location.href).searchParams.get("token");
        if (!token)
          throw new Error(
            "Open the reset link from your email, or request a new one.",
          );
        const response = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (response.error)
          throw new Error(
            response.error.message || "This reset link is invalid or expired.",
          );
        window.location.replace("/auth/sign-in");
        return;
      }
      if (view === "sign-out") {
        const response = await authClient.signOut();
        if (response.error)
          throw new Error("Could not sign out. Please try again.");
        window.location.assign("/");
        return;
      }
      const response = signup
        ? await authClient.signUp.email({
            email,
            password,
            name: String(data.get("name") ?? "").trim(),
            callbackURL: window.location.origin + "/",
          })
        : await authClient.signIn.email({
            email,
            password,
            callbackURL: window.location.origin + "/",
          });
      if (response.error)
        throw new Error(
          response.error.message || "Sign-in could not be completed.",
        );
      const session = await authClient.getSession();
      if (session.data?.user) window.location.assign("/");
      else
        setNotice(
          "Check your email to verify your account, then sign in. Your wallet is connected separately.",
        );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Account access is unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="auth-shell">
      <section
        className="product-panel auth-card"
        aria-labelledby="account-title"
      >
        <Link className="auth-brand" href="/">
          {product.name}
        </Link>
        <p className="product-muted">GenLayer Studionet · Test network only</p>
        <h1 id="account-title">{titles[view]}</h1>
        <p className="product-muted">
          {view === "sign-out"
            ? "Your saved history stays in your account. Signing out does not cancel pending transactions or disconnect your wallet."
            : "Your account saves history, reminders and support. Your wallet stays separate and approves every on-chain action."}
        </p>
        {!usesNeonAuth ? (
          <a
            className="product-button-primary"
            href="/signin-with-chatgpt?return_to=/"
          >
            Continue with ChatGPT
          </a>
        ) : (
          <form onSubmit={submit} className="product-stack">
            {signup && (
              <label className="product-field">
                <span>Name</span>
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={80}
                  required
                  disabled={busy}
                />
              </label>
            )}
            {view !== "sign-out" && view !== "reset-password" && (
              <label className="product-field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={254}
                  required
                  disabled={busy}
                />
              </label>
            )}
            {view !== "sign-out" && view !== "forgot-password" && (
              <label className="product-field">
                <span>
                  {signup || view === "reset-password"
                    ? "Password (12 or more characters)"
                    : "Password"}
                </span>
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    signup || view === "reset-password"
                      ? "new-password"
                      : "current-password"
                  }
                  minLength={signup || view === "reset-password" ? 12 : 1}
                  maxLength={128}
                  required
                  disabled={busy}
                />
              </label>
            )}
            {error && (
              <p className="product-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="product-muted" role="status">
                {notice}
              </p>
            )}
            <button className="product-button-primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : signup
                  ? "Create account"
                  : view === "forgot-password"
                    ? "Send reset link"
                    : view === "reset-password"
                      ? "Save new password"
                      : view === "sign-out"
                        ? "Sign out"
                        : "Sign in"}
            </button>
          </form>
        )}
        {usesNeonAuth && (
          <nav aria-label="Account options" className="auth-links">
            {view !== "sign-in" && <Link href="/auth/sign-in">Sign in</Link>}
            {view === "sign-in" && (
              <>
                <Link href="/auth/sign-up">Create an account</Link>
                <Link href="/auth/forgot-password">Forgot password?</Link>
              </>
            )}
            {view === "reset-password" && (
              <Link href="/auth/forgot-password">Request a new reset link</Link>
            )}
            <Link href="/">Back to {product.name}</Link>
          </nav>
        )}
      </section>
    </main>
  );
}
