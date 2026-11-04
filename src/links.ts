import type { AppDeps } from "./types";
import { validateShortenInput } from "./validation";

export interface CreatedLink {
  shortCode: string;
  shortUrl: string;
  analyticsUrl: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface CreateLinkFailure {
  status: 400 | 500;
  error: string;
}

export interface ExpiryPreset {
  value: string;
  label: string;
  ms: number | null;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const EXPIRY_PRESETS: ExpiryPreset[] = [
  { value: "never", label: "Never", ms: null },
  { value: "1m", label: "In 1 minute", ms: MINUTE_MS },
  { value: "1h", label: "In 1 hour", ms: HOUR_MS },
  { value: "24h", label: "In 24 hours", ms: 24 * HOUR_MS },
  { value: "7d", label: "In 7 days", ms: 7 * DAY_MS },
  { value: "30d", label: "In 30 days", ms: 30 * DAY_MS },
];

export function createLink(
  deps: Pick<AppDeps, "db" | "now" | "generateCode" | "baseUrl">,
  body: unknown,
): CreatedLink | CreateLinkFailure {
  const now = deps.now();
  const input = validateShortenInput(body, now);
  if (typeof input === "string") {
    return { status: 400, error: input };
  }
  const createdAt = now.toISOString();
  const insert = deps.db.prepare(
    `INSERT INTO links (code, original_url, created_at, expires_at)
     VALUES (?, ?, ?, ?) ON CONFLICT(code) DO NOTHING`,
  );
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = deps.generateCode();
    const result = insert.run(code, input.url, createdAt, input.expiresAt);
    if (result.changes === 0) continue;

    return {
      shortCode: code,
      shortUrl: `${deps.baseUrl}/${code}`,
      analyticsUrl: `${deps.baseUrl}/analytics/${code}`,
      originalUrl: input.url,
      createdAt,
      expiresAt: input.expiresAt,
    };
  }
  return { status: 500, error: "Unable to generate a unique short code" };
}
