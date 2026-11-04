import type { LinkStats } from "../types";
import {
  CHART_CSS,
  DailyChart,
  DailyTable,
  LiveIndicator,
  periodHeading,
  Referrers,
} from "./ClickCharts";
import { Document } from "./Document";
import { LINK_PARTS_CSS, number, ShortUrlText } from "./LinkParts";
import { BASE_CSS, safeCss } from "./theme";
import { TOP_BAR_CSS, TopBar } from "./TopBar";

export interface AnalyticsPageProps {
  stats: LinkStats;
  shortUrl: string;
  analyticsUrl: string;
  expired: boolean;
}

const timestampFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export const ANALYTICS_CSS = safeCss(`
.page { padding-block: clamp(1.25rem, 3.5vw, 2.25rem) clamp(3rem, 8vw, 5rem); }
.page-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: clamp(1.5rem, 4vw, 2.5rem);
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  color: var(--ink-muted);
  font-size: 0.875rem;
}
.crumbs a {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--ink-soft);
  font-weight: 600;
  text-decoration: none;
}
.crumbs a:hover { color: var(--accent-strong); }
.crumbs [aria-current] { color: var(--ink); font-family: var(--font-mono); font-weight: 600; }

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.75rem 3rem;
  margin-bottom: clamp(1.75rem, 4vw, 2.75rem);
}
@media (min-width: 62rem) {
  .hero { grid-template-columns: minmax(0, 1fr) auto; align-items: end; }
}
.kicker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.875rem;
  margin-bottom: 1rem;
}
.kicker .short-url {
  font-size: 0.9375rem;
  -webkit-user-select: all;
  user-select: all;
}
h1 {
  font-size: clamp(2.625rem, 1.5rem + 4.6vw, 4.75rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.045em;
}
.dest {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  max-width: 48rem;
  margin-top: 1.125rem;
}
.dest-label { flex: none; color: var(--ink-muted); }
.dest-url {
  display: -webkit-box;
  min-width: 0;
  margin: -3px;
  padding: 3px;
  overflow: hidden;
  color: var(--ink-soft);
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.dest-url a {
  text-decoration-color: color-mix(in oklab, var(--accent) 45%, transparent);
  text-decoration-thickness: 1px;
}
.dest-url a:hover { text-decoration-color: var(--accent); }
.lede { margin-top: 1rem; color: var(--ink-soft); }
.notice {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  max-width: 40rem;
  margin-top: 1.25rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 0.9375rem;
}
.notice svg { margin-top: 0.125rem; color: var(--ink-muted); }

.facts { display: flex; flex-wrap: wrap; gap: 0.75rem 2.5rem; font-size: 0.875rem; }
.facts dt {
  margin-bottom: 0.125rem;
  color: var(--ink-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
@media (min-width: 62rem) {
  .facts {
    flex-direction: column;
    padding-left: 1.75rem;
    border-left: 1px solid var(--line);
  }
}

.panel { padding: clamp(1.125rem, 3vw, 1.75rem); }
.panel h2 { margin-bottom: 1.125rem; }
.lower {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: clamp(1rem, 2.5vw, 1.5rem);
  margin-top: clamp(1rem, 2.5vw, 1.5rem);
}
@media (min-width: 56rem) {
  .lower { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
}
.share-note { margin: -0.5rem 0 1rem; color: var(--ink-muted); font-size: 0.9375rem; }
.field-label { display: block; margin: 1.25rem 0 0.375rem; }

.missing { max-width: 38rem; padding-block: clamp(3rem, 10vw, 6rem); }
.missing .eyebrow { margin-bottom: 0.75rem; font-family: var(--font-mono); }
.missing .lede { margin-top: 1rem; font-size: 1.0625rem; }
.missing .button { margin-top: 1.75rem; }
`);

const PAGE_CSS = [
  BASE_CSS,
  TOP_BAR_CSS,
  LINK_PARTS_CSS,
  CHART_CSS,
  ANALYTICS_CSS,
].join("\n");

