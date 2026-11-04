import { describe, expect, it } from "vitest";
import {
  START,
  click,
  createLink,
  expectJsonError,
  harness,
  list,
} from "./helpers";

describe("GET /api/urls", () => {
  it("returns an empty urls array before any creation", async () => {
    expect(await list(harness())).toEqual([]);
  });

  it("includes every contracted field, normalized expiry and the all-time click count", async () => {
    const h = harness();
    const first = await createLink(h, {
      url: "https://EXAMPLE.com:443/exact?x=1#frag",
      expiresAt: "2030-01-01T01:30:00+01:30",
    });
    const second = await createLink(h);
    await click(h, first.shortCode);
    await click(h, first.shortCode);
    await click(h, second.shortCode);
    expect(await list(h)).toEqual([
      { ...second, totalClicks: 1 },
      { ...first, totalClicks: 2 },
    ]);
  });

  it("orders links newest first when creation times differ", async () => {
    const h = harness();
    const first = await createLink(h);
    h.setNow("2026-11-04T12:00:00.001Z");
    const second = await createLink(h);
    h.setNow("2026-11-04T12:00:00.002Z");
    const third = await createLink(h);
    expect((await list(h)).map((row) => row.shortCode)).toEqual([
      third.shortCode,
      second.shortCode,
      first.shortCode,
    ]);
  });

  it("breaks same-millisecond ties by reverse insertion order, not code or click count", async () => {
    const codes = ["zZzZ999", "AaAa111", "MmMm555", "BbBb222"];
    const h = harness({ generateCode: () => codes.shift()! });
    const created = [];
    for (let index = 0; index < 4; index++) created.push(await createLink(h));
    await click(h, created[0]!.shortCode);
    for (const row of created) expect(row.createdAt).toBe(START);
    const expected = [...created].reverse().map((row) => row.shortCode);
    for (let index = 0; index < 3; index++) {
      expect((await list(h)).map((row) => row.shortCode)).toEqual(expected);
      expect((await list(h, "?limit=2")).map((row) => row.shortCode)).toEqual(
        expected.slice(0, 2),
      );
    }
  });

  it("defaults to the newest 100 links", async () => {
    const h = harness();
    const created = [];
    for (let index = 0; index < 105; index++) created.push(await createLink(h));
    expect((await list(h)).map((row) => row.shortCode)).toEqual(
      created
        .slice(-100)
        .reverse()
        .map((row) => row.shortCode),
    );
  });

  it.each([1, 2, 100, 500])("accepts limit=%i", async (limit) => {
    const h = harness();
    const created = [];
    for (let index = 0; index < 3; index++) created.push(await createLink(h));
    expect(
      (await list(h, `?limit=${limit}`)).map((row) => row.shortCode),
    ).toEqual(
      [...created]
        .reverse()
        .slice(0, limit)
        .map((row) => row.shortCode),
    );
  });

  it("caps a limit=500 response at the newest 500 links", async () => {
    const h = harness();
    const created = [];
    for (let index = 0; index < 501; index++) created.push(await createLink(h));
    expect((await list(h, "?limit=500")).map((row) => row.shortCode)).toEqual(
      created
        .slice(-500)
        .reverse()
        .map((row) => row.shortCode),
    );
  }, 10_000);

  it.each(["", "0", "-1", "501", "1.5", "NaN", "Infinity", "abc", "100abc"])(
    "rejects invalid limit=%j with a JSON 400",
    async (limit) => {
      await expectJsonError(
        await harness().app.request(
          `/api/urls?limit=${encodeURIComponent(limit)}`,
        ),
        400,
      );
    },
  );

  it("keeps expired links and their old clicks in the list without counting reads", async () => {
    const h = harness();
    const link = await createLink(h, {
      url: "https://example.com/expired",
      expiresAt: "2026-11-04T12:00:01Z",
    });
    await click(h, link.shortCode);
    h.setNow("2027-01-01T00:00:00Z");
    for (let index = 0; index < 2; index++) {
      expect(await list(h)).toEqual([{ ...link, totalClicks: 1 }]);
    }
  });
});
