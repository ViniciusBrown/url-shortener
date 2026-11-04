import type { LinkTotals, ListedLink } from "../stats";
import { ShortenForm, type ShortenFormProps } from "./ShortenForm";

export interface DashboardPageProps {
  links: ListedLink[];
  totals: LinkTotals;
  now: Date;
  created?: ListedLink | null;
  form?: Pick<ShortenFormProps, "url" | "expiresIn" | "error">;
}

const number = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

// Neutral placeholder styling, replaced as one block when the theme lands.
// hono/jsx escapes text inside <style>, so this CSS must not contain
// ampersands, angle brackets or quotes.
const STYLES = `
*, *::before, *::after { box-sizing: border-box; }
:root {
  color-scheme: light dark;
  --soft: color-mix(in srgb, CanvasText 65%, Canvas);
  --line: color-mix(in srgb, CanvasText 20%, Canvas);
  --error: light-dark(#b00020, #ff8a80);
}
body {
  margin: 0;
  background: Canvas;
  color: CanvasText;
  font: 1rem/1.5 system-ui, sans-serif;
}
h1 { margin: 0 0 1.25rem; font-size: 2rem; line-height: 1.2; }
h2 { margin: 0; font-size: 1.25rem; line-height: 1.3; }
p { margin: 0; }
a { color: inherit; text-underline-offset: 0.15em; }
:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
button {
  height: 2.75rem;
  padding: 0 1.25rem;
  border: 1px solid CanvasText;
  border-radius: 0.375rem;
  background: CanvasText;
  color: Canvas;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
  width: 100%;
  max-width: 66rem;
  margin-inline: auto;
  padding: 2rem clamp(1rem, 4vw, 2rem) 4rem;
}

.shorten { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem; }
.shorten label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
}
.shorten input, .shorten select {
  width: 100%;
  height: 2.75rem;
  padding: 0 0.75rem;
  border: 1px solid var(--soft);
  border-radius: 0.375rem;
  background: Field;
  color: FieldText;
  font: inherit;
}
.shorten input[aria-invalid] { border-color: var(--error); }
.shorten-error { grid-column: 1 / -1; color: var(--error); font-weight: 600; }
@media (min-width: 40rem) {
  .shorten {
    grid-template-columns: minmax(0, 1fr) 10rem auto;
    align-items: end;
  }
}

.result {
  display: grid;
  gap: 0.75rem;
  padding: 1.5rem;
  border: 1px solid var(--soft);
  border-radius: 0.5rem;
}
.result-url {
  font-size: clamp(1.5rem, 6vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.result-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }
.result-note { color: var(--soft); }

.links-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 1rem; }
.links-totals, .links-empty { color: var(--soft); }
.links-empty { margin-top: 1rem; }
.truncate {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
table { width: 100%; margin-top: 1rem; border-collapse: collapse; table-layout: fixed; }
th, td {
  padding: 0.625rem 0.75rem 0.625rem 0;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
th { color: var(--soft); font-size: 0.875rem; font-weight: 600; }
.col-short { width: 13rem; overflow-wrap: anywhere; font-weight: 600; }
.col-clicks { width: 4.5rem; text-align: right; font-variant-numeric: tabular-nums; }
.col-created { width: 7.5rem; padding-left: 1rem; }
.col-status { width: 9.5rem; }
.col-analytics { width: 5rem; padding-right: 0; }
@media (max-width: 47.99rem) {
  table, tbody, tr, td { display: block; }
  thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  tr { padding-block: 0.75rem; border-bottom: 1px solid var(--line); }
  td, .col-short, .col-clicks, .col-created, .col-status, .col-analytics {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    width: auto;
    padding: 0.125rem 0;
    border: 0;
    text-align: left;
  }
  td::before { content: attr(data-label); color: var(--soft); font-weight: 400; }
}
`;

function plural(count: number, unit: string): string {
  return `${number.format(count)} ${unit}${count === 1 ? "" : "s"}`;
}

