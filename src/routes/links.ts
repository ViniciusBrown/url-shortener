import type { Hono } from "hono";
import { createLink } from "../links";
import type { AppDeps, LinkRow } from "../types";
import { referrerHost } from "../validation";

export function registerLinkRoutes(app: Hono, deps: AppDeps): void {
  // The foundation's JSON notFound handler also handles invalid code paths.
  app.use("*", async (c, next) => {
    await next();
    if (c.res.status === 404) c.header("Cache-Control", "no-store");
  });

  app.post("/api/shorten", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }
    const result = createLink(deps, body);
    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json(result, 201);
  });

  app.get("/:code{[0-9a-zA-Z]{7}}", (c) => {
    c.header("Cache-Control", "no-store");
    const link = deps.db
      .prepare("SELECT * FROM links WHERE code = ?")
      .get(c.req.param("code")) as LinkRow | undefined;
    if (!link) return c.json({ error: "Not found" }, 404);

    const now = deps.now();
    if (
      link.expires_at !== null &&
      now.getTime() >= new Date(link.expires_at).getTime()
    ) {
      return c.json({ error: "Link expired" }, 410);
    }

    // Hono dispatches HEAD through GET handlers, preserving the original method.
    if (c.req.method === "GET") {
      const referrer = c.req.header("Referer") ?? null;
      try {
        deps.db
          .prepare(
            `INSERT INTO clicks (link_id, clicked_at, referrer, referrer_host, user_agent, ip)
           VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            link.id,
            now.toISOString(),
            referrer,
            referrerHost(referrer),
            c.req.header("User-Agent") ?? null,
            deps.getClientIp(c),
          );
      } catch (error) {
        console.error("Failed to record click", error);
      }
    }

    return c.redirect(new URL(link.original_url).href, 301);
  });
}
