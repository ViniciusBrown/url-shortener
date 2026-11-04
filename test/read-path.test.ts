import { afterEach, expect, test } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db";
import type { LinkStats } from "../src/types";

const databases: ReturnType<typeof openDb>[] = [];
const baseUrl = "https://sho.rt";

function setup(at = "2026-11-04T12:34:56.789Z") {
  const db = openDb(":memory:");
  databases.push(db);
  let now = new Date(at);
  const app = createApp({ db, now: () => now, baseUrl });
  return {
    db,
    app,
    setNow: (at: string) => {
      now = new Date(at);
    },
  };
}

function seedLink(
  db: ReturnType<typeof openDb>,
  code = "aZ3kP9x",
  createdAt = "2026-10-01T12:00:00.000Z",
  expiresAt: string | null = null,
) {
  return Number(
    db
      .prepare(
        "INSERT INTO links (code, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run(code, `https://example.com/${code}`, createdAt, expiresAt)
      .lastInsertRowid,
  );
}

function seedClick(
  db: ReturnType<typeof openDb>,
  linkId: number,
  clickedAt: string,
  referrerHost = "(direct)",
  referrer: string | null = null,
) {
  db.prepare(
    "INSERT INTO clicks (link_id, clicked_at, referrer, referrer_host, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    linkId,
    clickedAt,
    referrer,
    referrerHost,
    "private-user-agent-<script>alert(1)</script>",
    "198.51.100.42",
  );
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

test("stats for a zero-click link contain exactly 30 zero-filled UTC days", async () => {
  // The local calendar date is November 3, but UTC is already November 4.
  const { db, app } = setup("2026-11-03T23:30:00.000-04:00");
  seedLink(db);

  const res = await app.request("/api/stats/aZ3kP9x");

  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  expect(await res.json()).toEqual({
    shortCode: "aZ3kP9x",
    originalUrl: "https://example.com/aZ3kP9x",
    createdAt: "2026-10-01T12:00:00.000Z",
    expiresAt: null,
    totalClicks: 0,
    clicksByDay: Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 9, 6 + index)).toISOString().slice(0, 10),
      clicks: 0,
    })),
    topReferrers: [],
  });
});

test("expired links keep all-time totals and count clicks at UTC window edges", async () => {
  const { db, app } = setup();
  const linkId = seedLink(
    db,
    "aZ3kP9x",
    "2026-10-01T12:00:00.000Z",
    "2026-11-01T00:00:00.000Z",
  );
  const times = [
    "2026-10-05T23:59:59.999Z",
    "2026-10-06T00:00:00.000Z",
    "2026-10-06T23:59:59.999Z",
    "2026-10-07T00:00:00.000Z",
    "2026-11-03T23:59:59.999Z",
    "2026-11-04T00:00:00.000Z",
    "2026-11-04T23:59:59.999Z",
    "2026-11-05T00:00:00.000Z",
  ];
  for (const time of times) seedClick(db, linkId, time);
  const otherLink = seedLink(db, "other01");
  seedClick(db, otherLink, times[1]!);

  const res = await app.request("/api/stats/aZ3kP9x");
  const stats = (await res.json()) as LinkStats;

  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  expect(stats.expiresAt).toBe("2026-11-01T00:00:00.000Z");
  expect(stats.totalClicks).toBe(8);
  expect(stats.clicksByDay).toHaveLength(30);
  expect(stats.clicksByDay[0]).toEqual({ date: "2026-10-06", clicks: 2 });
  expect(stats.clicksByDay[1]).toEqual({ date: "2026-10-07", clicks: 1 });
  expect(stats.clicksByDay.slice(2, 28).every((day) => day.clicks === 0)).toBe(
    true,
  );
  expect(stats.clicksByDay[28]).toEqual({ date: "2026-11-03", clicks: 1 });
  expect(stats.clicksByDay[29]).toEqual({ date: "2026-11-04", clicks: 2 });
});

