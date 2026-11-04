import { describe, expect, it } from "vitest";
import {
  START,
  click,
  createLink,
  expectJsonError,
  harness,
  stats,
  utcDaysEndingOn,
} from "./helpers";

describe("GET /api/stats/:code", () => {
  it("returns exactly the contracted fields with 30 zero-filled UTC days", async () => {
    const h = harness();
    const link = await createLink(h, {
      url: "https://EXAMPLE.com:443/exact?x=1#fragment",
      expiresAt: "2030-01-01T01:00:00+01:00",
    });
    expect(await stats(h, link.shortCode)).toEqual({
      shortCode: link.shortCode,
      originalUrl: link.originalUrl,
      createdAt: START,
      expiresAt: "2030-01-01T00:00:00.000Z",
      totalClicks: 0,
      clicksByDay: utcDaysEndingOn(START).map((date) => ({ date, clicks: 0 })),
      topReferrers: [],
    });
  });

  it("returns a JSON 404 with no-store for an unknown code", async () => {
    const response = await harness().app.request("/api/stats/M1ss1ng");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expectJsonError(response, 404);
  });

  it("keeps total and referrers all-time but includes only today and the preceding 29 UTC days", async () => {
    const h = harness();
    h.setNow("2026-10-05T23:59:59.999Z");
    const link = await createLink(h);
    await click(h, link.shortCode, { Referer: "https://archive.example/old" });
    const times = [
      "2026-10-06T00:00:00.000Z",
      "2026-10-06T23:59:59.999Z",
      "2026-11-03T23:59:59.999Z",
      "2026-11-04T00:00:00.000Z",
      START,
    ];
    for (const time of times) {
      h.setNow(time);
      await click(h, link.shortCode);
    }
    const result = await stats(h, link.shortCode);
    expect(result.totalClicks).toBe(6);
    expect(result.topReferrers).toEqual([
      { referrer: "(direct)", clicks: 5 },
      { referrer: "archive.example", clicks: 1 },
    ]);
    const counts: Record<string, number> = {
      "2026-10-06": 2,
      "2026-11-03": 1,
      "2026-11-04": 2,
    };
    expect(result.clicksByDay).toEqual(
      utcDaysEndingOn(START).map((date) => ({
        date,
        clicks: counts[date] ?? 0,
      })),
    );
    expect(result.clicksByDay[0]?.date).toBe("2026-10-06");
    expect(result.clicksByDay.at(-1)?.date).toBe("2026-11-04");
    expect(result.clicksByDay.reduce((sum, day) => sum + day.clicks, 0)).toBe(
      5,
    );
  });

  it("advances the window at UTC midnight, leaving previous clicks in the all-time totals", async () => {
    const h = harness();
    h.setNow("2026-10-06T00:00:00Z");
    const link = await createLink(h);
    await click(h, link.shortCode);
    h.setNow("2026-11-04T23:59:59.999Z");
    await click(h, link.shortCode);
    expect((await stats(h, link.shortCode)).clicksByDay[0]).toEqual({
      date: "2026-10-06",
      clicks: 1,
    });
    h.setNow("2026-11-05T00:00:00.000Z");
    await click(h, link.shortCode);
    const result = await stats(h, link.shortCode);
    expect(result.totalClicks).toBe(3);
    expect(result.clicksByDay).toEqual(
      utcDaysEndingOn("2026-11-05").map((date) => ({
        date,
        clicks: date === "2026-11-04" || date === "2026-11-05" ? 1 : 0,
      })),
    );
  });

  it.each([
    ["2028-03-01T00:00:00Z", "2028-02-01"],
    ["2027-01-10T00:00:00Z", "2026-12-12"],
  ])(
    "handles a 30-day window across calendar boundaries: %s",
    async (now, firstDay) => {
      const h = harness();
      h.setNow(now);
      const link = await createLink(h);
      await click(h, link.shortCode);
      const result = await stats(h, link.shortCode);
      expect(result.clicksByDay).toHaveLength(30);
      expect(result.clicksByDay[0]?.date).toBe(firstDay);
      expect(result.clicksByDay.at(-1)).toEqual({
        date: now.slice(0, 10),
        clicks: 1,
      });
      expect(result.clicksByDay.map((day) => day.date)).toEqual(
        utcDaysEndingOn(now),
      );
    },
  );

  it("groups referrers by hostname without scheme, port, path, query or fragment", async () => {
    const h = harness();
    const link = await createLink(h);
    for (const referrer of [
      "https://NEWS.example/article?secret=one#anchor",
      "http://news.example:8080/other",
      "https://news.example:443/third",
      "https://sub.news.example/article",
      "https://münich.example/path",
    ]) {
      await click(h, link.shortCode, { Referer: referrer });
    }
    expect((await stats(h, link.shortCode)).topReferrers).toEqual([
      { referrer: "news.example", clicks: 3 },
      { referrer: "sub.news.example", clicks: 1 },
      { referrer: "xn--mnich-kva.example", clicks: 1 },
    ]);
  });

  it("uses (direct) for absent/empty referrers and (unknown) for malformed ones", async () => {
    const h = harness();
    const link = await createLink(h);
    await click(h, link.shortCode);
    await click(h, link.shortCode, { Referer: "" });
    for (const referrer of ["not a URL", "/relative/path", "https://[broken"]) {
      await click(h, link.shortCode, { Referer: referrer });
    }
    expect((await stats(h, link.shortCode)).topReferrers).toEqual([
      { referrer: "(unknown)", clicks: 3 },
      { referrer: "(direct)", clicks: 2 },
    ]);
  });

  it("returns only the top ten referrers, sorted by count then hostname ascending", async () => {
    const h = harness();
    const link = await createLink(h);
    const rows = Array.from({ length: 12 }, (_, index) => ({
      referrer: `r${String(index).padStart(2, "0")}.example`,
      clicks: index === 11 ? 3 : index === 10 ? 2 : 1,
    }));
    for (const row of [...rows].reverse()) {
      for (let index = 0; index < row.clicks; index++) {
        await click(h, link.shortCode, { Referer: `https://${row.referrer}/` });
      }
    }
    const result = await stats(h, link.shortCode);
    expect(result.totalClicks).toBe(15);
    expect(result.topReferrers).toEqual([
      rows[11],
      rows[10],
      ...rows.slice(0, 8),
    ]);
  });

  it("isolates stats by code and does not count API or analytics reads", async () => {
    const h = harness();
    const first = await createLink(h);
    const second = await createLink(h);
    await click(h, first.shortCode, { Referer: "https://first.example/" });
    await click(h, first.shortCode, { Referer: "https://first.example/" });
    await click(h, second.shortCode, { Referer: "https://second.example/" });
    for (let index = 0; index < 2; index++) {
      expect((await h.app.request("/api/urls")).status).toBe(200);
      expect(
        (await h.app.request(`/analytics/${first.shortCode}`)).status,
      ).toBe(200);
      expect((await stats(h, first.shortCode)).totalClicks).toBe(2);
      expect((await stats(h, second.shortCode)).totalClicks).toBe(1);
    }
    expect((await stats(h, first.shortCode)).topReferrers).toEqual([
      { referrer: "first.example", clicks: 2 },
    ]);
    expect((await stats(h, second.shortCode)).topReferrers).toEqual([
      { referrer: "second.example", clicks: 1 },
    ]);
  });

  it("serves stats for an expired link and retains all prior clicks", async () => {
    const h = harness();
    const link = await createLink(h, {
      url: "https://example.com/",
      expiresAt: "2026-11-04T12:00:01Z",
    });
    await click(h, link.shortCode);
    h.setNow("2026-11-04T12:00:01Z");
    const result = await stats(h, link.shortCode);
    expect(result.expiresAt).toBe("2026-11-04T12:00:01.000Z");
    expect(result.totalClicks).toBe(1);
  });
});
