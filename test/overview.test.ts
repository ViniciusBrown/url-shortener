import { beforeEach, expect, test } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db";

const NOW = new Date("2026-11-04T12:00:00.000Z");
let app: ReturnType<typeof createApp>;

async function createLink(url: string): Promise<string> {
  const res = await app.request("/api/shorten", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  return ((await res.json()) as { shortCode: string }).shortCode;
}

async function click(code: string, referer?: string): Promise<void> {
  await app.request(`/${code}`, { headers: referer ? { referer } : {} });
}

beforeEach(() => {
  app = createApp({ db: openDb(":memory:"), now: () => NOW });
});

test("GET /analytics totals every link and links to each link's own page", async () => {
  const first = await createLink("https://example.com/first");
  const second = await createLink("https://example.com/second");
  await click(first, "https://news.ycombinator.com/item");
  await click(first, "https://news.ycombinator.com/other");
  await click(second);

  const res = await app.request("/analytics");
  const html = await res.text();

  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(html).toContain("3 clicks across 2 links");
  expect(html).toMatch(
    /<time dateTime="2026-11-04">[^<]*<\/time><\/td><td class="num">3<\/td>/,
  );
  expect(html).toMatch(
    />news\.ycombinator\.com<\/span><\/td><td class="num">2<\/td>/,
  );
  expect(html).toContain(`href="/analytics/${first}"`);
  expect(html).toContain(`href="/analytics/${second}"`);
  expect(html).toContain('http-equiv="refresh"');
});

test("GET /analytics renders with no links yet", async () => {
  const res = await app.request("/analytics");

  expect(res.status).toBe(200);
  expect(await res.text()).toContain("0 clicks across 0 links");
});

test("a stored script payload renders escaped", async () => {
  await createLink('https://example.com/"><script>alert(1)</script>');

  const html = await (await app.request("/analytics")).text();

  expect(html).not.toContain("<script>alert(1)");
  expect(html).toContain("&lt;script&gt;alert(1)");
});