test("top referrers use all-time stored host counts, rank ties by name, and expose no private click data", async () => {
  const { db, app } = setup();
  const linkId = seedLink(db);
  for (let index = 0; index < 4; index++) {
    seedClick(
      db,
      linkId,
      "2026-09-01T12:00:00.000Z",
      "news.example",
      `https://raw-referrer.invalid/private-path-${index}`,
    );
  }
  for (let index = 0; index < 3; index++) {
    seedClick(db, linkId, "2026-11-04T12:00:00.000Z");
  }
  for (let index = 0; index < 2; index++) {
    seedClick(
      db,
      linkId,
      "2026-11-04T12:00:00.000Z",
      "(unknown)",
      "malformed referrer",
    );
  }
  for (let index = 11; index >= 0; index--) {
    seedClick(
      db,
      linkId,
      "2026-11-04T12:00:00.000Z",
      `host-${String(index).padStart(2, "0")}.example`,
    );
  }
  seedClick(
    db,
    seedLink(db, "other01"),
    "2026-11-04T12:00:00.000Z",
    "news.example",
  );

  const res = await app.request("/api/stats/aZ3kP9x");
  const text = await res.text();
  const stats = JSON.parse(text) as LinkStats;

  expect(res.status).toBe(200);
  expect(stats.totalClicks).toBe(21);
  expect(stats.topReferrers).toEqual([
    { referrer: "news.example", clicks: 4 },
    { referrer: "(direct)", clicks: 3 },
    { referrer: "(unknown)", clicks: 2 },
    ...Array.from({ length: 7 }, (_, index) => ({
      referrer: `host-0${index}.example`,
      clicks: 1,
    })),
  ]);
  expect(text).not.toContain("198.51.100.42");
  expect(text).not.toContain("private-user-agent");
  expect(text).not.toContain("raw-referrer.invalid");
  expect(text).not.toMatch(/"(?:ip|user_agent|userAgent)"\s*:/);
});

test.each(["missing", "az3kp9x", "%27%20OR%201%3D1--"])(
  "unknown or case-mismatched stats code %s returns a non-cacheable JSON 404",
  async (code) => {
    const { db, app } = setup();
    seedLink(db);

    const res = await app.request(`/api/stats/${code}`);

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "Not found" });
  },
);

test.each([
  { today: "2027-01-01", first: "2026-12-03", before: "2026-12-02" },
  { today: "2024-03-01", first: "2024-02-01", before: "2024-01-31" },
])(
  "the UTC window spans calendar boundaries ending $today",
  async ({ today, first, before }) => {
    const { db, app } = setup(`${today}T12:00:00.000Z`);
    const linkId = seedLink(db, "aZ3kP9x", `${before}T00:00:00.000Z`);
    seedClick(db, linkId, `${before}T23:59:59.999Z`);
    seedClick(db, linkId, `${first}T00:00:00.000Z`);
    seedClick(db, linkId, `${today}T00:00:00.000Z`);

    const res = await app.request("/api/stats/aZ3kP9x");
    const stats = (await res.json()) as LinkStats;

    expect(res.status).toBe(200);
    expect(stats.totalClicks).toBe(3);
    expect(stats.clicksByDay).toHaveLength(30);
    expect(stats.clicksByDay[0]).toEqual({ date: first, clicks: 1 });
    expect(stats.clicksByDay[29]).toEqual({ date: today, clicks: 1 });
    expect(
      stats.clicksByDay.slice(1, 29).every((day) => day.clicks === 0),
    ).toBe(true);
    expect(new Set(stats.clicksByDay.map((day) => day.date)).size).toBe(30);
  },
);

test("the daily window advances when the injected clock crosses UTC midnight", async () => {
  const { db, app, setNow } = setup("2026-11-04T23:59:59.999Z");
  const linkId = seedLink(db);
  seedClick(db, linkId, "2026-10-06T00:00:00.000Z");
  seedClick(db, linkId, "2026-11-04T23:59:59.999Z");

  const before = (await (
    await app.request("/api/stats/aZ3kP9x")
  ).json()) as LinkStats;
  expect(before.clicksByDay[0]).toEqual({ date: "2026-10-06", clicks: 1 });
  expect(before.clicksByDay[29]).toEqual({ date: "2026-11-04", clicks: 1 });

  setNow("2026-11-05T00:00:00.000Z");
  const after = (await (
    await app.request("/api/stats/aZ3kP9x")
  ).json()) as LinkStats;
  expect(after.totalClicks).toBe(2);
  expect(after.clicksByDay).toHaveLength(30);
  expect(after.clicksByDay[0]).toEqual({ date: "2026-10-07", clicks: 0 });
  expect(after.clicksByDay[28]).toEqual({ date: "2026-11-04", clicks: 1 });
  expect(after.clicksByDay[29]).toEqual({ date: "2026-11-05", clicks: 0 });
});

