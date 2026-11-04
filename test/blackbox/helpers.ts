import { afterEach, expect } from "vitest";
import { createApp } from "../../src/app";
import { openDb } from "../../src/db";
import type { AppOptions, LinkStats } from "../../src/types";

export const START = "2026-11-04T12:00:00.000Z";
export const BASE_URL = "https://short.example";
export const CLIENT_IP = "198.51.100.73";
export const USER_AGENT = "blackbox-private-user-agent-9821";

export interface CreatedLink {
  shortCode: string;
  shortUrl: string;
  analyticsUrl: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface ListedLink extends CreatedLink {
  totalClicks: number;
}

const databases: ReturnType<typeof openDb>[] = [];

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

type HarnessOptions = Pick<AppOptions, "baseUrl" | "getClientIp"> & {
  generateCode?: () => string;
  useDefaultCodeGenerator?: boolean;
};

export function harness(options: HarnessOptions = {}) {
  const db = openDb(":memory:");
  databases.push(db);
  let time = START;
  let sequence = 0;
  const dependencies: AppOptions = {
    db,
    now: () => new Date(time),
    baseUrl: options.baseUrl ?? BASE_URL,
    getClientIp: options.getClientIp ?? (() => CLIENT_IP),
  };
  if (!options.useDefaultCodeGenerator) {
    dependencies.generateCode =
      options.generateCode ?? (() => `T${String(++sequence).padStart(6, "0")}`);
  }
  const app = createApp(dependencies);

  return {
    app,
    // The only allowed direct database operation is the deliberate fault test.
    dropClicksTable: () => db.exec("DROP TABLE clicks"),
    setNow: (value: string) => {
      time = value;
    },
    post: (body: unknown, headers: Record<string, string> = {}) =>
      app.request("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
  };
}

export type Harness = ReturnType<typeof harness>;

export async function createLink(
  h: Harness,
  body: { url: string; expiresAt?: string | null } = {
    url: "https://destination.example/path",
  },
): Promise<CreatedLink> {
  const response = await h.post(body);
  expect(response.status, "HTTP setup: creating a link must return 201").toBe(
    201,
  );
  expect(response.headers.get("content-type")).toContain("application/json");
  return (await response.json()) as CreatedLink;
}

export async function stats(h: Harness, code: string): Promise<LinkStats> {
  const response = await h.app.request(`/api/stats/${code}`);
  expect(response.status, "HTTP stats must return 200 for a created link").toBe(
    200,
  );
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  return (await response.json()) as LinkStats;
}

export async function list(h: Harness, query = ""): Promise<ListedLink[]> {
  const response = await h.app.request(`/api/urls${query}`);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  const body = (await response.json()) as { urls: ListedLink[] };
  expect(Object.keys(body)).toEqual(["urls"]);
  expect(Array.isArray(body.urls)).toBe(true);
  return body.urls;
}

export async function click(
  h: Harness,
  code: string,
  headers: Record<string, string> = {},
) {
  const response = await h.app.request(`/${code}`, {
    headers: { "User-Agent": USER_AGENT, ...headers },
    redirect: "manual",
  });
  expect(response.status, "HTTP setup: a click must actually redirect").toBe(
    301,
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  return response;
}

export async function expectJsonError(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/json");
  const body: unknown = await response.json();
  expect(body).toEqual({ error: expect.any(String) });
  expect((body as { error: string }).error.length).toBeGreaterThan(0);
}

export function utcDaysEndingOn(iso: string) {
  const today = new Date(iso.slice(0, 10) + "T00:00:00.000Z");
  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - 29 + index);
    return day.toISOString().slice(0, 10);
  });
}
