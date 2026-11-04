import type { Hono } from "hono";
import type { JSX } from "hono/jsx/jsx-runtime";
import { getStats } from "../stats";
import type { AppDeps } from "../types";
import { AnalyticsNotFoundPage, AnalyticsPage } from "../views/AnalyticsPage";

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
};

function toDocument(page: JSX.Element): string {
  return `<!doctype html>${page}`;
}

export function registerAnalyticsRoutes(app: Hono, deps: AppDeps): void {
  app.get("/analytics/:code{[0-9a-zA-Z]{7}}", (c) => {
    const code = c.req.param("code");
    const stats = getStats(deps, code);

    if (!stats) {
      return c.html(
        toDocument(<AnalyticsNotFoundPage code={code} />),
        404,
        HEADERS,
      );
    }

    const expired =
      stats.expiresAt !== null &&
      deps.now().getTime() >= new Date(stats.expiresAt).getTime();

    return c.html(
      toDocument(
        <AnalyticsPage
          stats={stats}
          shortUrl={`${deps.baseUrl}/${code}`}
          analyticsUrl={`${deps.baseUrl}/analytics/${code}`}
          expired={expired}
        />,
      ),
      200,
      HEADERS,
    );
  });
}
