// Python re \s, used by both deployed v2 contracts. JS \s has different Unicode membership.
export const PYTHON_WHITESPACE =
  /[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;
export function normalizeEvidence(text: string) {
  return text.replace(PYTHON_WHITESPACE, " ").replace(/^ +| +$/g, "");
}
export async function evidenceDigest(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalizeEvidence(text)),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function validateEvidenceUrl(value: string): string {
  const input = value.trim();
  if (
    !input.startsWith("https://") ||
    input.length > 2048 ||
    !/^[\x21-\x7e]+$/.test(input) ||
    input.includes("\\")
  )
    throw new Error(
      "Use a plain public HTTPS URL, without spaces or control characters.",
    );
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid public HTTPS URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  )
    throw new Error(
      "Use HTTPS without credentials, fragments or a custom port.",
    );
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
    /\.(local|localhost|internal|test|invalid|onion|nip\.io|sslip\.io|xip\.io)$/.test(
      host,
    )
  )
    throw new Error(
      "Use a public hostname, not a private address or IP alias.",
    );
  return input;
}
export type EvidenceCapture = {
  id: string;
  request_id: string;
  account: string;
  url: string;
  digest: string;
  text: string;
  captured_at: number;
  byte_length: number;
  product_contract: string;
};
