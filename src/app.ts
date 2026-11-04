import { Hono } from "hono";
import { createClientIpResolver } from "./client-ip";
import { generateCode } from "./code";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerLinkRoutes } from "./routes/links";
import { registerStatsRoutes } from "./routes/stats";
import type { AppDeps, AppOptions } from "./types";

export function createApp(options: AppOptions): Hono {
  const deps: AppDeps = {
    now: () => new Date(),
    generateCode,
    baseUrl: "http://localhost:3000",
    getClientIp: createClientIpResolver({ trustProxy: false }),
    ...options,
  };

  const app = new Hono();

  registerStatsRoutes(app, deps);
  registerAnalyticsRoutes(app, deps);
  registerLinkRoutes(app, deps);

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
