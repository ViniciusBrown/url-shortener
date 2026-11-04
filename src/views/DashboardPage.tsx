import type { LinkTotals, ListedLink } from "../stats";
import { Document } from "./Document";
import {
  LINK_PARTS_CSS,
  linkStatus,
  number,
  plural,
  ShortUrlText,
  StatusPill,
} from "./LinkParts";
import {
  SHORTEN_FORM_CSS,
  ShortenForm,
  type ShortenFormProps,
} from "./ShortenForm";
import { BASE_CSS, safeCss } from "./theme";
import { TOP_BAR_CSS, TopBar } from "./TopBar";

export interface DashboardPageProps {
  links: ListedLink[];
  totals: LinkTotals;
  now: Date;
  created?: ListedLink | null;
  form?: Pick<ShortenFormProps, "url" | "expiresIn" | "error">;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const DASHBOARD_CSS = safeCss(`
.hero {
  padding: clamp(2.75rem, 9vw, 5.5rem) 0 clamp(2.25rem, 6vw, 3.5rem);
  background: radial-gradient(60rem 26rem at 50% -6rem,
    color-mix(in oklab, var(--accent) 14%, transparent), transparent 72%);
}
.hero-inner { max-width: 46rem; }
.hero h1 {
  font-size: clamp(2.5rem, 1.5rem + 4vw, 3.875rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.045em;
  text-align: center;
}
.hero-lede {
  max-width: 30rem;
  margin: 1rem auto clamp(1.75rem, 5vw, 2.5rem);
  color: var(--ink-soft);
  font-size: clamp(1rem, 0.95rem + 0.3vw, 1.125rem);
  text-align: center;
  text-wrap: balance;
}

.result {
  margin-top: 1.5rem;
  padding: clamp(1.25rem, 3.5vw, 1.75rem);
  border: 1px solid color-mix(in oklab, var(--accent) 45%, var(--line));
  border-radius: var(--radius-xl);
  background: linear-gradient(
    color-mix(in oklab, var(--accent) 8%, var(--surface)),
    var(--surface) 75%
  );
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 8%, transparent),
    var(--shadow-raised);
  animation: result-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes result-in {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
}
.result-head { display: flex; align-items: center; gap: 0.625rem; }
.result-check {
  display: grid;
  place-items: center;
  width: 1.625rem;
  height: 1.625rem;
  border-radius: 50%;
  background: var(--accent-fill);
  color: var(--accent-fill-ink);
}
.result-head h2 { font-size: 0.9375rem; color: var(--ink-soft); }
.result-url {
  margin-top: 0.875rem;
  font-size: clamp(1.375rem, 0.9rem + 2.6vw, 2.125rem);
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.result-url a { text-decoration: none; }
.result-url a:hover .short-code {
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 2px;
}
.result-actions { display: flex; flex-wrap: wrap; gap: 0.625rem; margin-top: 1.25rem; }
.result-actions .button { min-width: 7rem; }
.result-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
  color: var(--ink-muted);
  font-size: 0.875rem;
}
.result-dest {
  flex: 1 1 14rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.links { padding-bottom: clamp(3rem, 8vw, 5rem); }
.links-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  margin-bottom: 0.875rem;
}
.links-head h2 { font-size: 1.25rem; letter-spacing: -0.02em; }
.links-totals { color: var(--ink-muted); font-size: 0.875rem; }
.links-totals a { font-weight: 600; }

.drows .rows-head, .drow {
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 1rem;
}
.drow {
  display: grid;
  align-items: center;
  row-gap: 0.75rem;
  padding: 1rem clamp(1rem, 3vw, 1.25rem);
}
.drow-main { grid-column: 1; grid-row: 1; min-width: 0; }
.drow .short-url { font-size: 0.9375rem; }
.drow-main a { text-decoration: none; }
.drow-main a:hover .short-code {
  text-decoration: underline;
  text-decoration-color: var(--accent);
}
.drow .row-clicks { grid-column: 2; grid-row: 1; }
.drow-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 0.875rem;
  grid-column: 1;
  grid-row: 2;
  color: var(--ink-muted);
  font-size: 0.8125rem;
}
.drow-stats {
  grid-column: 2;
  grid-row: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  justify-self: end;
  height: 2.125rem;
  padding: 0 0.75rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.drow-stats:hover { border-color: var(--ink-muted); color: var(--ink); }
.drow.is-expired .short-code { color: var(--ink-muted); }
@media (max-width: 30rem) {
  .drow-stats { width: 2.125rem; padding: 0; justify-content: center; }
  .drow-stats-label { display: none; }
}
@media (min-width: 52rem) {
  .drows .rows-head, .drow {
    grid-template-columns: minmax(0, 1fr) 5rem 8rem 10.5rem 7.5rem;
    column-gap: 1.5rem;
  }
  .drows .rows-head { padding-inline: 1.25rem; }
  .drow { padding-inline: 1.25rem; }
  .drow-main, .drow .row-clicks, .drow-stats { grid-row: 1; }
  .drow-meta { display: contents; }
  .drow-meta time { grid-column: 3; grid-row: 1; font-size: 0.875rem; }
  .drow-meta .status { grid-column: 4; grid-row: 1; justify-self: start; }
  .drow-stats { grid-column: 5; }
  .created-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
}
`);

const PAGE_CSS = [
  BASE_CSS,
  TOP_BAR_CSS,
  LINK_PARTS_CSS,
  SHORTEN_FORM_CSS,
  DASHBOARD_CSS,
].join("\n");

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function ChartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.25"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}

function ResultCard({ link, now }: { link: ListedLink; now: Date }) {
  return (
    <section class="result" aria-labelledby="result-title">
      <div class="result-head">
        <span class="result-check">
          <CheckIcon />
        </span>
        <h2 id="result-title">Your short link is ready</h2>
      </div>
      <p class="result-url">
        <a href={link.shortUrl} target="_blank" rel="noreferrer">
          <ShortUrlText url={link.shortUrl} />
        </a>
      </p>
      <p class="result-actions">
        {/* Hidden until copy.js loads, because it does nothing without it. */}
        <button
          class="button"
          type="button"
          data-copy={link.shortUrl}
          aria-live="polite"
          hidden
        >
          Copy
        </button>
        <a class="button secondary" href={link.analyticsUrl}>
          <ChartIcon />
          View analytics
        </a>
      </p>
      <div class="result-foot">
        <p class="result-dest" title={link.originalUrl}>
          Goes to {link.originalUrl}
        </p>
        <StatusPill {...linkStatus(link.expiresAt, now)} />
      </div>
    </section>
  );
}

function LinkRows({ links, now }: { links: ListedLink[]; now: Date }) {
  return (
    <div class="card drows">
      <div class="rows-head eyebrow" aria-hidden="true">
        <span>Link</span>
        <span class="right">Clicks</span>
        <span>Created</span>
        <span>Status</span>
      </div>
      <ul class="rows">
        {links.map((link) => {
          const status = linkStatus(link.expiresAt, now);
          return (
            <li class={status.live ? "drow" : "drow is-expired"}>
              <div class="drow-main">
                <a href={link.shortUrl} target="_blank" rel="noreferrer">
                  <ShortUrlText url={link.shortUrl} />
                </a>
                <span class="row-dest" title={link.originalUrl}>
                  {link.originalUrl}
                </span>
              </div>
              <p class="row-clicks">
                <strong>{number.format(link.totalClicks)}</strong>
                <span class="row-unit">
                  {link.totalClicks === 1 ? " click" : " clicks"}
                </span>
              </p>
              <div class="drow-meta">
                <StatusPill {...status} />
                <time dateTime={link.createdAt}>
                  <span class="created-label">Created </span>
                  {dateFormat.format(new Date(link.createdAt))}
                </time>
              </div>
              <a
                class="drow-stats"
                href={link.analyticsUrl}
                aria-label={`View analytics for ${link.shortCode}`}
              >
                <ChartIcon size={14} />
                <span class="drow-stats-label">Analytics</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
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
    <Document
      title="URL shortener"
      css={PAGE_CSS}
      head={created && <script src="/assets/copy.js" defer></script>}
    >
      <TopBar current="shorten" />
      <main>
        <section class="hero" aria-labelledby="hero-title">
          <div class="wrap hero-inner">
            <h1 id="hero-title">Shorten a link</h1>
            <p class="hero-lede">
              Paste a long URL. Get a short one that counts every click, with a
              stats page you can share.
            </p>
            <ShortenForm {...form} autofocus={!created} />
            {created && <ResultCard link={created} now={now} />}
          </div>
        </section>

        <section class="wrap links" aria-labelledby="links-title">
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
            <LinkRows links={links} now={now} />
          ) : (
            <div class="card empty">
              <span class="empty-icon">
                <LinkIcon />
              </span>
              <h3>No links yet</h3>
              <p>Shorten one above and it shows up here with its clicks.</p>
            </div>
          )}
        </section>
      </main>
    </Document>
  );
}
