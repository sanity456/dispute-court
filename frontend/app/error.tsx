"use client";
import Link from "next/link";
export default function ErrorBoundary({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="min-h-screen p-8">
      <div className="product-panel mx-auto max-w-xl product-stack">
        <h1 className="product-title">This view could not load.</h1>
        <p className="product-muted">
          Your on-chain record is unchanged. If you were signing a transaction,
          inspect saved Activity and wallet history before sending it again.
        </p>
        <button className="product-button" onClick={reset}>
          Retry this view
        </button>
        <Link className="product-text-button" href="/">
          Return to the product
        </Link>
      </div>
    </main>
  );
}
