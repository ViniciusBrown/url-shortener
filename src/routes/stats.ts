import type { Hono } from "hono";
import { getStats } from "../stats";
import type { AppDeps, LinkRow } from "../types";

export function registerStatsRoutes(app: Hono, deps: AppDeps): void {
  app.get("/api/urls", (c) => {
    const limits = c.req.queries("limit") ?? ["100"];
    const rawLimit = limits[0] ?? "";
    const limit = Number(rawLimit);
    if (
      limits.length !== 1 ||
      !/^\d+$/.test(rawLimit) ||
      limit < 1 ||
      limit > 500
    ) {
      return c.json({ error: "limit must be an integer from 1 to 500" }, 400);
    }
    const links = deps.db
      .prepare(
        `
        SELECT id, code, original_url, created_at, expires_at,
          (SELECT COUNT(*) FROM clicks WHERE link_id = links.id) AS total_clicks
        FROM links
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `,
      )
      .all(limit) as unknown as (LinkRow & { total_clicks: number })[];
    const baseUrl = deps.baseUrl.replace(/\/+$/, "");
    return c.json({
      urls: links.map((link) => ({
        shortCode: link.code,
        shortUrl: `${baseUrl}/${link.code}`,
        analyticsUrl: `${baseUrl}/analytics/${link.code}`,
        originalUrl: link.original_url,
        createdAt: link.created_at,
        expiresAt: link.expires_at,
        totalClicks: link.total_clicks,
      })),
    });
  });

  app.get("/api/stats/:code", (c) => {
    c.header("Cache-Control", "no-store");
    const stats = getStats(deps, c.req.param("code"));
    if (!stats) return c.json({ error: "Not found" }, 404);
    return c.json(stats);
  });
}
