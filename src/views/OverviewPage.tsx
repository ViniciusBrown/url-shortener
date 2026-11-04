import type { ListedLink } from "../stats";
import type { OverviewStats } from "../types";
import {
  CHART_CSS,
  DailyChart,
  DailyTable,
  LiveIndicator,
  percent,
  periodHeading,
  Referrers,
} from "./ClickCharts";
import { Document } from "./Document";
import {
  LINK_PARTS_CSS,
  linkStatus,
  number,
  plural,
  ShortUrlText,
  StatusPill,
} from "./LinkParts";
import { BASE_CSS, safeCss } from "./theme";
import { TOP_BAR_CSS, TopBar } from "./TopBar";

export interface OverviewPageProps {
  overview: OverviewStats;
  links: ListedLink[];
  now: Date;
}

const OVERVIEW_CSS = safeCss(`
.page { padding-block: clamp(1.25rem, 3.5vw, 2.25rem) clamp(3rem, 8vw, 5rem); }
.page-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
}
h1 {
  font-size: clamp(2.5rem, 1.4rem + 4.4vw, 4.5rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.045em;
}
.lede {
  max-width: 36rem;
  margin: 1rem 0 clamp(1.75rem, 4vw, 2.5rem);
  color: var(--ink-soft);
  font-size: 1.0625rem;
}
.panel { padding: clamp(1.125rem, 3vw, 1.75rem); }
.panel h2 { margin-bottom: 1.125rem; }
.stack { display: grid; gap: clamp(1rem, 2.5vw, 1.5rem); }

.list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  padding: clamp(1.125rem, 3vw, 1.5rem) clamp(1.125rem, 3vw, 1.5rem) 0.875rem;
}
.list-head p { color: var(--ink-muted); font-size: 0.875rem; }
.orows .rows-head, .orow {
  grid-template-columns: minmax(0, 1fr) auto 1rem;
  column-gap: 1rem;
}
.orows .rows-head { padding-inline: 1.5rem; }
.orow {
  display: grid;
  align-items: center;
  row-gap: 0.5rem;
  padding: 1rem clamp(1.125rem, 3vw, 1.5rem);
  color: inherit;
  text-decoration: none;
  transition: background-color 0.15s;
}
.orow:hover { background: var(--hover); color: inherit; }
.orow:focus-visible { outline-offset: -3px; border-radius: 0; }
.orow-main { grid-column: 1; grid-row: 1; min-width: 0; }
.orow .short-url { font-size: 0.9375rem; }
.orow:hover .short-code { color: var(--accent-strong); }
.orow-status { grid-column: 1; grid-row: 2; justify-self: start; }
.orow-share { display: none; }
.orow .row-clicks { grid-column: 2; grid-row: 1 / span 2; }
.orow-go {
  grid-column: 3;
  grid-row: 1 / span 2;
  color: var(--ink-muted);
  transition: transform 0.15s, color 0.15s;
}
.orow:hover .orow-go { color: var(--accent-strong); transform: translateX(3px); }
@media (min-width: 52rem) {
  .orows .rows-head, .orow {
    grid-template-columns: minmax(0, 1fr) 10rem 5rem 10.5rem 1rem;
    column-gap: 1.5rem;
  }
  .orow-main, .orow-status, .orow .row-clicks, .orow-go { grid-row: 1; }
  .orow-status { grid-column: 4; }
  .orow .row-clicks { grid-column: 3; }
  .orow-go { grid-column: 5; }
  .orow-share {
    display: block;
    grid-column: 2;
    height: 0.375rem;
    border-radius: var(--radius-pill);
    background: var(--sunken);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .orow-share span {
    display: block;
    height: 100%;
    min-width: 0.375rem;
    border-radius: inherit;
    background: var(--accent);
  }
  .orow-share.none span { display: none; }
}
.lower {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: clamp(1rem, 2.5vw, 1.5rem);
}
`);