// Rounds up, so a new 24-hour link reads as 24 hours rather than 23.
function timeLeft(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return plural(hours, "hour");
  return plural(Math.ceil(hours / 24), "day");
}

function statusLabel(expiresAt: string | null, now: Date): string {
  if (expiresAt === null) return "Active";
  const left = new Date(expiresAt).getTime() - now.getTime();
  return left > 0 ? `Expires in ${timeLeft(left)}` : "Expired";
}

function hostAndPath(shortUrl: string): string {
  return shortUrl.replace(/^https?:\/\//, "");
}

function ShortLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function ResultCard({ link, now }: { link: ListedLink; now: Date }) {
  return (
    <section class="result" aria-labelledby="result-title">
      <h2 id="result-title">Your short link is ready</h2>
      <p class="result-url">
        <ShortLink href={link.shortUrl}>{link.shortUrl}</ShortLink>
      </p>
      <p class="result-actions">
        {/* Hidden until copy.js loads, because it does nothing without it. */}
        <button
          type="button"
          data-copy={link.shortUrl}
          aria-live="polite"
          hidden
        >
          Copy
        </button>
        <a href={link.analyticsUrl}>View analytics</a>
      </p>
      <p class="result-note truncate" title={link.originalUrl}>
        Goes to {link.originalUrl}
      </p>
      <p class="result-note">{statusLabel(link.expiresAt, now)}</p>
    </section>
  );
}

function LinksTable({ links, now }: { links: ListedLink[]; now: Date }) {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col" class="col-short">
            Short link
          </th>
          <th scope="col">Goes to</th>
          <th scope="col" class="col-clicks">
            Clicks
          </th>
          <th scope="col" class="col-created">
            Created
          </th>
          <th scope="col" class="col-status">
            Status
          </th>
          <th scope="col" class="col-analytics">
            Analytics
          </th>
        </tr>
      </thead>
      <tbody>
        {links.map((link) => (
          <tr>
            <td class="col-short" data-label="Short link">
              <ShortLink href={link.shortUrl}>
                {hostAndPath(link.shortUrl)}
              </ShortLink>
            </td>
            <td data-label="Goes to">
              <span class="truncate" title={link.originalUrl}>
                {link.originalUrl}
              </span>
            </td>
            <td class="col-clicks" data-label="Clicks">
              {number.format(link.totalClicks)}
            </td>
            <td class="col-created" data-label="Created">
              <time dateTime={link.createdAt}>
                {dateFormat.format(new Date(link.createdAt))}
              </time>
            </td>
            <td class="col-status" data-label="Status">
              {statusLabel(link.expiresAt, now)}
            </td>
            <td class="col-analytics" data-label="Analytics">
              <a
                href={link.analyticsUrl}
                aria-label={`View analytics for ${link.shortCode}`}
              >
                View
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DashboardPage({
  links,
  totals,
  now,
  created,
  form,
}: DashboardPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>URL shortener</title>
        <style>{STYLES}</style>
        {created && <script src="/assets/copy.js" defer></script>}
      </head>
      <body>
        <main class="page">
          <section>
            <h1>Shorten a link</h1>
            <ShortenForm {...form} autofocus={!created} />
          </section>

          {created && <ResultCard link={created} now={now} />}

          <section aria-labelledby="links-title">
            <div class="links-head">
              <h2 id="links-title">Your links</h2>
              {totals.links > 0 && (
                <p class="links-totals">
                  {`${plural(totals.links, "link")}, ${plural(totals.clicks, "click")}`}
                  {totals.links > links.length &&
                    `. Showing the latest ${number.format(links.length)}.`}
                </p>
              )}
            </div>
            {links.length > 0 ? (
              <LinksTable links={links} now={now} />
            ) : (
              <p class="links-empty">
                No links yet. Shorten one above and it shows up here with its
                clicks.
              </p>
            )}
          </section>
        </main>
      </body>
    </html>
  );
}
