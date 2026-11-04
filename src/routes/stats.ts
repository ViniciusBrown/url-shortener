import type { Hono } from "hono";
import { getStats } from "../stats";
import type { AppDeps } from "../types";

export function registerStatsRoutes(app: Hono, deps: AppDeps): void {
  app.get("/api/stats/:code", (c) => {
    c.header("Cache-Control", "no-store");
    const stats = getStats(deps, c.req.param("code"));
    if (!stats) return c.json({ error: "Not found" }, 404);
    return c.json(stats);
  });
}
