import { expect, test } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db";

test("an unknown path returns the JSON 404", async () => {
  const app = createApp({ db: openDb(":memory:") });

  const res = await app.request("/does/not/exist");

  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "Not found" });
});

test("openDb creates the links and clicks tables", () => {
  const db = openDb(":memory:");

  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('links', 'clicks')",
    )
    .all();

  expect(tables).toHaveLength(2);
});
