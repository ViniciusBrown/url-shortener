import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export function createClientIpResolver({
  trustProxy,
}: {
  trustProxy: boolean;
}) {
  return (c: Context): string | null => {
    if (trustProxy) {
      // A trusted proxy appends the address it saw, so only the rightmost entry can't be forged.
      const forwarded = c.req
        .header("x-forwarded-for")
        ?.split(",")
        .at(-1)
        ?.trim();
      if (forwarded) return forwarded;
    }
    try {
      return getConnInfo(c).remote.address ?? null;
    } catch {
      // app.request() has no socket, so in-process requests have no address.
      return null;
    }
  };
}
