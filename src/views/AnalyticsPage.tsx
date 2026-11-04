import type { Child } from "hono/jsx";
import type { DayClicks, LinkStats, ReferrerClicks } from "../types";

export interface AnalyticsPageProps {
  stats: LinkStats;
  shortUrl: string;
  analyticsUrl: string;
  expired: boolean;
}

const PLOT_TOP = 24;
const PLOT_HEIGHT = 200;
const AXIS_HEIGHT = 28;
const TICK_LENGTH = 4;
const BAR_RADIUS = 4;
const MIN_BAR_HEIGHT = 3;
const ZERO_BAR_HEIGHT = 2;
// Leaves about a 2px gap between bars on a 320px phone.
const BAR_WIDTH_OF_SLOT = 0.78;
const DATE_LABEL_EVERY_DAYS = 7;

const number = new Intl.NumberFormat("en-US");
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact" });
const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const timestampFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

// hono/jsx escapes text inside <style>, so this CSS must not contain
// ampersands, angle brackets or quotes. Font names are valid unquoted.
const STYLES = `
*, *::before, *::after { box-sizing: border-box; }
:root {
  color-scheme: light dark;
  --page: #ffffff;
  --ink: #0a0a33;
  --soft: #4a4a6a;
  --line: #d9d9e8;
  --meter: #0000ee;
  --band: #0000ee;
}
.dead { --band: #4a4a5e; --meter: #4a4a5e; }
@media (prefers-color-scheme: dark) {
  :root {
    --page: #0d0c26;
    --ink: #ecebfb;
    --soft: #b2b1d4;
    --line: #2d2c52;
    --meter: #8b9dff;
    --band: #1a12c8;
  }
  .dead { --band: #2f2f40; --meter: #9a9ab0; }
}
body {
  margin: 0;
  background: var(--page);
  color: var(--ink);
  font: 1rem/1.5 Avenir Next, Avenir, Segoe UI Variable Text, Segoe UI, Roboto,
    Noto Sans, Helvetica Neue, Arial, sans-serif;
}
p { margin: 0; }
h1 {
  margin: 0.2em 0 0.3em;
  font-size: clamp(2.5rem, 9.5vw, 5.25rem);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
h2 { margin: 0 0 1rem; font-size: 1.25rem; font-weight: 600; line-height: 1.3; }
a { color: inherit; text-underline-offset: 0.15em; }
a:hover { text-decoration-thickness: 2px; }
a:focus-visible, summary:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.wrap {
  width: 100%;
  max-width: 62rem;
  margin-inline: auto;
  padding-inline: clamp(1.25rem, 5vw, 3rem);
}
.band {
  --ink: #ffffff;
  --soft: #d6d8ff;
  --line: rgba(255, 255, 255, 0.24);
  --axis: rgba(255, 255, 255, 0.7);
  --stub: rgba(255, 255, 255, 0.45);
  --hover: rgba(255, 255, 255, 0.14);
  padding-block: clamp(1.75rem, 5vw, 3.5rem) 1.5rem;
  background: var(--band);
  color: var(--ink);
}
.subject {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 0.75rem;
  font-size: clamp(1.0625rem, 2.5vw, 1.375rem);
  font-weight: 600;
}
.url {
  min-width: 0;
  overflow-wrap: anywhere;
  -webkit-user-select: all;
  user-select: all;
}
.badge {
  padding: 0.0625rem 0.625rem;
  border-radius: 999px;
  background: var(--ink);
  color: var(--band);
  font-size: 0.875rem;
  font-weight: 700;
}
.target { overflow-wrap: anywhere; font-size: 1.0625rem; }
.lede { margin-top: 0.5rem; font-size: 1.0625rem; }

.chart { margin: clamp(2rem, 5vw, 3.5rem) 0 0; }
.chart h2 { margin: 0; }
.chart-note { margin-bottom: 1rem; color: var(--soft); font-size: 0.875rem; }
.plot { padding-left: 2.5rem; }
.plot-svg { display: block; width: 100%; overflow: visible; }
.grid { stroke: var(--line); shape-rendering: crispEdges; }
.axis { stroke: var(--axis); shape-rendering: crispEdges; }
.tick {
  fill: var(--soft);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 24rem) {
  .tick { font-size: 0.75rem; }
}
.peak {
  fill: var(--ink);
  font-size: 0.875rem;
  font-weight: 600;
  paint-order: stroke;
  stroke: var(--band);
  stroke-width: 4px;
}
.bar { fill: var(--ink); }
.bar.zero { fill: var(--stub); }
.hit { fill: transparent; }
.col:hover .hit { fill: var(--hover); }

details { margin-top: 1rem; }
summary { width: fit-content; cursor: pointer; font-size: 0.875rem; }
details table { max-width: 24rem; margin-top: 0.5rem; }

table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
th { color: var(--soft); font-size: 0.875rem; font-weight: 600; }
.num {
  width: 5.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ref-name { display: block; overflow-wrap: anywhere; }
.meter {
  display: block;
  min-width: 2px;
  height: 4px;
  margin-top: 0.375rem;
  border-radius: 0 2px 2px 0;
  background: var(--meter);
}
.note { margin-top: 1rem; color: var(--soft); font-size: 0.875rem; }

.rest {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 3rem clamp(2rem, 6vw, 5rem);
  padding-block: clamp(2.5rem, 6vw, 4rem);
}
@media (min-width: 48rem) {
  .rest { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
}
.share-url { margin-top: 0.5rem; font-weight: 600; }
.facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.25rem 1rem;
  margin: 2rem 0 0;
}
.facts dt { color: var(--soft); }
.facts dd { margin: 0; }
`;

