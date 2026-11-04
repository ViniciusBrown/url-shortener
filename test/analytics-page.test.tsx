import { describe, expect, test } from "vitest";
import type { DayClicks, LinkStats } from "../src/types";
import {
  AnalyticsNotFoundPage,
  AnalyticsPage,
  type AnalyticsPageProps,
} from "../src/views/AnalyticsPage";

const FIRST_DAY = Date.UTC(2026, 9, 6);
const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_URL = "http://localhost:3000/aZ3kP9x";
const ANALYTICS_URL = "http://localhost:3000/analytics/aZ3kP9x";
const ORIGINAL_URL = "https://example.com/path";

function dateAt(index: number): string {
  return new Date(FIRST_DAY + index * DAY_MS).toISOString().slice(0, 10);
}

// 30 days ending on 2026-11-04, with the clicks given by day index.
function days(clicks: Record<number, number> = {}): DayClicks[] {
  return Array.from({ length: 30 }, (_, index) => ({
    date: dateAt(index),
    clicks: clicks[index] ?? 0,
  }));
}

function stats(overrides: Partial<LinkStats> = {}): LinkStats {
  return {
    shortCode: "aZ3kP9x",
    originalUrl: ORIGINAL_URL,
    createdAt: "2026-10-01T12:00:00.000Z",
    expiresAt: null,
    totalClicks: 1284,
    clicksByDay: days({ 3: 10, 20: 5, 29: 2 }),
    topReferrers: [
      { referrer: "news.ycombinator.com", clicks: 900 },
      { referrer: "(direct)", clicks: 384 },
    ],
    ...overrides,
  };
}

function render(
  statsOverrides: Partial<LinkStats> = {},
  props: Partial<AnalyticsPageProps> = {},
): string {
  return String(
    <AnalyticsPage
      stats={stats(statsOverrides)}
      shortUrl={SHORT_URL}
      analyticsUrl={ANALYTICS_URL}
      expired={false}
      {...props}
    />,
  );
}

function bars(html: string): string[] {
  return html.match(/<rect[^>]*data-date="[^"]*"[^>]*>/g) ?? [];
}

function barHeight(html: string, date: string): number {
  const bar = bars(html).find((tag) => tag.includes(`data-date="${date}"`));
  return Number(bar?.match(/ height="([\d.]+)"/)?.[1]);
}

function dateAxisLabels(html: string): string[] {
  return [...html.matchAll(/<text[^>]*class="tick x"[^>]*>([^<]*)</g)].map(
    (match) => match[1] ?? "",
  );
}

describe("totals", () => {
  test("shows the all-time total with a thousands separator", () => {
    expect(render()).toContain("Clicked 1,284 times");
  });

  test("uses a singular form for one click", () => {
    expect(render({ totalClicks: 1 })).toContain("Clicked once");
  });

  test("states the 30-day total separately from the all-time total", () => {
    expect(render()).toContain("17 clicks in the last 30 days");
  });
});