const PAGE_CSS = [
  BASE_CSS,
  TOP_BAR_CSS,
  LINK_PARTS_CSS,
  CHART_CSS,
  OVERVIEW_CSS,
].join("\n");

function ArrowIcon() {
  return (
    <svg
      class="orow-go"
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
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  );
}

function LinkRows({
  links,
  totalClicks,
  now,
}: {
  links: ListedLink[];
  totalClicks: number;
  now: Date;
}) {
  const top = Math.max(1, ...links.map((link) => link.totalClicks));
  return (
    <div class="orows">
      <div class="rows-head eyebrow" aria-hidden="true">
        <span>Link</span>
        <span>Share of clicks</span>
        <span class="right">Clicks</span>
        <span>Status</span>
      </div>
      <ul class="rows">
        {links.map((link) => {
          const status = linkStatus(link.expiresAt, now);
          return (
            <li>
              <a class="orow" href={`/analytics/${link.shortCode}`}>
                <span class="orow-main">
                  <ShortUrlText url={link.shortUrl} />
                  <span class="row-dest">{link.originalUrl}</span>
                </span>
                <span
                  class={`orow-share${link.totalClicks === 0 ? " none" : ""}`}
                  title={
                    totalClicks > 0
                      ? `${Math.round((link.totalClicks / totalClicks) * 100)}% of all clicks`
                      : undefined
                  }
                >
                  <span
                    style={{ width: percent(link.totalClicks / top) }}
                  ></span>
                </span>
                <span class="row-clicks">
                  <strong>{number.format(link.totalClicks)}</strong>
                  <span class="row-unit">
                    {link.totalClicks === 1 ? " click" : " clicks"}
                  </span>
                </span>
                <span class="orow-status">
                  <StatusPill {...status} />
                </span>
                <ArrowIcon />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OverviewPage({ overview, links, now }: OverviewPageProps) {
  return (
    <Document title="Analytics for all links" css={PAGE_CSS} refresh>
      <TopBar current="analytics" />
      <main class="wrap page">
        <div class="page-top">
          <p class="eyebrow">All links</p>
          <LiveIndicator />
        </div>
        <h1>
          {`${plural(overview.totalClicks, "click")} across ${plural(overview.totalLinks, "link")}`}
        </h1>
        <p class="lede">
          {links.length > 0
            ? "Open any link to see its own clicks, referrers and share page."
            : "Shorten a link and its clicks show up here as they happen."}
        </p>

        <div class="stack">
          <section class="card" aria-labelledby="links-heading">
            <div class="list-head">
              <h2 id="links-heading">Every link</h2>
              {overview.totalLinks > links.length && (
                <p>{`Showing the latest ${number.format(links.length)}`}</p>
              )}
            </div>
            {links.length > 0 ? (
              <LinkRows
                links={links}
                totalClicks={overview.totalClicks}
                now={now}
              />
            ) : (
              <div class="empty">
                <span class="empty-icon">
                  <ChartIcon />
                </span>
                <h3>No links yet</h3>
                <p>Every link you shorten gets a row here with its clicks.</p>
                <a class="button" href="/">
                  Shorten a link
                </a>
              </div>
            )}
          </section>

          <section class="card panel" aria-labelledby="chart-heading">
            <div class="chart-head">
              <div>
                <h2 id="chart-heading">
                  {periodHeading(overview.clicksByDay)}
                </h2>
                <p class="chart-note">All links, daily totals, UTC</p>
              </div>
            </div>
            <figure class="chart" aria-labelledby="chart-heading">
              <DailyChart days={overview.clicksByDay} />
              <DailyTable days={overview.clicksByDay} />
            </figure>
          </section>

          <section class="card panel" aria-labelledby="refs-heading">
            <h2 id="refs-heading">Top referrers, all links</h2>
            <Referrers
              referrers={overview.topReferrers}
              totalClicks={overview.totalClicks}
            />
          </section>
        </div>
      </main>
    </Document>
  );
}
