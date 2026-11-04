import { describe, expect, it } from "vitest";
import {
  BASE_URL,
  START,
  createLink,
  expectJsonError,
  harness,
  list,
} from "./helpers";

describe("POST /api/shorten: the public write contract", () => {
  it.each([
    "http://example.com/path?query=yes#fragment",
    "https://EXAMPLE.com:443/a%20path?x=%3Cscript%3E#frag",
    "https://example.com",
    "HTTPS://example.com/uppercase-protocol",
    "https://example.com/encoded%09%0A%20whitespace",
    "http://localhost:8080/path",
    "http://127.0.0.1/path",
    "http://[::1]:8080/path",
    "https://münich.example/ação?q=café#seção",
  ])(
    "creates an HTTP(S) link and preserves the submitted URL: %s",
    async (url) => {
      const h = harness({ generateCode: () => "aZ3kP9x" });
      const created = await createLink(h, { url });
      expect(created).toEqual({
        shortCode: "aZ3kP9x",
        shortUrl: `${BASE_URL}/aZ3kP9x`,
        analyticsUrl: `${BASE_URL}/analytics/aZ3kP9x`,
        originalUrl: url,
        createdAt: START,
        expiresAt: null,
      });
    },
  );

  it("accepts explicit null expiry as no expiry", async () => {
    const h = harness();
    const created = await createLink(h, {
      url: "https://example.com",
      expiresAt: null,
    });
    expect(created.expiresAt).toBeNull();
  });

  it.each([
    ["2030-01-01T00:00:00Z", "2030-01-01T00:00:00.000Z"],
    ["2030-01-01t00:00:00z", "2030-01-01T00:00:00.000Z"],
    ["2030-01-01T01:30:00+01:30", "2030-01-01T00:00:00.000Z"],
    ["2030-01-01T00:00:00-04:00", "2030-01-01T04:00:00.000Z"],
    ["2028-02-29T12:34:56.789Z", "2028-02-29T12:34:56.789Z"],
    ["2030-01-01T00:00:00.1Z", "2030-01-01T00:00:00.100Z"],
    ["2026-11-04T12:00:00.001Z", "2026-11-04T12:00:00.001Z"],
  ])(
    "normalizes valid future RFC 3339 expiry %s to UTC",
    async (input, utc) => {
      const h = harness();
      const created = await createLink(h, {
        url: "https://example.com",
        expiresAt: input,
      });
      expect(created.expiresAt).toBe(utc);
      expect((await list(h))[0]?.expiresAt).toBe(utc);
    },
  );

  it.each([null, [], "https://example.com", 17, true].map((body) => [body]))(
    "rejects a JSON body that is not an object: %j",
    async (body) => {
      await expectJsonError(await harness().post(body), 400);
    },
  );

  it.each([
    {},
    { url: null },
    { url: 42 },
    { url: false },
    { url: [] },
    { url: { href: "https://example.com" } },
  ])("rejects a missing or non-string url: %j", async (body) => {
    await expectJsonError(await harness().post(body), 400);
  });

  it.each(["", "{", '{"url":', '{"url":"https://example.com",}'])(
    "rejects malformed JSON: %j",
    async (body) => {
      const response = await harness().app.request("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      await expectJsonError(response, 400);
    },
  );

  it.each([
    "",
    "not-a-url",
    "/relative/path",
    "//example.com/path",
    "https://",
    "https://[not-an-ip]/",
    "https://example.com:99999/",
    "https://%zz/",
    "ftp://example.com/file",
    "file:///etc/passwd",
    "mailto:person@example.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ws://example.com/socket",
    "wss://example.com/socket",
  ])("rejects an unparseable or non-HTTP(S) URL: %j", async (url) => {
    const h = harness();
    await expectJsonError(await h.post({ url }), 400);
    expect(await list(h)).toEqual([]);
  });

  it.each([
    " https://example.com/",
    "https://example.com/ ",
    "https://example.com/a b",
    "https://exa\tmple.com/",
    "https://example.com/a\nb",
    "https://example.com/a\rb",
    "https://example.com/\u0000",
    "https://example.com/\u0001",
    "https://example.com/\u001f",
    "https://example.com/\u007f",
    "https://example.com/\u0085",
    "https://example.com/\u00a0",
    "https://example.com/\u2003",
    "https://example.com/\u2028",
  ])("rejects raw whitespace or control characters: %j", async (url) => {
    await expectJsonError(await harness().post({ url }), 400);
  });

  it("accepts a URL of exactly 2048 characters", async () => {
    const prefix = "https://example.com/";
    const url = prefix + "a".repeat(2048 - prefix.length);
    expect((await createLink(harness(), { url })).originalUrl).toBe(url);
  });

  it("rejects a URL of 2049 characters", async () => {
    const prefix = "https://example.com/";
    const url = prefix + "a".repeat(2049 - prefix.length);
    await expectJsonError(await harness().post({ url }), 400);
  });

  it.each(
    [
      "",
      "1",
      "tomorrow",
      "2030-01-01",
      "2030-01-01T00:00:00",
      "2030-01-01T00:00:00+0100",
      "2030-01-01T00:00:00+24:00",
      "2030-01-01T00:00:00+00:60",
      "2030-01-01T00:00:00Zjunk",
      " 2030-01-01T00:00:00Z",
      "2030-01-01T00:00:00Z ",
      "2030-02-29T00:00:00Z",
      "2030-02-31T00:00:00Z",
      "2030-04-31T00:00:00Z",
      "2030-00-01T00:00:00Z",
      "2030-13-01T00:00:00Z",
      "2030-01-00T00:00:00Z",
      "2030-01-32T00:00:00Z",
      "2030-01-01T24:00:00Z",
      "2030-01-01T00:60:00Z",
      "2030-01-01T00:00:61Z",
      1893456000000,
      false,
      [],
      {},
    ].map((expiresAt) => [expiresAt]),
  )(
    "rejects an invalid expiry without persisting a link: %j",
    async (expiresAt) => {
      const h = harness();
      await expectJsonError(
        await h.post({ url: "https://example.com", expiresAt }),
        400,
      );
      expect(await list(h)).toEqual([]);
    },
  );

  it.each(["2026-11-04T11:59:59.999Z", START, "2026-11-04T08:00:00-04:00"])(
    "rejects expiry at or before now: %s",
    async (expiresAt) => {
      await expectJsonError(
        await harness().post({ url: "https://example.com", expiresAt }),
        400,
      );
    },
  );

  it("builds public links from baseUrl despite a forged Host header", async () => {
    const h = harness({
      baseUrl: "https://configured.example:8443",
      generateCode: () => "hOsT123",
    });
    const response = await h.post(
      { url: "https://destination.example" },
      {
        Host: "attacker.example",
        "X-Forwarded-Host": "attacker.example",
        "X-Forwarded-Proto": "http",
      },
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      shortUrl: "https://configured.example:8443/hOsT123",
      analyticsUrl: "https://configured.example:8443/analytics/hOsT123",
    });
    expect((await list(h))[0]).toMatchObject({
      shortUrl: "https://configured.example:8443/hOsT123",
      analyticsUrl: "https://configured.example:8443/analytics/hOsT123",
    });
  });

  it("uses seven case-sensitive alphanumeric characters with the default generator", async () => {
    const h = harness({ useDefaultCodeGenerator: true });
    const codes = new Set<string>();
    for (let index = 0; index < 12; index++) {
      const created = await createLink(h);
      expect(created.shortCode).toMatch(/^[0-9a-zA-Z]{7}$/);
      codes.add(created.shortCode);
    }
    expect(codes.size).toBe(12);
    expect(await list(h)).toHaveLength(12);
  });
});
