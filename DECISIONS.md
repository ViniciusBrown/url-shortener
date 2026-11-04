# Decisions

This file is the contract for the parallel build streams and the black-box tests.

## Stack

| Choice               | Why                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| TypeScript + Hono    | One small process owns every route, including the root `/:code`. `app.request()` tests HTTP in-process.   |
| `node:sqlite`        | Built into Node, so there is no native build to fail on install. Vitest 4.1.12 imports it (checked live). |
| SQLite file          | Survives restarts, has real `GROUP BY` for stats, needs no setup. Trade-off: one node, one writer.        |
| Vitest               | Fast, runs TypeScript directly, one command.                                                              |
| `hono/jsx`, SVG      | Auto-escaping server rendering. The analytics page needs no client JavaScript and no chart library.       |
| `tsx`, `typescript`, | Dev tooling. `@hono/node-server` is the only other runtime dependency.                                    |
| `prettier`           |                                                                                                           |

Next.js was rejected: nothing is deployed, and a root catch-all is simpler in a plain server. Requires Node 24 or later; tested on 25.9.

## Application interface

```ts
createApp({
  db,           // required: DatabaseSync, from openDb(path)
  now,          // optional: () => Date
  generateCode, // optional: () => string
  baseUrl,      // optional: used to build shortUrl and analyticsUrl
  getClientIp,  // optional: (c: Context) => string | null
}): Hono
```

- `openDb(":memory:")` applies the schema, so tests use a real database with no mocks.
- Config: `PORT` (3000), `BASE_URL` (`http://localhost:$PORT`), `DATABASE_PATH` (`./data/urlshortener.db`), `TRUST_PROXY` (off).

## API contract

Every `/api/*` and redirect error body is `{ "error": "<message>" }`. HTML pages return HTML errors. All timestamps are UTC ISO 8601 strings.

### `POST /api/shorten`

Request: `{ "url": string, "expiresAt"?: string | null }`

`201`:

```json
{
  "shortCode": "aZ3kP9x",
  "shortUrl": "http://localhost:3000/aZ3kP9x",
  "analyticsUrl": "http://localhost:3000/analytics/aZ3kP9x",
  "originalUrl": "https://example.com/path",
  "createdAt": "2026-11-04T12:00:00.000Z",
  "expiresAt": null
}
```

`analyticsUrl` is an addition to the brief, so the creator gets a link to share.

`400` when:

- The body is not a JSON object, or `url` is missing or not a string.
- `url` does not parse with `new URL()`, or its protocol is not `http:` or `https:`.
- `url` contains whitespace or control characters, or is longer than 2048 characters. `new URL()` silently strips tabs and newlines, so this needs its own check.
- `expiresAt` is not a real RFC 3339 timestamp with a timezone, such as `2030-01-01T00:00:00Z`. `new Date()` alone is too lenient: it accepts `"1"` and rolls `02-31` over to March.
- `expiresAt` is not after the current time.

`originalUrl` is returned exactly as submitted. `expiresAt` is returned normalized to UTC.

### `GET /:code`

The route only matches `[0-9a-zA-Z]{7}`, and codes are case-sensitive. Any other path returns the JSON 404.

| Case            | Response                                     | Click recorded |
| --------------- | -------------------------------------------- | -------------- |
| Exists, active  | `301`, `Location`, `Cache-Control: no-store` | Yes            |
| Unknown         | `404`, `Cache-Control: no-store`             | No             |
| `now >= expiry` | `410`, `Cache-Control: no-store`             | No             |
| `HEAD` request  | Same status and headers as `GET`             | No             |

- `Location` is `new URL(originalUrl).href`. A raw non-ASCII URL would make the Node HTTP header write throw.
- A failed click write is logged and the redirect still happens.

### `GET /api/urls`

`?limit=` is optional: 1 to 500, default 100. Anything else returns `400`.

`200`: `{ "urls": [{ shortCode, shortUrl, analyticsUrl, originalUrl, createdAt, expiresAt, totalClicks }] }`

Ordered newest first, tie-broken by `id DESC`, because links created in the same millisecond would otherwise swap order.

### `GET /api/stats/:code`

`200`:

```json
{
  "shortCode": "aZ3kP9x",
  "originalUrl": "https://example.com/path",
  "createdAt": "2026-11-04T12:00:00.000Z",
  "expiresAt": null,
  "totalClicks": 5,
  "clicksByDay": [{ "date": "2026-11-04", "clicks": 5 }],
  "topReferrers": [{ "referrer": "news.ycombinator.com", "clicks": 3 }]
}
```

`404` for an unknown code. Sends `Cache-Control: no-store`.

- `clicksByDay` always has 30 entries: today (UTC) and the previous 29 days, oldest first, with zero days filled in.
- `totalClicks` and `topReferrers` are all-time.
- `topReferrers` groups by hostname and returns the top 10, by clicks descending and then name ascending.
- No IP or user-agent is ever returned by any endpoint or page.

### `GET /analytics/:code`

HTML page with total clicks, an SVG bar chart of 30 days, a top-referrers table, the original URL and an expired badge. Handles the zero-click state.

