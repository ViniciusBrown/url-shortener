import type { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import { serve } from "@hono/node-server";
import { afterEach, expect, test, vi } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db";
import type { AppOptions } from "../src/types";

const NOW = "2026-11-04T12:00:00.000Z";
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  vi.restoreAllMocks();
});

function setup(options: Partial<Omit<AppOptions, "db">> = {}) {
  const db = openDb(":memory:");
  databases.push(db);
  const app = createApp({
    db,
    now: () => new Date(NOW),
    generateCode: () => "aZ3kP9x",
    getClientIp: () => "203.0.113.42",
    ...options,
  });
  return { app, db };
}

function shorten(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request("/api/shorten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("creates a short link and preserves the submitted URL exactly", async () => {
  const { app } = setup({ baseUrl: "https://short.example" });
  const originalUrl = "https://EXAMPLE.com:443/a%2fb?b=2&a=1#fragment";

  const response = await shorten(app, { url: originalUrl });

  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({
    shortCode: "aZ3kP9x",
    shortUrl: "https://short.example/aZ3kP9x",
    analyticsUrl: "https://short.example/analytics/aZ3kP9x",
    originalUrl,
    createdAt: NOW,
    expiresAt: null,
  });
});

test.each(
  [
    null,
    [],
    ["https://example.com"],
    "https://example.com",
    42,
    true,
    {},
    { url: null },
    { url: 12 },
    { url: false },
    { url: [] },
    { url: {} },
    { url: "" },
    { url: "example.com" },
    { url: "/relative" },
    { url: "https://" },
    { url: "https://[broken" },
    { url: "ftp://example.com/file" },
    { url: "javascript:alert(1)" },
    { url: "http:example.org" },
    { url: "data:text/plain,hello" },
    { url: "https://example.com/" + "a".repeat(2029) },
  ].map((body) => ({ body })),
)("rejects invalid creation input: %j", async ({ body }) => {
  const { app } = setup();
  const response = await shorten(app, body);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: expect.any(String) });
});

test.each(["", "{", '{"url":', "undefined"])(
  "rejects malformed JSON: %j",
  async (body) => {
    const { app } = setup();
    const response = await app.request("/api/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  },
);

test.each([
  " ",
  "\t",
  "\n",
  "\r",
  "\u00a0",
  "\u2003",
  "\u2028",
  "\ufeff",
  ...Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)),
  ...Array.from({ length: 33 }, (_, i) => String.fromCharCode(127 + i)),
])("rejects raw whitespace or control characters: %j", async (character) => {
  const { app } = setup();
  for (const url of [
    `${character}https://example.com`,
    `https://example.com/a${character}b`,
    `https://example.com${character}`,
  ]) {
    const response = await shorten(app, { url });
    expect(response.status, JSON.stringify(url)).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  }
});

test.each([
  "http://example.com",
  "https://example.com/a%20b?line=%0A",
  "https://例え.テスト/路径?q=olá#café",
  "https://example.com/" + "a".repeat(2028),
])("accepts HTTP targets within the length limit: %s", async (url) => {
  const { app } = setup();
  const response = await shorten(app, { url, expiresAt: null });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    originalUrl: url,
    expiresAt: null,
  });
});