function headline(totalClicks: number): string {
  if (totalClicks === 0) return "Not clicked yet";
  if (totalClicks === 1) return "Clicked once";
  return `Clicked ${number.format(totalClicks)} times`;
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function Timestamp({ iso }: { iso: string }) {
  return (
    <time dateTime={iso}>{`${timestampFormat.format(new Date(iso))} UTC`}</time>
  );
}

function BackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.25"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5m6-6-6 6 6 6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function AnalyticsPage({
  stats,
  shortUrl,
  analyticsUrl,
  expired,
}: AnalyticsPageProps) {
  return (
    <Document
      title={`Clicks for ${stats.shortCode}`}
      css={PAGE_CSS}
      dead={expired}
      refresh
    >
      <TopBar />
      <main class="wrap page">
        <div class="page-top">
          <nav class="crumbs" aria-label="Breadcrumb">
            <a href="/analytics">
              <BackIcon />
              All links
            </a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{stats.shortCode}</span>
          </nav>
          <LiveIndicator />
        </div>

        <header class="hero">
          <div>
            <p class="kicker">
              {expired ? (
                <span class="status is-off">
                  <span class="status-dot" aria-hidden="true"></span>
                  <span class="badge">Expired</span>
                </span>
              ) : (
                <span class="status is-live">
                  <span class="status-dot" aria-hidden="true"></span>
                  Active
                </span>
              )}
              <ShortUrlText url={shortUrl} />
            </p>
            <h1>{headline(stats.totalClicks)}</h1>
            <p class="dest">
              <span class="dest-label">{expired ? "Went to" : "Goes to"}</span>
              <span class="dest-url" title={stats.originalUrl}>
                {isWebUrl(stats.originalUrl) ? (
                  <a href={stats.originalUrl} rel="noopener noreferrer">
                    {stats.originalUrl}
                  </a>
                ) : (
                  stats.originalUrl
                )}
              </span>
            </p>
            {expired && (
              <p class="notice">
                <ClockIcon />
                This short link has expired, so it no longer redirects or counts
                clicks.
              </p>
            )}
            {!expired && stats.totalClicks === 0 && (
              <p class="lede">
                Share the short link above. Clicks will show up here.
              </p>
            )}
          </div>
          <dl class="facts">
            <div>
              <dt>Created</dt>
              <dd>
                <Timestamp iso={stats.createdAt} />
              </dd>
            </div>
            <div>
              <dt>{expired ? "Expired" : "Expires"}</dt>
              <dd>
                {stats.expiresAt ? (
                  <Timestamp iso={stats.expiresAt} />
                ) : (
                  "Never"
                )}
              </dd>
            </div>
          </dl>
        </header>

        <section class="card panel" aria-labelledby="chart-heading">
          <div class="chart-head">
            <div>
              <h2 id="chart-heading">{periodHeading(stats.clicksByDay)}</h2>
              <p class="chart-note">Daily totals, UTC</p>
            </div>
          </div>
          <figure class="chart" aria-labelledby="chart-heading">
            <DailyChart
              days={stats.clicksByDay}
              createdDay={stats.createdAt.slice(0, 10)}
            />
            <DailyTable days={stats.clicksByDay} />
          </figure>
        </section>

        <div class="lower">
          <section class="card panel" aria-labelledby="refs-heading">
            <h2 id="refs-heading">Top referrers, all time</h2>
            <Referrers
              referrers={stats.topReferrers}
              totalClicks={stats.totalClicks}
            />
          </section>

          <section class="card panel" aria-labelledby="share-heading">
            <h2 id="share-heading">Share these stats</h2>
            <p class="share-note">Anyone with this link can see this page.</p>
            <p class="field">{analyticsUrl}</p>
            <span class="eyebrow field-label">Short link</span>
            <p class="field">{shortUrl}</p>
          </section>
        </div>
      </main>
    </Document>
  );
}

export function AnalyticsNotFoundPage({ code }: { code: string }) {
  return (
    <Document title="Link not found" css={PAGE_CSS} dead={true}>
      <TopBar />
      <main class="wrap missing">
        <p class="eyebrow">404</p>
        <h1>No such link</h1>
        <p class="lede">
          {`No short link uses the code ${code}. Codes are case-sensitive, so check the address.`}
        </p>
        <a class="button secondary" href="/analytics">
          See all links
        </a>
      </main>
    </Document>
  );
}
