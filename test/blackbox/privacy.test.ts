import { describe, expect, it } from "vitest";
import { CLIENT_IP, USER_AGENT, click, createLink, harness } from "./helpers";

async function expectPrivate(response: Response, status: number) {
  expect(response.status).toBe(status);
  const body = await response.text();
  const exposed = `${JSON.stringify(Object.fromEntries(response.headers))}\n${body}`;
  for (const secret of [
    CLIENT_IP,
    USER_AGENT,
    "private-user-agent-xss-marker",
  ]) {
    expect(exposed).not.toContain(secret);
    expect(exposed).not.toContain(encodeURIComponent(secret));
  }
  if (response.headers.get("content-type")?.includes("application/json")) {
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value !== null && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          expect(key.toLowerCase().replace(/[_-]/g, "")).not.toMatch(
            /^(?:ip|clientip|useragent)$/,
          );
          visit(child);
        }
      }
    };
    visit(JSON.parse(body));
  }
}

describe("IP and user-agent never appear in any response", () => {
  it("keeps metadata private in creation, redirect, HEAD, list, stats and analytics responses", async () => {
    const h = harness({ getClientIp: () => CLIENT_IP });
    const creation = await h.post(
      { url: "https://example.com/" },
      { "User-Agent": USER_AGENT, "X-Forwarded-For": CLIENT_IP },
    );
    const { shortCode } = (await creation.clone().json()) as {
      shortCode: string;
    };
    await expectPrivate(creation, 201);
    const response = await click(h, shortCode, {
      "User-Agent": `private-user-agent-xss-marker-<script>alert(1)</script>`,
    });
    await expectPrivate(response, 301);
    await expectPrivate(
      await h.app.request(`/${shortCode}`, { method: "HEAD" }),
      301,
    );
    for (const path of [
      "/api/urls",
      `/api/stats/${shortCode}`,
      `/analytics/${shortCode}`,
    ]) {
      await expectPrivate(await h.app.request(path), 200);
    }
  });

  it("keeps metadata private in JSON 400/404/410 and HTML 404 responses", async () => {
    const h = harness();
    const link = await createLink(h, {
      url: "https://example.com/",
      expiresAt: "2026-11-04T12:00:01Z",
    });
    await click(h, link.shortCode);
    h.setNow("2026-11-04T12:00:01Z");
    const headers = { "User-Agent": USER_AGENT, "X-Forwarded-For": CLIENT_IP };
    await expectPrivate(
      await h.post({ url: "javascript:alert(1)" }, headers),
      400,
    );
    for (const [path, status] of [
      ["/api/urls?limit=0", 400],
      ["/M1ss1ng", 404],
      ["/api/stats/M1ss1ng", 404],
      ["/analytics/M1ss1ng", 404],
      ["/favicon.ico", 404],
      [`/${link.shortCode}`, 410],
      [`/api/stats/${link.shortCode}`, 200],
      [`/analytics/${link.shortCode}`, 200],
    ] as const) {
      await expectPrivate(await h.app.request(path, { headers }), status);
    }
  });

  it("does not expose request metadata in the collision-exhaustion 500 response", async () => {
    const h = harness({ generateCode: () => "Same123" });
    await createLink(h);
    await expectPrivate(
      await h.post(
        { url: "https://second.example/" },
        { "User-Agent": USER_AGENT, "X-Forwarded-For": CLIENT_IP },
      ),
      500,
    );
  });
});
