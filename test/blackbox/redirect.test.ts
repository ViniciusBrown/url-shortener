import { once } from "node:events";
import { serve } from "@hono/node-server";
import { describe, expect, it } from "vitest";
import {
  START,
  click,
  createLink,
  expectJsonError,
  harness,
  list,
  stats,
} from "./helpers";

describe("GET /:code and HEAD /:code", () => {
  it("redirects repeatedly with 301 and no-store, recording every GET", async () => {
    const h = harness();
    const link = await createLink(h, { url: "https://EXAMPLE.com:443" });
    for (let index = 0; index < 5; index++) {
      const response = await click(h, link.shortCode);
      expect(response.headers.get("location")).toBe("https://example.com/");
    }
    expect((await stats(h, link.shortCode)).totalClicks).toBe(5);
    expect((await list(h))[0]?.totalClicks).toBe(5);
  });

  it("keeps query, fragment, and percent encoding in the normalized Location", async () => {
    const h = harness();
    const url = "https://EXAMPLE.com:443/a%20b?x=one&y=%3Ctag%3E#frag";
    const link = await createLink(h, { url });
    expect((await click(h, link.shortCode)).headers.get("location")).toBe(
      new URL(url).href,
    );
  });

  it.each(["omitted", "null"] as const)(
    "does not expire a link with %s expiry",
    async (expiry) => {
      const h = harness();
      const link = await createLink(h, {
        url: "https://example.com/",
        ...(expiry === "null" ? { expiresAt: null } : {}),
      });
      h.setNow("2040-01-01T00:00:00.000Z");
      await click(h, link.shortCode);
      expect((await stats(h, link.shortCode)).totalClicks).toBe(1);
    },
  );

  it("permits a GET one millisecond before expiry", async () => {
    const h = harness();
    const link = await createLink(h, {
      url: "https://example.com/",
      expiresAt: "2026-11-04T12:00:01Z",
    });
    h.setNow("2026-11-04T12:00:00.999Z");
    await click(h, link.shortCode);
    expect((await stats(h, link.shortCode)).totalClicks).toBe(1);
  });

  it.each(["2026-11-04T12:00:01.000Z", "2026-11-04T12:00:01.001Z"])(
    "returns 410 without counting at or after expiry: %s",
    async (now) => {
      const h = harness();
      const link = await createLink(h, {
        url: "https://example.com/",
        expiresAt: "2026-11-04T08:00:01-04:00",
      });
      await click(h, link.shortCode);
      h.setNow(now);
      for (let index = 0; index < 2; index++) {
        const response = await h.app.request(`/${link.shortCode}`);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("location")).toBeNull();
        await expectJsonError(response, 410);
      }
      const result = await stats(h, link.shortCode);
      expect(result.totalClicks).toBe(1);
      expect(result.clicksByDay.reduce((sum, day) => sum + day.clicks, 0)).toBe(
        1,
      );
      expect((await list(h))[0]?.totalClicks).toBe(1);
    },
  );

  it("returns a JSON 404 with no-store for an unknown seven-character code", async () => {
    const h = harness();
    const known = await createLink(h);
    for (let index = 0; index < 3; index++) {
      const response = await h.app.request("/M1ss1ng");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("location")).toBeNull();
      await expectJsonError(response, 404);
    }
    expect((await stats(h, known.shortCode)).totalClicks).toBe(0);
    // A later link using that exact code must not inherit the failed accesses.
    const later = harness({ generateCode: () => "M1ss1ng" });
    await expectJsonError(await later.app.request("/M1ss1ng"), 404);
    await createLink(later);
    expect((await stats(later, "M1ss1ng")).totalClicks).toBe(0);
  });

  it.each(["active", "expired", "unknown"] as const)(
    "HEAD has GET's status and headers, no body and no clicks: %s",
    async (state) => {
      const h = harness();
      const link = await createLink(h, {
        url: "https://example.com/head",
        expiresAt: "2026-11-04T12:00:01Z",
      });
      if (state === "expired") h.setNow("2026-11-04T12:00:01Z");
      const code = state === "unknown" ? "M1ss1ng" : link.shortCode;
      const expectedStatus = { active: 301, expired: 410, unknown: 404 }[state];
      const head = await h.app.request(`/${code}`, { method: "HEAD" });
      expect(head.status).toBe(expectedStatus);
      expect(head.headers.get("cache-control")).toBe("no-store");
      expect(await head.text()).toBe("");
      expect((await stats(h, link.shortCode)).totalClicks).toBe(0);
      const get = await h.app.request(`/${code}`);
      expect(get.status).toBe(head.status);
      expect(Object.fromEntries(head.headers)).toEqual(
        Object.fromEntries(get.headers),
      );
      expect((await stats(h, link.shortCode)).totalClicks).toBe(
        state === "active" ? 1 : 0,
      );
    },
  );

  it("keeps differently cased codes distinct", async () => {
    const codes = ["aBcD123", "AbCd123"];
    const h = harness({ generateCode: () => codes.shift()! });
    const first = await createLink(h, { url: "https://first.example/" });
    const second = await createLink(h, { url: "https://second.example/" });
    expect((await click(h, first.shortCode)).headers.get("location")).toBe(
      first.originalUrl,
    );
    expect((await click(h, second.shortCode)).headers.get("location")).toBe(
      second.originalUrl,
    );
    await expectJsonError(await h.app.request("/ABCD123"), 404);
    expect((await stats(h, first.shortCode)).totalClicks).toBe(1);
    expect((await stats(h, second.shortCode)).totalClicks).toBe(1);
  });

  it("still redirects with no-store when click storage fails", async () => {
    const h = harness();
    const link = await createLink(h);
    h.dropClicksTable();
    const response = await click(h, link.shortCode);
    expect(response.headers.get("location")).toBe(
      new URL(link.originalUrl).href,
    );
  });

  it("writes a non-ASCII target as a valid Location over a real Node HTTP server", async () => {
    const h = harness();
    const url = "https://münich.example/ação?q=café#seção";
    const link = await createLink(h, { url });
    const server = serve({
      fetch: h.app.fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    try {
      if (!server.listening) await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected an ephemeral TCP server address");
      }
      const response = await fetch(
        `http://127.0.0.1:${address.port}/${link.shortCode}`,
        { redirect: "manual" },
      );
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(new URL(url).href);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await response.text();
      expect((await stats(h, link.shortCode)).totalClicks).toBe(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }, 10_000);
});

describe("root route boundaries", () => {
  it.each([
    "/favicon.ico",
    "/abcdef",
    "/abcdefgh",
    "/abc-def",
    "/abc_def",
    "/abc.def",
    "/ébcdefg",
    "/abcdefg/extra",
    "/abcdefg/",
    "/api",
    "/api/shorten",
    "/api/unknown",
    "/api/abcdefg",
    "/api/shorten/abcdefg",
    "/api/urls/abcdefg",
    "/analytics",
  ])("returns the JSON 404 outside the code pattern: %s", async (path) => {
    const h = harness({ generateCode: () => "abcdefg" });
    const link = await createLink(h);
    const response = await h.app.request(path);
    expect(response.headers.get("location")).toBeNull();
    await expectJsonError(response, 404);
    expect((await stats(h, link.shortCode)).totalClicks).toBe(0);
  });

  it("does not treat the seven-letter literal 'shorten' as the API route", async () => {
    const h = harness({ generateCode: () => "shorten" });
    const link = await createLink(h);
    await click(h, link.shortCode);
    expect(await list(h)).toHaveLength(1);
    expect((await stats(h, link.shortCode)).totalClicks).toBe(1);
    expect(link.createdAt).toBe(START);
  });
});
