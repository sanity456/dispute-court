import { recordPath } from "./releases.ts";

export function recordLink(id: string, releaseId: string, origin: string) {
  const base = new URL(origin);
  if (
    base.origin !== origin ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(base.hostname)
      ))
  )
    throw new Error("Use the current HTTPS app origin or a loopback preview.");
  return new URL(recordPath(id, releaseId), base).href;
}
