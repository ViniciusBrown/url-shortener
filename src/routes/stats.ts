import type { Hono } from "hono";
import { getStats, listLinks } from "../stats";
import type { AppDeps } from "../types";

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
    return c.json({ urls: listLinks(deps, limit) });
  });

  app.get("/api/stats/:code", (c) => {
    c.header("Cache-Control", "no-store");
    const stats = getStats(deps, c.req.param("code"));
    if (!stats) return c.json({ error: "Not found" }, 404);
    return c.json(stats);
  });
}
