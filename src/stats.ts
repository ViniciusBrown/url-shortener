import type { AppDeps, LinkStats } from "./types";

// Stub: the read-path stream owns this file. Returns null for an unknown code.
export function getStats(
  _deps: Pick<AppDeps, "db" | "now">,
  _code: string,
): LinkStats | null {
  throw new Error("getStats is not implemented");
}
