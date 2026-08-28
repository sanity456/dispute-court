import type { Database } from "./database-types";
export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  constructor(
    status: number,
    message: string,
    code = "request_error",
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export function siteUser(request: Request) {
  const id = request.headers.get("oai-authenticated-user-id")?.trim();
  if (!id || id.length > 200)
    throw new ApiError(
      401,
      "Sign in with ChatGPT to use saved history and support.",
      "sign_in_required",
    );
  return id;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new ApiError(
      403,
      "This action must come from this product.",
      "origin_mismatch",
    );
}
export async function bodyJson(
  request: Request,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(415, "Send a JSON request.");
  if (Number(request.headers.get("content-length") ?? 0) > 32768)
    throw new ApiError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Request is empty.");
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.byteLength;
    if (length > 32768) {
      await reader.cancel();
      throw new ApiError(413, "Request is too large.");
    }
    parts.push(item.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new ApiError(400, "Request must contain a JSON object.");
  }
}
export function address(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(value) ||
    /^0x0{40}$/i.test(value)
  )
    throw new ApiError(400, "Use a valid non-zero wallet address.");
  return value.toLowerCase();
}
export function txHash(value: unknown) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value))
    throw new ApiError(400, "Use a valid 32-byte transaction hash.");
  return value.toLowerCase();
}
export function textField(
  value: unknown,
  name: string,
  max: number,
  optional = false,
) {
  const text = typeof value === "string" ? value.trim() : "";
  if (
    (!optional && !text) ||
    text.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)
  )
    throw new ApiError(
      400,
      name +
        " must be " +
        (optional ? "at most " : "1–") +
        max +
        " characters.",
    );
  return text;
}
export function integer(value: unknown, fallback: number, max: number) {
  const number =
    value === null || value === undefined || value === ""
      ? fallback
      : Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > max)
    throw new ApiError(400, "Invalid page or limit.");
  return number;
}
export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function rateLimit(
  db: Database,
  key: string,
  limit: number,
  windowMs = 60000,
  now = Date.now(),
) {
  const bucket = key + ":" + Math.floor(now / windowMs);
  const row = await db
    .prepare(
      "INSERT INTO rate_buckets (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count",
    )
    .bind(bucket, now + windowMs * 2, limit)
    .first();
  if (!row)
    throw new ApiError(
      429,
      "Too many requests. Wait a little before trying again.",
      "rate_limited",
    );
}
export function jsonResponse(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        ...headers,
      },
    },
  );
}
export function parseLosslessJson(text: string): unknown {
  return JSON.parse(text, (_key, value, context?: { source?: string }) => {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      !Number.isSafeInteger(value)
    ) {
      if (!context?.source || !/^-?\d+$/.test(context.source))
        throw new Error(
          "RPC returned a numeric value that cannot be represented exactly.",
        );
      return BigInt(context.source);
    }
    return value;
  });
}