test.each(
  [
    "",
    "1",
    1,
    false,
    [],
    {},
    "2030-01-01",
    "2030-01-01T00:00:00",
    "2030-01-01 00:00:00Z",
    "2030-02-31T00:00:00Z",
    "2030-02-29T00:00:00Z",
    "2100-02-29T00:00:00Z",
    "2030-04-31T00:00:00Z",
    "2030-00-01T00:00:00Z",
    "2030-13-01T00:00:00Z",
    "2030-01-00T00:00:00Z",
    "2030-01-32T00:00:00Z",
    "2030-01-01T24:00:00Z",
    "2030-01-01T00:60:00Z",
    "2030-01-01T00:00:61Z",
    "2030-01-01T00:00:00.Z",
    "2030-01-01T00:00:00+24:00",
    "2030-01-01T00:00:00+00:60",
    "2030-01-01T00:00:00+0100",
    "2030-01-01T00:00:00Z\n",
    " 2030-01-01T00:00:00Z",
    "2030-01-01T00:00:00Zsuffix",
    "2026-11-04T11:59:59.999Z",
    NOW,
    "2026-11-04T13:00:00+01:00",
  ].map((expiresAt) => ({ expiresAt })),
)(
  "rejects an invalid, past, or current expiresAt: %j",
  async ({ expiresAt }) => {
    const { app } = setup();
    const response = await shorten(app, {
      url: "https://example.com",
      expiresAt,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  },
);

test.each([
  ["2030-01-01T01:02:03+01:30", "2029-12-31T23:32:03.000Z"],
  ["2030-01-01T01:02:03.123-03:00", "2030-01-01T04:02:03.123Z"],
  ["2028-02-29T23:59:59Z", "2028-02-29T23:59:59.000Z"],
  ["2000-02-29T00:00:00Z", "2000-02-29T00:00:00.000Z"],
  ["2030-01-01t00:00:00z", "2030-01-01T00:00:00.000Z"],
  ["2030-01-01T00:00:00.123456Z", "2030-01-01T00:00:00.123Z"],
  ["2026-11-04T12:00:00.001Z", "2026-11-04T12:00:00.001Z"],
])("normalizes valid expiresAt %s to UTC", async (expiresAt, normalized) => {
  const { app } = setup({ now: () => new Date("1999-01-01T00:00:00Z") });
  const response = await shorten(app, {
    url: "https://example.com",
    expiresAt,
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ expiresAt: normalized });
});

test("retries collisions and succeeds on the fifth insertion attempt", async () => {
  const codes = [
    "aZ3kP9x",
    "aZ3kP9x",
    "aZ3kP9x",
    "aZ3kP9x",
    "aZ3kP9x",
    "bZ3kP9x",
  ];
  let generated = 0;
  const { app } = setup({ generateCode: () => codes[generated++]! });
  expect((await shorten(app, { url: "https://first.example" })).status).toBe(
    201,
  );

  const response = await shorten(app, { url: "https://second.example" });

  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    shortCode: "bZ3kP9x",
    originalUrl: "https://second.example",
  });
  expect(generated).toBe(6);
  const original = await app.request("/aZ3kP9x");
  expect(original.headers.get("Location")).toBe("https://first.example/");
});

test("returns a JSON 500 after exactly five collisions", async () => {
  let generated = 0;
  const { app } = setup({
    generateCode: () => {
      generated++;
      return "aZ3kP9x";
    },
  });
  expect((await shorten(app, { url: "https://first.example" })).status).toBe(
    201,
  );

  const response = await shorten(app, { url: "https://second.example" });

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: expect.any(String) });
  expect(generated).toBe(6);
});

test("the default generator creates seven-character alphanumeric short codes", async () => {
  const { db } = setup();
  const app = createApp({
    db,
    now: () => new Date(NOW),
    getClientIp: () => null,
  });
  for (let i = 0; i < 12; i++) {
    const response = await shorten(app, { url: "https://example.com" });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      shortCode: expect.stringMatching(/^[0-9a-zA-Z]{7}$/),
    });
  }
});

