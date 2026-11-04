# URL shortener

A small HTTP URL shortener with optional expiry, persistent click tracking, and shareable analytics.

## Setup and run

Requires **Node 24 or later** (tested on **25.9.0**) and npm; the walkthrough also uses curl and a POSIX shell.

```sh
npm install
PORT=3104 DATABASE_PATH="$(mktemp -d)/links.db" npm run dev
```

This starts the watch-mode server on port 3104 with a disposable database. SQLite and its tables are created automatically. For persistent data, use a stable `DATABASE_PATH` instead. In another terminal:

```sh
npm test
```

## Try it

Create a link, capture its generated code, follow it, and read its stats:

```sh
link=$(curl -fsS http://localhost:3104/api/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}')
printf '%s\n' "$link"
code=$(printf '%s' "$link" | node -pe 'JSON.parse(require("node:fs").readFileSync(0, "utf8")).shortCode')

curl -iL "http://localhost:3104/$code"
curl -fsS "http://localhost:3104/api/stats/$code"
printf '\nOpen in your browser: http://localhost:3104/analytics/%s\n' "$code"
```

The create response is `201`, with this shape (code and timestamp vary):

```json
{
  "shortCode": "pQ8wrWB",
  "shortUrl": "http://localhost:3104/pQ8wrWB",
  "analyticsUrl": "http://localhost:3104/analytics/pQ8wrWB",
  "originalUrl": "https://example.com",
  "createdAt": "2026-11-04T13:45:47.125Z",
  "expiresAt": null
}
```

The redirect returns `301` with `Location: https://example.com/` and `Cache-Control: no-store`. After one follow, stats contain `totalClicks: 1`, 30 `{date, clicks}` entries in `clicksByDay` (UTC, zero-filled), and `topReferrers: [{"referrer":"(direct)","clicks":1}]`. Totals and the top 10 referrer hostnames are all-time. Open the printed analytics URL to see the HTML chart and referrer table.

## Endpoints and configuration

| Method     | Path                  | Result                                                                      |
| ---------- | --------------------- | --------------------------------------------------------------------------- |
| POST       | `/api/shorten`        | JSON `{url, expiresAt?}` → `201` link metadata; invalid input → `400`       |
| GET / HEAD | `/:code`              | Active → `301`; unknown → `404`; expired → `410`; HEAD never records clicks |
| GET        | `/api/urls?limit=100` | `{urls: [...]}` with metadata and `totalClicks`, newest first; limit 1–500  |
| GET        | `/api/stats/:code`    | Metadata, `totalClicks`, `clicksByDay`, `topReferrers`; unknown → `404`     |
| GET        | `/analytics/:code`    | Public HTML analytics; unknown → `404`                                      |

Codes are seven case-sensitive alphanumeric characters. JSON errors use `{"error":"message"}`.

| Variable        | Default                  | Purpose                                                                                                                           |
| --------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`          | `3000`                   | Listening port; the walkthrough overrides it to 3104                                                                              |
| `BASE_URL`      | `http://localhost:$PORT` | Origin used in generated links, rather than the client-controlled Host header                                                     |
| `DATABASE_PATH` | `./data/urlshortener.db` | SQLite file path                                                                                                                  |
| `TRUST_PROXY`   | off                      | Only literal `true` enables the rightmost X-Forwarded-For entry; otherwise use the socket IP. Enable only behind a trusted proxy. |

## Why this stack

- **TypeScript + Hono:** one small server handles JSON, HTML, and the root redirect route without a full application framework. `@hono/node-server` provides the Node adapter; `tsx` runs TypeScript during development.
- **SQLite via `node:sqlite`:** real disk persistence, constraints, and SQL aggregation without a database service or native addon installation. WAL supports concurrent readers, but writes serialize and synchronous queries block the Node event loop. This fits a small single-node app; higher write volume, multiple hosts, and high availability would need a different persistence plan. Backups and retention still need operational work.
- **Hono JSX + SVG:** escaped server-rendered analytics with no client JavaScript or chart dependency. **Vitest** tests HTTP behavior against real SQLite, including in-memory databases.

## Decisions worth knowing

- **301 + no-store:** keeps the required permanent redirect while preventing cached redirects from bypassing repeat click tracking or hiding expiry.
- **Clicks:** active GET redirects count, including bots and previews. HEAD, 404, and 410 do not. A failed click write is logged but does not prevent the redirect.
- **Expiry:** optional `expiresAt` must be a real RFC 3339 timestamp with a timezone, strictly in the future; past values return `400`. Omit it or use `null` for no expiry. Stored timestamps are UTC.
- **Privacy:** analytics are public to anyone with the code; APIs and pages expose neither IP addresses nor user-agent values. Raw IPs, user-agent, and referrer headers are stored for click tracking. Raw IPs are personal data under LGPD; production use needs a retention policy and privacy review, including whether to hash or minimize them. Those controls are not implemented here.

## Out of scope

Authentication, rate limiting, bot/link-preview filtering, custom aliases, a creation form or home page, redirect-loop detection, and deployment.

## How this was built

The project was built live with AI agents. A sequential foundation came first, followed by parallel streams in separate git worktrees. One agent wrote black-box tests from the contract without reading the implementation. Fresh-context adversarial reviewers and a real browser check followed.
