import { jsonString } from "./activity-model.ts";
export class ProductApiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;
  constructor(
    message: string,
    code: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
export async function productApi<T = Record<string, unknown>>(
  path: string,
  input?: unknown,
): Promise<T> {
  const response = await fetch("/api/product/" + path, {
    method: input === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    ...(input === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: jsonString(input),
        }),
    signal: AbortSignal.timeout(45000),
  });
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new ProductApiError(
      "The service returned an unreadable response. Check Activity before repeating a wallet action.",
      "invalid_response",
      response.status,
    );
  }
  if (!response.ok || data.error)
    throw new ProductApiError(
      String(data.error ?? "Request failed."),
      String(data.code ?? "request_failed"),
      response.status,
      data,
    );
  return data as T;
}
