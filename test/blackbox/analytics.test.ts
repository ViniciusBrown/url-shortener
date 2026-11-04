import { describe, expect, it } from "vitest";
import {
  CLIENT_IP,
  USER_AGENT,
  click,
  createLink,
  harness,
  stats,
} from "./helpers";

const SCRIPT = "<script>alert('blackbox-xss')</script>";

function expectHtmlHeaders(response: Response) {
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(response.headers.get("cache-control")).toBe("no-store");
  const csp = response.headers.get("content-security-policy");
  expect(csp).not.toBeNull();
  const directives = new Map(
    csp!
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...values]) => [name!, values]),
  );
  expect(directives.get("default-src")).toEqual(["'none'"]);
  const isStyleSource = (name: string) =>
    /^style-src(?:-(?:elem|attr))?$/.test(name);
  expect(
    [...directives].some(
      ([name, values]) =>
        isStyleSource(name) && values.includes("'unsafe-inline'"),
    ),
  ).toBe(true);
  // Extra restrictive directives are fine; no other resource may be allowed.
  for (const [name, values] of directives) {
    if (isStyleSource(name)) {
      expect(["'none'", "'unsafe-inline'"]).toContain(values.join(" "));
    } else if (name.includes("-src")) {
      expect(values).toEqual(["'none'"]);
    }
  }
}

function expectNoScript(html: string) {
  expect(html).not.toMatch(/<script\b/i);
  expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  expect(html).not.toMatch(/(?:href|src)\s*=\s*["']?\s*javascript:/i);
  expect(html).not.toContain(SCRIPT);
  expect(html).not.toContain(CLIENT_IP);
  expect(html).not.toContain(USER_AGENT);
}

function visibleText(html: string) {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tableRows(html: string) {
  return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].flatMap(
    ([, table]) =>
      [...table!.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
        [...row!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
          ([, cell]) => visibleText(cell!),
        ),
      ),
  );
}

describe("GET /analytics/:code", () => {
  it("renders an HTML zero-click page with an SVG chart and the original URL", async () => {
    const h = harness();
    const link = await createLink(h);
    const response = await h.app.request(`/analytics/${link.shortCode}`);
    expect(response.status).toBe(200);
    expectHtmlHeaders(response);
    const html = await response.text();
    expectNoScript(html);
    expect(html).toMatch(/<svg\b/i);
    expect(html).toContain(link.originalUrl);
    expect(visibleText(html)).toMatch(/\b0\b/);
    expect((await stats(h, link.shortCode)).totalClicks).toBe(0);
  });

  it("shows the total outside the chart and the correctly aggregated referrers in a table", async () => {
    const h = harness();
    const link = await createLink(h);
    for (let index = 0; index < 7; index++) {
      await click(h, link.shortCode, {
        Referer:
          index < 5
            ? "https://news.example/article?private=do-not-display"
            : "https://other.example/another",
      });
    }
    const response = await h.app.request(`/analytics/${link.shortCode}`);
    expect(response.status).toBe(200);
    expectHtmlHeaders(response);
    const html = await response.text();
    expectNoScript(html);
    expect(html).toMatch(/<svg\b/i);
    const outsideChartAndTable = html
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, " ");
    expect(visibleText(outsideChartAndTable)).toMatch(/\b7\b/);
    const rows = tableRows(html);
    const newsIndex = rows.findIndex(
      (cells) => cells.includes("news.example") && cells.includes("5"),
    );
    const otherIndex = rows.findIndex(
      (cells) => cells.includes("other.example") && cells.includes("2"),
    );
    expect(newsIndex).toBeGreaterThanOrEqual(0);
    expect(otherIndex).toBeGreaterThan(newsIndex);
    expect(html).not.toContain("private=do-not-display");
  });

  it("retains analytics and shows an expired badge at the exact expiry instant", async () => {
    const h = harness();
    const link = await createLink(h, {
      url: "https://example.com/",
      expiresAt: "2026-11-04T12:00:01Z",
    });
    await click(h, link.shortCode);
    h.setNow("2026-11-04T12:00:01Z");
    const response = await h.app.request(`/analytics/${link.shortCode}`);
    expect(response.status).toBe(200);
    expectHtmlHeaders(response);
    const html = await response.text();
    // The brief is Portuguese and the contract English; no exact UI copy is fixed.
    expect(visibleText(html)).toMatch(
      /expired|expirad[oa]|expirou|vencid[oa]/i,
    );
    expect(html).toContain(link.originalUrl);
    expect((await stats(h, link.shortCode)).totalClicks).toBe(1);
  });

  it("escapes URL markup while a script-bearing Referer is safely reduced to its hostname", async () => {
    const h = harness();
    const url = `https://destination.example/?payload=${SCRIPT}&other="quoted"`;
    const link = await createLink(h, { url });
    await click(h, link.shortCode, {
      Referer: `https://referrer.example/${SCRIPT}`,
      "User-Agent": `private-agent-script-marker-${SCRIPT}`,
    });
    const response = await h.app.request(`/analytics/${link.shortCode}`, {
      headers: { Referer: SCRIPT },
    });
    expect(response.status).toBe(200);
    expectHtmlHeaders(response);
    const html = await response.text();
    expectNoScript(html);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;/script&gt;");
    expect(html).not.toContain("private-agent-script-marker");
    expect(
      tableRows(html).some((row) => row.includes("referrer.example")),
    ).toBe(true);
    expect((await stats(h, link.shortCode)).topReferrers).toEqual([
      { referrer: "referrer.example", clicks: 1 },
    ]);
  });

  it("handles a malformed script-only Referer as (unknown), without reflecting raw markup", async () => {
    const h = harness();
    const link = await createLink(h);
    await click(h, link.shortCode, { Referer: SCRIPT });
    const response = await h.app.request(`/analytics/${link.shortCode}`);
    expect(response.status).toBe(200);
    expectHtmlHeaders(response);
    const html = await response.text();
    expectNoScript(html);
    expect(visibleText(html)).toContain("(unknown)");
    expect((await stats(h, link.shortCode)).topReferrers).toEqual([
      { referrer: "(unknown)", clicks: 1 },
    ]);
  });

  it("returns an HTML 404 with restrictive headers and no script reflection for an unknown code", async () => {
    const response = await harness().app.request("/analytics/M1ss1ng", {
      headers: { Referer: SCRIPT, "User-Agent": USER_AGENT },
    });
    expect(response.status).toBe(404);
    expectHtmlHeaders(response);
    const html = await response.text();
    expectNoScript(html);
    expect(html.trim().length).toBeGreaterThan(0);
    expect(html.trim()).not.toMatch(/^\{/);
  });
});
