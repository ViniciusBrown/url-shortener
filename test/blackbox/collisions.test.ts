import { describe, expect, it } from "vitest";
import {
  click,
  createLink,
  expectJsonError,
  harness,
  list,
  stats,
} from "./helpers";

describe("code collisions through POST /api/shorten", () => {
  it("retries a collision without overwriting the old destination or its clicks", async () => {
    const codes = ["Same123", "Same123", "Fresh12"];
    let calls = 0;
    const h = harness({ generateCode: () => codes[calls++]! });
    const first = await createLink(h, { url: "https://first.example/" });
    await click(h, first.shortCode);
    const second = await createLink(h, { url: "https://second.example/" });
    expect(second.shortCode).toBe("Fresh12");
    expect(calls).toBe(3);
    expect((await click(h, first.shortCode)).headers.get("location")).toBe(
      "https://first.example/",
    );
    expect((await stats(h, first.shortCode)).totalClicks).toBe(2);
    expect((await stats(h, second.shortCode)).totalClicks).toBe(0);
    expect(await list(h)).toHaveLength(2);
  });

  it("can succeed on the fifth and final attempt", async () => {
    let calls = 0;
    const h = harness({
      generateCode: () => (++calls === 6 ? "Final12" : "Same123"),
    });
    await createLink(h);
    const second = await createLink(h);
    expect(second.shortCode).toBe("Final12");
    expect(calls).toBe(6);
    expect(await list(h)).toHaveLength(2);
  });

  it("returns a JSON 500 after exactly five colliding attempts and keeps only the old link", async () => {
    let calls = 0;
    const h = harness({
      generateCode: () => {
        calls++;
        return "Same123";
      },
    });
    const first = await createLink(h, { url: "https://first.example/" });
    await expectJsonError(
      await h.post({ url: "https://must-not-overwrite.example/" }),
      500,
    );
    expect(calls).toBe(6);
    expect(await list(h)).toEqual([{ ...first, totalClicks: 0 }]);
    expect((await click(h, first.shortCode)).headers.get("location")).toBe(
      first.originalUrl,
    );
  });
});