describe("URLs", () => {
  test("shows the short URL and the analytics URL as visible text", () => {
    const text = render().replace(/<[^>]*>/g, " ");

    expect(text).toContain(SHORT_URL);
    expect(text).toContain(ANALYTICS_URL);
  });

  test("links the original URL without sending a referrer", () => {
    const html = render();

    expect(html).toContain(`href="${ORIGINAL_URL}"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(`>${ORIGINAL_URL}</a>`);
  });

  test("shows a non-web original URL as text and never as a link", () => {
    const html = render({ originalUrl: "javascript:alert(1)" });

    expect(html).toContain("javascript:alert(1)");
    expect(html).not.toContain("href=");
  });
});

describe("chart", () => {
  test("draws one bar for each of the 30 days", () => {
    const html = render();

    expect(bars(html)).toHaveLength(30);
    for (let index = 0; index < 30; index++) {
      expect(barHeight(html, dateAt(index))).toBeGreaterThan(0);
    }
  });

  test("makes bar height follow the click count", () => {
    const html = render();

    const empty = barHeight(html, dateAt(0));
    const two = barHeight(html, dateAt(29));
    const five = barHeight(html, dateAt(20));
    const ten = barHeight(html, dateAt(3));

    expect(two).toBeGreaterThan(empty);
    expect(five).toBeGreaterThan(two);
    expect(ten).toBeGreaterThan(five);
  });

  test("keeps a single click visible next to a very busy day", () => {
    const html = render({ clicksByDay: days({ 0: 100000, 1: 1 }) });

    expect(barHeight(html, dateAt(1))).toBeGreaterThan(
      barHeight(html, dateAt(2)),
    );
  });

  test("labels a readable number of dates, ending on today", () => {
    const labels = dateAxisLabels(render());

    expect(labels).toEqual(["Oct 7", "Oct 14", "Oct 21", "Oct 28", "Nov 4"]);
  });

  test("uses whole numbers on the click axis", () => {
    const html = render({ clicksByDay: days({ 4: 1 }) });
    const labels = [
      ...html.matchAll(/<text[^>]*class="tick y"[^>]*>([^<]*)</g),
    ].map((match) => match[1]);

    expect(labels).toEqual(["0", "1"]);
  });

  test("labels only the busiest day directly on the chart", () => {
    const html = render();

    expect(html.match(/class="peak"/g)).toHaveLength(1);
    expect(html).toMatch(/class="peak"[^>]*>10 on Oct 9</);
  });

  test("gives the chart an accessible name and description", () => {
    const html = render();

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-labelledby="chart-title chart-desc"');
    expect(html).toMatch(/<title id="chart-title">[^<]*Clicks per day/);
    expect(html).toMatch(
      /<desc id="chart-desc">[^<]*Oct 6 to Nov 4[^<]*Oct 9 with 10 clicks/,
    );
  });

  test("offers every daily value in a table", () => {
    const html = render();
    const table = html.match(/<details[\s\S]*<\/details>/)?.[0] ?? "";

    expect(table.match(/<tbody>[\s\S]*<\/tbody>/)?.[0]).toBeDefined();
    expect(table.match(/<tr>/g)).toHaveLength(31);
    expect(table).toContain(`dateTime="${dateAt(3)}"`);
  });
});

describe("referrers", () => {
  test("shows one table row per referrer with its clicks", () => {
    const html = render();

    expect(html.match(/<td class="ref">/g)).toHaveLength(2);
    expect(html).toContain("news.ycombinator.com");
    expect(html).toMatch(/<td class="num">900<\/td>/);
    expect(html).toMatch(/<td class="num">384<\/td>/);
  });

  test("sizes each meter against the top referrer", () => {
    const html = render();

    expect(html).toContain('style="width:100%"');
    expect(html).toContain('style="width:42.667%"');
  });

  test("explains (direct) only when it appears", () => {
    const explanation = "no referring page";

    expect(render()).toContain(explanation);
    expect(
      render({ topReferrers: [{ referrer: "a.example", clicks: 1 }] }),
    ).not.toContain(explanation);
  });
});

describe("zero clicks", () => {
  const empty = {
    totalClicks: 0,
    clicksByDay: days(),
    topReferrers: [],
  };

  test("says the link has no clicks and how to get some", () => {
    const html = render(empty);

    expect(html).toContain("Not clicked yet");
    expect(html).toContain("Share the short link");
    expect(html).toContain("No clicks in the last 30 days");
  });

  test("still draws the 30-day axis with no busiest-day label", () => {
    const html = render(empty);

    expect(bars(html)).toHaveLength(30);
    expect(dateAxisLabels(html)).toHaveLength(5);
    expect(html).not.toContain('class="peak"');
  });

  test("replaces the referrer table with a message", () => {
    const html = render(empty);

    expect(html).not.toContain('<td class="ref">');
    expect(html).toContain("No referrers yet");
  });

  test("handles old clicks with none in the last 30 days", () => {
    const html = render({ ...empty, totalClicks: 7 });

    expect(html).toContain("Clicked 7 times");
    expect(html).toContain("No clicks in the last 30 days");
    expect(html).not.toContain("Share the short link");
  });
});

describe("expiry", () => {
  const expiresAt = "2026-11-03T12:00:00.000Z";

  test("shows an expired badge when the expired prop is set", () => {
    const html = render({ expiresAt }, { expired: true });

    expect(html).toContain('<span class="badge">Expired</span>');
    expect(html).toContain('<body class="dead">');
    expect(html).toContain("no longer redirects");
    expect(html).toContain("Nov 3, 2026");
  });

  test("shows no badge for a link that has yet to expire", () => {
    const html = render({ expiresAt: "2030-01-01T00:00:00.000Z" });

    expect(html).not.toContain("Expired");
    expect(html).not.toContain('class="dead"');
    expect(html).toContain("Jan 1, 2030");
  });

  test("says when a link never expires", () => {
    expect(render()).toContain("Never");
  });
});

describe("untrusted input", () => {
  const payload = "<script>alert(1)</script>";
  const escaped = "&lt;script&gt;alert(1)&lt;/script&gt;";

  test("escapes a script tag in a referrer", () => {
    const html = render({ topReferrers: [{ referrer: payload, clicks: 3 }] });

    expect(html).toContain(escaped);
    expect(html).not.toContain(payload);
    expect(html).not.toContain("<script");
  });

  test("escapes markup in the original URL", () => {
    const url = `https://example.com/"><img src=x onerror=alert(1)>`;
    const html = render({ originalUrl: url });

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  test("escapes markup in the code on the not-found page", () => {
    const html = String(<AnalyticsNotFoundPage code={payload} />);

    expect(html).toContain(escaped);
    expect(html).not.toContain("<script");
  });
});

describe("page", () => {
  test("loads nothing from outside the document", () => {
    const html = render();

    expect(html).not.toMatch(/<(script|img|link|iframe)\b/);
    expect(html).not.toMatch(/\bsrc=/);
    expect(html).not.toMatch(/url\(|@import/);
  });

  test("has a stylesheet the JSX renderer left intact", () => {
    const css = render().match(/<style>([\s\S]*)<\/style>/)?.[1] ?? "";

    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).not.toContain("&");
  });

  test("declares its language, viewport and title", () => {
    const html = render();

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('name="viewport"');
    expect(html).toMatch(/<title>[^<]*aZ3kP9x[^<]*<\/title>/);
  });

  test("shows a not-found message with the code that was asked for", () => {
    const html = String(<AnalyticsNotFoundPage code="abc1234" />);

    expect(html).toContain("<h1>");
    expect(html).toContain("abc1234");
    expect(html).toContain("case-sensitive");
  });
});