function percent(fraction: number): string {
  return `${Number((fraction * 100).toFixed(3))}%`;
}

function clicksLabel(clicks: number): string {
  return clicks === 1 ? "1 click" : `${number.format(clicks)} clicks`;
}

function headline(totalClicks: number): string {
  if (totalClicks === 0) return "Not clicked yet";
  if (totalClicks === 1) return "Clicked once";
  return `Clicked ${number.format(totalClicks)} times`;
}

function dayLabel(date: string): string {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// At most 5 whole-number ticks, stepping by 1, 2 or 5 times a power of ten.
function clickAxisTicks(peak: number): number[] {
  if (peak === 0) return [0];
  for (let scale = 1; ; scale *= 10) {
    for (const base of [1, 2, 5]) {
      const step = base * scale;
      if (peak / step <= 4) {
        const steps = Math.ceil(peak / step);
        return Array.from({ length: steps + 1 }, (_, index) => index * step);
      }
    }
  }
}

// Keeps a label inside the plot when its day is near either edge.
function labelPlacement(index: number, total: number) {
  const center = (index + 0.5) / total;
  if (center < 0.15) return { x: index / total, anchor: "start" };
  if (center > 0.85) return { x: (index + 1) / total, anchor: "end" };
  return { x: center, anchor: "middle" };
}

function DailyChart({ days }: { days: DayClicks[] }) {
  const labels = days.map((day) => dayLabel(day.date));
  const peak = Math.max(0, ...days.map((day) => day.clicks));
  const peakIndex = days.findLastIndex((day) => day.clicks === peak);
  const ticks = clickAxisTicks(peak);
  const axisMax = ticks.at(-1) || 1;
  const baseline = PLOT_TOP + PLOT_HEIGHT;
  const slot = 1 / days.length;
  const barHeight = (clicks: number) =>
    Number(
      Math.max(MIN_BAR_HEIGHT, (clicks / axisMax) * PLOT_HEIGHT).toFixed(2),
    );
  const peakPlacement = labelPlacement(peakIndex, days.length);
  const summary =
    peak > 0
      ? `Busiest day: ${labels[peakIndex]} with ${clicksLabel(peak)}.`
      : "No clicks in this period.";

  return (
    <div class="plot">
      <svg
        class="plot-svg"
        role="img"
        aria-labelledby="chart-title chart-desc"
        width="100%"
        height={baseline + AXIS_HEIGHT}
      >
        <title id="chart-title">Clicks per day, last 30 days</title>
        <desc id="chart-desc">
          {`Bar chart from ${labels[0]} to ${labels.at(-1)}. ${summary}`}
        </desc>

        {ticks.map((tick) => {
          const y = Math.round(baseline - (tick / axisMax) * PLOT_HEIGHT);
          return (
            <>
              {tick > 0 && <line class="grid" x1="0" x2="100%" y1={y} y2={y} />}
              <text class="tick y" x="-8" y={y} dy="0.32em" text-anchor="end">
                {compactNumber.format(tick)}
              </text>
            </>
          );
        })}

        {/* The nested viewport clips the square foot of each bar at the baseline. */}
        <svg y={PLOT_TOP} width="100%" height={PLOT_HEIGHT}>
          {days.map((day, index) => {
            const height = barHeight(day.clicks);
            const x = percent((index + (1 - BAR_WIDTH_OF_SLOT) / 2) * slot);
            const width = percent(slot * BAR_WIDTH_OF_SLOT);
            return (
              <g class="col">
                <title>{`${labels[index]}: ${clicksLabel(day.clicks)}`}</title>
                <rect
                  class="hit"
                  x={percent(index * slot)}
                  width={percent(slot)}
                  height={PLOT_HEIGHT}
                />
                {day.clicks > 0 ? (
                  <rect
                    class="bar"
                    data-date={day.date}
                    x={x}
                    y={PLOT_HEIGHT - height}
                    width={width}
                    height={height + BAR_RADIUS}
                    rx={BAR_RADIUS}
                  />
                ) : (
                  <rect
                    class="bar zero"
                    data-date={day.date}
                    x={x}
                    y={PLOT_HEIGHT - ZERO_BAR_HEIGHT}
                    width={width}
                    height={ZERO_BAR_HEIGHT}
                  />
                )}
              </g>
            );
          })}
        </svg>

        <line class="axis" x1="0" x2="100%" y1={baseline} y2={baseline} />

        {days.map((_, index) => {
          const fromToday = days.length - 1 - index;
          if (fromToday % DATE_LABEL_EVERY_DAYS !== 0) return null;
          const placement = labelPlacement(index, days.length);
          const center = percent((index + 0.5) * slot);
          return (
            <>
              <line
                class="axis"
                x1={center}
                x2={center}
                y1={baseline}
                y2={baseline + TICK_LENGTH}
              />
              <text
                class="tick x"
                x={percent(placement.x)}
                y={baseline + AXIS_HEIGHT - 8}
                text-anchor={placement.anchor}
              >
                {labels[index]}
              </text>
            </>
          );
        })}

        {peak > 0 && (
          <text
            class="peak"
            x={percent(peakPlacement.x)}
            y={baseline - barHeight(peak) - 6}
            text-anchor={peakPlacement.anchor}
          >
            {`${number.format(peak)} on ${labels[peakIndex]}`}
          </text>
        )}
      </svg>
    </div>
  );
}

function DailyTable({ days }: { days: DayClicks[] }) {
  return (
    <details>
      <summary>Show daily clicks as a table</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col" class="num">
              Clicks
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr>
              <td>
                <time dateTime={day.date}>{dayLabel(day.date)}</time>
              </td>
              <td class="num">{number.format(day.clicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function referrerNote(referrers: ReferrerClicks[]): string | null {
  const names = referrers.map((row) => row.referrer);
  const notes = [
    names.includes("(direct)") &&
      "(direct) means the visitor came from no referring page, such as a typed address or an app.",
    names.includes("(unknown)") &&
      "(unknown) means the browser sent a referrer that could not be read.",
  ].filter(Boolean);
  return notes.length > 0 ? notes.join(" ") : null;
}

function Referrers({ referrers }: { referrers: ReferrerClicks[] }) {
  if (referrers.length === 0) {
    return <p>No referrers yet. They show up here after the first click.</p>;
  }

  const top = Math.max(...referrers.map((row) => row.clicks));
  const note = referrerNote(referrers);

  return (
    <>
      <table>
        <thead>
          <tr>
            <th scope="col">Referrer</th>
            <th scope="col" class="num">
              Clicks
            </th>
          </tr>
        </thead>
        <tbody>
          {referrers.map((row) => (
            <tr>
              <td class="ref">
                <span class="ref-name">{row.referrer}</span>
                <span
                  class="meter"
                  style={{ width: percent(row.clicks / top) }}
                  aria-hidden="true"
                ></span>
              </td>
              <td class="num">{number.format(row.clicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p class="note">{note}</p>}
    </>
  );
}

function Timestamp({ iso }: { iso: string }) {
  return (
    <time dateTime={iso}>{`${timestampFormat.format(new Date(iso))} UTC`}</time>
  );
}

function Document({
  title,
  dead,
  children,
}: {
  title: string;
  dead: boolean;
  children: Child;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <style>{STYLES}</style>
      </head>
      <body class={dead ? "dead" : undefined}>{children}</body>
    </html>
  );
}

export function AnalyticsPage({
  stats,
  shortUrl,
  analyticsUrl,
  expired,
}: AnalyticsPageProps) {
  const clicksInPeriod = stats.clicksByDay.reduce(
    (sum, day) => sum + day.clicks,
    0,
  );

  return (
    <Document title={`Clicks for ${stats.shortCode}`} dead={expired}>
      <main>
        <section class="band">
          <div class="wrap">
            <p class="subject">
              <span class="url">{shortUrl}</span>
              {expired && <span class="badge">Expired</span>}
            </p>
            <h1>{headline(stats.totalClicks)}</h1>
            <p class="target">
              {expired ? "Went to " : "Goes to "}
              {isWebUrl(stats.originalUrl) ? (
                <a href={stats.originalUrl} rel="noopener noreferrer">
                  {stats.originalUrl}
                </a>
              ) : (
                stats.originalUrl
              )}
            </p>
            {expired && (
              <p class="lede">
                This short link has expired, so it no longer redirects or counts
                clicks.
              </p>
            )}
            {!expired && stats.totalClicks === 0 && (
              <p class="lede">
                Share the short link above. Clicks will show up here.
              </p>
            )}

            <figure class="chart">
              <figcaption>
                <h2>
                  {clicksInPeriod > 0
                    ? `${clicksLabel(clicksInPeriod)} in the last 30 days`
                    : "No clicks in the last 30 days"}
                </h2>
                <p class="chart-note">Daily totals, UTC</p>
              </figcaption>
              <DailyChart days={stats.clicksByDay} />
              <DailyTable days={stats.clicksByDay} />
            </figure>
          </div>
        </section>

        <div class="wrap rest">
          <section>
            <h2>Top referrers, all time</h2>
            <Referrers referrers={stats.topReferrers} />
          </section>

          <section>
            <h2>Share these stats</h2>
            <p>Anyone with this link can see this page.</p>
            <p class="url share-url">{analyticsUrl}</p>
            <dl class="facts">
              <dt>Created</dt>
              <dd>
                <Timestamp iso={stats.createdAt} />
              </dd>
              <dt>{expired ? "Expired" : "Expires"}</dt>
              <dd>
                {stats.expiresAt ? (
                  <Timestamp iso={stats.expiresAt} />
                ) : (
                  "Never"
                )}
              </dd>
            </dl>
          </section>
        </div>
      </main>
    </Document>
  );
}

export function AnalyticsNotFoundPage({ code }: { code: string }) {
  return (
    <Document title="Link not found" dead={true}>
      <main>
        <section class="band">
          <div class="wrap">
            <h1>No such link</h1>
            <p class="lede">
              {`No short link uses the code ${code}. Codes are case-sensitive, so check the address.`}
            </p>
          </div>
        </section>
      </main>
    </Document>
  );
}
