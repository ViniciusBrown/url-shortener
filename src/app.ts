import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createClientIpResolver } from "./client-ip";
import { generateCode } from "./code";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerLinkRoutes } from "./routes/links";
import { registerStatsRoutes } from "./routes/stats";
import type { AppDeps, AppOptions } from "./types";

const MAX_BODY_BYTES = 64 * 1024;

export function createApp(options: AppOptions): Hono {
  const deps: AppDeps = {
    now: () => new Date(),
    generateCode,
    baseUrl: "http://localhost:3000",
    getClientIp: createClientIpResolver({ trustProxy: false }),
    ...options,
  };

  const app = new Hono();

  app.use(
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: "Request body too large" }, 413),
    }),
  );

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