- Unknown code: an HTML `404`.
- No client JavaScript.
- Headers: `Cache-Control: no-store` and a Content-Security-Policy with `default-src 'none'`, allowing only inline styles.

## Dashboard

Added after the first demo, to use this as a product rather than through `curl`. The brief only requires the API and analytics page.

### `GET /`

HTML page with `Cache-Control: no-store`.

- Top: a form to shorten a link, with `url` and an expiry select.
- Below: totals, and the 100 latest links with short link, original URL, clicks, created date, status and a link to analytics. Short links are clickable, and each click counts.
- `?created=<code>` shows a result card with the short link, a copy button and the analytics link, only when the code exists. Any other value is ignored and never echoed.
- Lists the same data as the public `GET /api/urls`, so it exposes nothing new.
- CSP: `default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`. The only script is the copy button, served from `GET /assets/copy.js`, and the page works without it.

### `POST /links`

Form-encoded: `url`, and `expiresIn` as `never`, `1m`, `1h`, `24h`, `7d` or `30d`. A preset avoids `datetime-local`, which has no timezone. `1m` also makes the `410` easy to demo.

- Applies the same validation as `POST /api/shorten`, through shared code.
- Success: `303` to `/?created=<code>`.
- Failure: `400` with the dashboard, an inline error, and the submitted URL kept in the field, escaped.

### Analytics page

Gets a top bar with a link back to the dashboard and a compact shorten form, so one page leads to the other. Stays free of client JavaScript, and adds `form-action 'self'` to its CSP.

## Schema

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL REFERENCES links(id),
  clicked_at TEXT NOT NULL,
  referrer TEXT,
  referrer_host TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX idx_clicks_link_time ON clicks(link_id, clicked_at);
```

- `referrer` keeps the raw header. `referrer_host` is computed on write: `(direct)` when empty, `(unknown)` when malformed, otherwise the hostname.
- WAL mode and foreign keys are on.

## Ambiguities resolved

- **301 versus click tracking.** Browsers cache 301s, which would lose repeat clicks and hide the 410 after expiry. Keep the 301 the brief asks for and add `Cache-Control: no-store`.
- **What counts as a click.** Only `GET` requests that redirect. `404`, `410` and `HEAD` do not count, since `HEAD` comes from monitors and link checkers.
- **Past `expiresAt`.** Rejected with `400`, because a link that is dead on creation is a client bug. Demoing the `410` needs a short future expiry.
- **Analytics access.** Public to anyone with the code, with no auth, as the brief asks for easy sharing. That is why no IP or user-agent is exposed.
- **Raw IP storage.** Stored because the brief requires it. In production this is personal data under LGPD and needs a retention policy or hashing.
- **`shortUrl` host.** Built from `BASE_URL`, not the `Host` header, which the client controls.
- **Client IP.** Uses the socket address. `X-Forwarded-For` is only read when `TRUST_PROXY` is set, using the rightmost entry, because clients can forge the left side.

## Code generation

`crypto.randomInt` over 62 characters, 7 characters long, about 3.5 trillion codes. Insert with `ON CONFLICT(code) DO NOTHING`, and retry with a new code when no row was written, up to 5 attempts, then `500`. There is no check-then-insert race.

## Risks to test

| Risk                                      | How it gets tested                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Browser caches the 301                    | Header test, then 5 real browser navigations with a no-`no-store` control   |
| Stored XSS through referrer or user-agent | Props test with a script payload, then a real browser check                 |
| IP leaks through the API                  | Assert that no response contains the client IP                              |
| Route collisions                          | `/favicon.ico`, 6- and 8-character paths and `/api/*` do not reach `/:code` |
| Code collision                            | Inject a generator that repeats a code                                      |
| Expiry and 30-day boundaries              | Injected clock                                                              |
| Same-millisecond ordering                 | Fixed clock, create several links                                           |
| Non-ASCII target URL                      | Redirect over a real HTTP server, since `app.request()` skips header checks |
| Click write failure                       | Drop the `clicks` table in a test database, expect a `301`                  |

## File ownership

The foundation is sequential. After it, each stream edits only its own files, in its own worktree.

| Stream          | Owns                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| Foundation      | `package.json`, config files, `src/app.ts`, `src/db.ts`, `src/types.ts`, `src/server.ts`  |
| Write path      | `src/routes/links.ts`, `src/code.ts`, `src/validation.ts`, `test/write-path.test.ts`      |
| Read path       | `src/routes/stats.ts`, `src/stats.ts`, `test/read-path.test.ts`                           |
| Analytics page  | `src/routes/analytics.tsx`, `src/views/AnalyticsPage.tsx`, `test/analytics-page.test.tsx` |
| Black-box tests | `test/blackbox/*`, written from the brief and this file only                              |
| README          | `README.md`                                                                               |

The foundation commits a stub for each stream's route file and for `getStats` in `src/stats.ts`, so the analytics stream can code against its signature.

## Out of scope

Auth, rate limiting, bot and link-preview filtering, custom aliases, redirect-loop detection, and deployment.
