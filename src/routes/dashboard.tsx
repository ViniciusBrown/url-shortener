import type { Context, Hono } from "hono";
import { createLink, EXPIRY_PRESETS } from "../links";
import { getLink, getTotals, listLinks } from "../stats";
import type { AppDeps } from "../types";
import { DashboardPage, type DashboardPageProps } from "../views/DashboardPage";

const LATEST_LINKS = 100;

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

const COPY_SCRIPT = `document.querySelectorAll("[data-copy]").forEach((button) => {
  button.hidden = false;
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = "Copy";
    }, 2000);
  });
});
`;

export function registerDashboardRoutes(app: Hono, deps: AppDeps): void {
  function page(
    c: Context,
    props: Pick<DashboardPageProps, "created" | "form">,
    status: 200 | 400 | 500 = 200,
  ) {
    const dashboard = (
      <DashboardPage
        links={listLinks(deps, LATEST_LINKS)}
        totals={getTotals(deps)}
        now={deps.now()}
        {...props}
      />
    );
    return c.html(`<!doctype html>${dashboard}`, status, HEADERS);
  }

  app.get("/", (c) => {
    const code = c.req.query("created");
    return page(c, { created: code ? getLink(deps, code) : null });
  });

  app.post("/links", async (c) => {
    const form = await c.req.parseBody();
    const url = typeof form.url === "string" ? form.url : "";
    const expiresIn = typeof form.expiresIn === "string" ? form.expiresIn : "";

    const preset = EXPIRY_PRESETS.find(({ value }) => value === expiresIn);
    if (!preset) {
      const error = "Choose when the link expires from the list";
      return page(c, { form: { url, error } }, 400);
    }

    const expiresAt =
      preset.ms === null
        ? null
        : new Date(deps.now().getTime() + preset.ms).toISOString();
    const result = createLink(deps, { url, expiresAt });
    if ("error" in result) {
      const { error, status } = result;
      return page(c, { form: { url, expiresIn, error } }, status);
    }
    return c.redirect(`/?created=${result.shortCode}`, 303);
  });

  app.get("/assets/copy.js", (c) =>
    c.body(COPY_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  );
}