test("redirects to the canonical target without allowing caching", async () => {
  const { app } = setup();
  const url = "HTTPS://EXAMPLE.COM:443/a/../path?q=hello%20world#fragment";
  expect((await shorten(app, { url })).status).toBe(201);

  const response = await app.request("/aZ3kP9x");

  expect(response.status).toBe(301);
  expect(response.headers.get("Location")).toBe(new URL(url).href);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

test.each(["GET", "HEAD"])(
  "returns an uncacheable 404 for unknown codes via %s",
  async (method) => {
    const { app } = setup();
    const response = await app.request("/missing", { method });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.has("Location")).toBe(false);
    if (method === "HEAD") expect(await response.text()).toBe("");
    else expect(await response.json()).toEqual({ error: expect.any(String) });
  },
);

test.each(["GET", "HEAD"])(
  "checks expiry at the exact boundary via %s",
  async (method) => {
    let time = new Date(NOW);
    let clientIpReads = 0;
    const { app } = setup({
      now: () => time,
      getClientIp: () => {
        clientIpReads++;
        return null;
      },
    });
    expect(
      (
        await shorten(app, {
          url: "https://example.com",
          expiresAt: "2026-11-04T13:00:00+01:00",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await shorten(app, {
          url: "https://example.com",
          expiresAt: "2026-11-04T13:00:01+01:00",
        })
      ).status,
    ).toBe(201);

    time = new Date("2026-11-04T12:00:00.999Z");
    const active = await app.request("/aZ3kP9x", { method });
    expect(active.status).toBe(301);
    expect(active.headers.get("Location")).toBe("https://example.com/");
    expect(active.headers.get("Cache-Control")).toBe("no-store");

    for (const expiredAt of [
      "2026-11-04T12:00:01.000Z",
      "2026-11-05T12:00:00.000Z",
    ]) {
      time = new Date(expiredAt);
      const expired = await app.request("/aZ3kP9x", { method });
      expect(expired.status).toBe(410);
      expect(expired.headers.get("Cache-Control")).toBe("no-store");
      expect(expired.headers.has("Location")).toBe(false);
      if (method === "HEAD") expect(await expired.text()).toBe("");
      else expect(await expired.json()).toEqual({ error: expect.any(String) });
    }
    expect(clientIpReads).toBe(method === "GET" ? 1 : 0);
  },
);

test("codes are case-sensitive and HEAD preserves GET headers without recording a click", async () => {
  let clientIpReads = 0;
  const { app } = setup({
    getClientIp: () => {
      clientIpReads++;
      return "203.0.113.42";
    },
  });
  expect((await shorten(app, { url: "https://example.com/path" })).status).toBe(
    201,
  );
  const head = await app.request("/aZ3kP9x", { method: "HEAD" });
  expect(head.status).toBe(301);
  expect(await head.text()).toBe("");
  expect(clientIpReads).toBe(0);

  const get = await app.request("/aZ3kP9x");
  expect(get.status).toBe(301);
  expect([...head.headers]).toEqual([...get.headers]);
  expect(clientIpReads).toBe(1);
  expect((await app.request("/az3kp9x")).status).toBe(404);
  expect(clientIpReads).toBe(1);
});

test.each([
  "/favicon.ico",
  "/abcdef",
  "/abcdefgh",
  "/abc_def",
  "/abc-def",
  "/abcdef!",
  "/ébcdefg",
  "/api/nope",
  "/api/abcdefg",
  "/analytics/nope",
  "/aZ3kP9x/extra",
])("does not match invalid code paths: %s", async (path) => {
  let clientIpReads = 0;
  const { app } = setup({
    getClientIp: () => {
      clientIpReads++;
      return null;
    },
  });
  for (const method of ["GET", "HEAD"]) {
    const response = await app.request(path, { method });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    if (method === "GET")
      expect(await response.json()).toEqual({ error: "Not found" });
  }
  expect(clientIpReads).toBe(0);
});

test("logs failed click writes and still redirects; HEAD never attempts a write", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const { app, db } = setup();
  expect((await shorten(app, { url: "https://example.com" })).status).toBe(201);
  db.exec("DROP TABLE clicks");

  const head = await app.request("/aZ3kP9x", { method: "HEAD" });
  expect(head.status).toBe(301);
  expect(errors).not.toHaveBeenCalled();
  const get = await app.request("/aZ3kP9x");
  expect(get.status).toBe(301);
  expect(get.headers.get("Location")).toBe("https://example.com/");
  expect(get.headers.get("Cache-Control")).toBe("no-store");
  expect(errors).toHaveBeenCalledTimes(1);
  expect(errors).toHaveBeenCalledWith(
    "Failed to record click",
    expect.any(Error),
  );

  errors.mockClear();
  expect((await app.request("/missing")).status).toBe(404);
  expect(errors).not.toHaveBeenCalled();
});

test("a non-ASCII target redirects successfully over a real Node HTTP server", async () => {
  const { app } = setup();
  const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" });
  try {
    if (!server.listening) await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string")
      throw new Error("Missing TCP address");
    const origin = `http://127.0.0.1:${address.port}`;
    const url = "https://例え.テスト/路径?q=olá#café";
    const created = await fetch(`${origin}/api/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ originalUrl: url });

    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(`${origin}/aZ3kP9x`, {
        method,
        redirect: "manual",
      });
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe(new URL(url).href);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await response.text();
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
