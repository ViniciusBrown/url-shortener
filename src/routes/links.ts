import type { Hono } from "hono";
import type { AppDeps, LinkRow } from "../types";
import { referrerHost, validateShortenInput } from "../validation";

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
    const now = deps.now();
    const input = validateShortenInput(body, now);
    if (typeof input === "string") {
      return c.json({ error: input }, 400);
    }
    const createdAt = now.toISOString();
    const insert = deps.db.prepare(
      `INSERT INTO links (code, original_url, created_at, expires_at)
       VALUES (?, ?, ?, ?) ON CONFLICT(code) DO NOTHING`,
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = deps.generateCode();
      const result = insert.run(code, input.url, createdAt, input.expiresAt);
      if (result.changes === 0) continue;

      return c.json(
        {
          shortCode: code,
          shortUrl: `${deps.baseUrl}/${code}`,
          analyticsUrl: `${deps.baseUrl}/analytics/${code}`,
          originalUrl: input.url,
          createdAt,
          expiresAt: input.expiresAt,
        },
        201,
      );
    }
    return c.json({ error: "Unable to generate a unique short code" }, 500);
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
