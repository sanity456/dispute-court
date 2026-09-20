import { currentRelease, releaseById, type Release } from "./releases.ts";

let selected: Release | null = null;
// A document owns one immutable release. Switching requires a full navigation,
// which clears consent, in-flight component state and old wallet callbacks.
export function initializeClientRelease(id: string) {
  const next = releaseById(id);
  if (selected && selected.id !== next.id)
    throw new Error("Reload the page to change releases.");
  selected = next;
  return next;
}
export function clientRelease() {
  return selected ?? currentRelease;
}
