import { expect, test } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const RESULT_CARD = 'class="result"';

function setup() {
  let sequence = 0;
  return createApp({
    db: openDb(":memory:"),
    now: () => NOW,
    generateCode: () => `code${String(++sequence).padStart(3, "0")}`,
    baseUrl: "https://sho.rt",
  });
}

function submit(
  app: ReturnType<typeof setup>,
  fields: { url: string; expiresIn: string },
) {
  return app.request("/links", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

test("submitting the form redirects to a result card for the new link", async () => {
  const app = setup();

  const res = await submit(app, {
    url: "https://example.com/page",
    expiresIn: "never",
  });

  expect(res.status).toBe(303);
  expect(res.headers.get("location")).toBe("/?created=code001");

  const page = await (await app.request("/?created=code001")).text();
  expect(page).toContain(RESULT_CARD);
  expect(page).toContain('href="https://sho.rt/code001"');
  expect(page).toContain('data-copy="https://sho.rt/code001"');
  expect(page).toContain('href="https://sho.rt/analytics/code001"');
  expect(page).toContain("https://example.com/page");
});

test("an invalid URL returns 400 with the error and the value escaped", async () => {
  const res = await submit(setup(), {
    url: `example.com/"><script>alert(1)</script>`,
    expiresIn: "never",
  });
  const page = await res.text();

  expect(res.status).toBe(400);
  expect(page).toContain("URL must start with http:// or https://");
  expect(page).toContain(
    'value="example.com/&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"',
  );
  expect(page).not.toContain("<script>alert(1)");
});

test.each([
  ["never", null],
  ["1m", "2026-11-04T12:01:00.000Z"],
  ["1h", "2026-11-04T13:00:00.000Z"],
  ["24h", "2026-11-05T12:00:00.000Z"],
  ["7d", "2026-11-11T12:00:00.000Z"],
  ["30d", "2026-12-04T12:00:00.000Z"],
])("the %s preset sets the expiry to %s", async (expiresIn, expiresAt) => {
  const app = setup();

  await submit(app, { url: "https://example.com", expiresIn });

  const stats = await (await app.request("/api/stats/code001")).json();
  expect(stats.expiresAt).toBe(expiresAt);
});

test("a stored script payload renders escaped", async () => {
  const app = setup();
  await app.request("/api/shorten", {
    method: "POST",
    body: JSON.stringify({
      url: "https://example.com/<script>alert(1)</script>",
    }),
  });

  const page = await (await app.request("/?created=code001")).text();

  expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(page).not.toContain("<script>alert(1)");
});

test("an unknown created value is ignored and never echoed", async () => {
  const value = encodeURIComponent("<b>no-such-code</b>");

  const res = await setup().request(`/?created=${value}`);
  const page = await res.text();

  expect(res.status).toBe(200);
  expect(page).not.toContain(RESULT_CARD);
  expect(page).not.toContain("no-such-code");
});