test("URL listing orders by creation time then id, keeps zero-click and expired links, and includes all-time counts", async () => {
  const { db, app } = setup();
  seedLink(db, "newer01", "2026-11-04T12:00:00.000Z");
  const older = seedLink(
    db,
    "older01",
    "2026-10-01T12:00:00.000Z",
    "2026-11-01T00:00:00.000Z",
  );
  const firstTie = seedLink(db, "tie0001", "2026-11-03T12:00:00.000Z");
  seedLink(db, "tie0002", "2026-11-03T12:00:00.000Z");
  seedClick(db, older, "2026-10-02T00:00:00.000Z");
  seedClick(db, older, "2026-11-04T00:00:00.000Z");
  seedClick(db, firstTie, "2026-11-04T00:00:00.000Z");

  // A caller-controlled host must not become part of the short or analytics URL.
  const res = await app.request("https://attacker.example/api/urls");
  const text = await res.text();

  expect(res.status).toBe(200);
  expect(JSON.parse(text)).toEqual({
    urls: [
      ["newer01", "2026-11-04T12:00:00.000Z", null, 0],
      ["tie0002", "2026-11-03T12:00:00.000Z", null, 0],
      ["tie0001", "2026-11-03T12:00:00.000Z", null, 1],
      ["older01", "2026-10-01T12:00:00.000Z", "2026-11-01T00:00:00.000Z", 2],
    ].map(([shortCode, createdAt, expiresAt, totalClicks]) => ({
      shortCode,
      shortUrl: `${baseUrl}/${shortCode}`,
      analyticsUrl: `${baseUrl}/analytics/${shortCode}`,
      originalUrl: `https://example.com/${shortCode}`,
      createdAt,
      expiresAt,
      totalClicks,
    })),
  });
  expect(text).not.toContain("198.51.100.42");
  expect(text).not.toContain("private-user-agent");
  expect(text).not.toMatch(/"(?:ip|user_agent|userAgent)"\s*:/);
});

test.each([
  { query: "", limit: 100 },
  { query: "?limit=1", limit: 1 },
  { query: "?limit=500", limit: 500 },
  { query: "?limit=001", limit: 1 },
])(
  "URL listing applies $query with a limit of $limit",
  async ({ query, limit }) => {
    const { db, app } = setup();
    for (let index = 1; index <= 501; index++) {
      seedLink(db, `u${String(index).padStart(6, "0")}`);
    }

    const res = await app.request(`/api/urls${query}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.urls).toHaveLength(limit);
    expect(
      body.urls.map((url: { shortCode: string }) => url.shortCode),
    ).toEqual(
      Array.from(
        { length: limit },
        (_, index) => `u${String(501 - index).padStart(6, "0")}`,
      ),
    );
  },
);

test.each([
  "",
  "0",
  "-1",
  "501",
  "1.5",
  "1.0",
  "1e2",
  "0x10",
  "Infinity",
  "NaN",
  "abc",
  "1abc",
  "%20",
  "%201%20",
  "+1",
  "%2B1",
  "1%0A",
  "９",
  "9007199254740993",
])("URL listing rejects invalid limit %j with JSON 400", async (value) => {
  const { app } = setup();

  const res = await app.request(`/api/urls?limit=${value}`);

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: expect.any(String) });
});

test("URL listing rejects ambiguous repeated limit parameters", async () => {
  const { app } = setup();

  const res = await app.request("/api/urls?limit=1&limit=500");

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: expect.any(String) });
});

test("an empty database returns an empty URL list", async () => {
  const { app } = setup();

  const res = await app.request("/api/urls");

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ urls: [] });
});

test("URL listing handles a configured base URL with a trailing slash", async () => {
  const { db } = setup();
  seedLink(db);
  const app = createApp({
    db,
    now: () => new Date("2026-11-04T12:00:00.000Z"),
    baseUrl: `${baseUrl}/`,
  });

  const res = await app.request("/api/urls");
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.urls[0].shortUrl).toBe(`${baseUrl}/aZ3kP9x`);
  expect(body.urls[0].analyticsUrl).toBe(`${baseUrl}/analytics/aZ3kP9x`);
});
