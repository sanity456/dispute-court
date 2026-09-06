import type { Agreement } from "./lifecycle.ts";

export function workspaceIdentity(
  session: {
    wallet: string;
    coreAddress: string;
    captureAddress: string;
    chainId: number;
  } | null,
) {
  return session
    ? [
        session.chainId,
        session.coreAddress,
        session.captureAddress,
        session.wallet,
      ]
        .join("|")
        .toLowerCase()
    : "signed-out";
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}

// A refresh counter is not part of consent. Every recorded agreement field is.
export function agreementReviewKey(agreement: Agreement | undefined) {
  return agreement ? JSON.stringify(canonical(agreement)) : "";
}

export function detailIsFresh(
  detail: { key: string; revision: number } | null,
  agreementId: string,
  revision: number,
  error: string,
) {
  return Boolean(
    detail &&
    detail.key === agreementId &&
    detail.revision === revision &&
    !error,
  );
}
