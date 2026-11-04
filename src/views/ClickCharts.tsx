import type { DayClicks, ReferrerClicks } from "../types";
import { REFRESH_SECONDS } from "./Document";
import { number } from "./LinkParts";
import { safeCss } from "./theme";

const PLOT_TOP = 30;
const PLOT_HEIGHT = 200;
const AXIS_HEIGHT = 30;
const BAR_RADIUS = 4;
const MIN_BAR_HEIGHT = 4;
const DOT_SIZE = 4;
// Leaves air between bars: about 22px bars on a desktop, 6px on a phone.
const BAR_WIDTH_OF_SLOT = 0.62;
const DATE_LABEL_EVERY_DAYS = 7;
// A caption inside the plot needs about 12 days of width on a phone.
const CAPTION_MIN_DAYS = 12;
// Tooltips for the outermost days open inward, so they stay inside the card.
const TIP_EDGE_DAYS = 5;

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact" });
const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function percent(fraction: number): string {
  return `${Number((fraction * 100).toFixed(3))}%`;
}

export function clicksLabel(clicks: number): string {
  return clicks === 1 ? "1 click" : `${number.format(clicks)} clicks`;
}

export function dayLabel(date: string): string {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

export function periodHeading(days: DayClicks[]): string {
  const clicks = days.reduce((sum, day) => sum + day.clicks, 0);
  return clicks > 0
    ? `${clicksLabel(clicks)} in the last 30 days`
    : "No clicks in the last 30 days";
}

export const CHART_CSS = safeCss(`
.live {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3125rem 0.75rem 0.3125rem 0.5625rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--ink-muted);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}
.live-track { fill: none; stroke: var(--line-strong); stroke-width: 2.5; }
.live-progress {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.5;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  transform: rotate(-90deg);
  transform-origin: 8px 8px;
  animation: live-fill ${REFRESH_SECONDS}s linear forwards;
}
@keyframes live-fill { to { stroke-dashoffset: 0; } }

.chart-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  margin-bottom: 1.5rem;
}
.card .chart-head h2 { margin: 0; font-size: 1.1875rem; letter-spacing: -0.02em; }
.chart-note { margin-top: 0.25rem; color: var(--ink-muted); font-size: 0.8125rem; }
.chart { margin: 0; }
.plot { padding-left: 2rem; }
.plot-area { position: relative; }
.plot-svg { display: block; width: 100%; overflow: visible; }
.grid { stroke: var(--line); shape-rendering: crispEdges; }
.baseline { stroke: var(--line-strong); shape-rendering: crispEdges; }
.tick {
  fill: var(--ink-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
.before { fill: color-mix(in oklab, var(--ink) 3.5%, transparent); }
.caption { fill: var(--ink-muted); font-size: 0.75rem; font-weight: 500; }
.bar { fill: var(--accent); }
.bar.zero { fill: var(--dot); }
.bar.zero.pre { fill: var(--line-strong); }
.peak {
  fill: var(--ink);
  font-size: 0.8125rem;
  font-weight: 650;
  paint-order: stroke;
  stroke: var(--surface);
  stroke-width: 4px;
  stroke-linejoin: round;
  transition: opacity 0.15s;
}
.hover {
  position: absolute;
  top: ${PLOT_TOP}px;
  right: 0;
  left: 0;
  display: flex;
  height: ${PLOT_HEIGHT}px;
}
.hcol { position: relative; flex: 1 1 0; border-radius: var(--radius-sm); }
.hcol:hover { z-index: 1; background: var(--hover); }
.tip {
  position: absolute;
  bottom: calc(var(--bar) + 0.625rem);
  left: 50%;
  display: grid;
  gap: 0.0625rem;
  padding: 0.4375rem 0.6875rem;
  border-radius: var(--radius-md);
  background: var(--ink);
  box-shadow: var(--shadow-raised);
  color: color-mix(in oklab, var(--surface) 72%, var(--ink));
  font-size: 0.75rem;
  line-height: 1.3;
  white-space: nowrap;
  opacity: 0;
  transform: translate(-50%, 4px);
  transition: opacity 0.12s, transform 0.12s;
  pointer-events: none;
}
.tip strong { color: var(--surface); font-size: 0.8125rem; font-weight: 650; }
.hcol.start .tip { left: 0; transform: translate(0, 4px); }
.hcol.end .tip { right: 0; left: auto; transform: translate(0, 4px); }
.hcol:hover .tip { opacity: 1; transform: translate(-50%, 0); }
.hcol.start:hover .tip, .hcol.end:hover .tip { transform: none; }
.plot-area:has(.hcol:hover) .peak { opacity: 0; }
@media (max-width: 30rem) {
  .plot { padding-left: 1.625rem; }
  .tick { font-size: 0.6875rem; }
}

.refs { width: 100%; border-collapse: collapse; table-layout: fixed; }
.refs th {
  padding: 0 0 0.5rem;
  color: var(--ink-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
}
.refs td { padding: 0.1875rem 0; vertical-align: middle; }
.refs .rank {
  width: 2rem;
  color: var(--ink-muted);
  font: 500 0.75rem/1 var(--font-mono);
}
.refs .ref { position: relative; }
.meter {
  position: absolute;
  top: 0.1875rem;
  bottom: 0.1875rem;
  left: 0;
  min-width: 0.25rem;
  border-radius: var(--radius-sm);
  background: var(--accent-wash);
}
.ref-name {
  position: relative;
  display: block;
  padding: 0.4375rem 0.625rem;
  font-size: 0.9375rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.refs .num {
  width: 4.5rem;
  font-weight: 650;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.refs .pct {
  width: 4rem;
  padding-left: 0.625rem;
  color: var(--ink-muted);
  font-size: 0.8125rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 30rem) {
  .refs th { font-size: 0.6875rem; letter-spacing: 0.03em; }
  .refs .rank { width: 1.5rem; }
  .refs .num { width: 3.25rem; }
  .refs .pct { width: 3.5rem; }
}
.refs-note { margin-top: 1rem; color: var(--ink-muted); font-size: 0.8125rem; }
.refs-empty { color: var(--ink-muted); font-size: 0.9375rem; }
`);

export function LiveIndicator() {
  return (
    <p class="live">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle class="live-track" cx="8" cy="8" r="6" />
        <circle class="live-progress" cx="8" cy="8" r="6" pathLength="100" />
      </svg>
      Updates automatically
    </p>
  );
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

// createdDay (YYYY-MM-DD) shades the days before the link existed, so a new
// link reads as new rather than as a month of silence.
export function DailyChart({
  days,
  createdDay,
}: {
  days: DayClicks[];
  createdDay?: string;
}) {
  const labels = days.map((day) => dayLabel(day.date));
  const peak = Math.max(0, ...days.map((day) => day.clicks));
  const peakIndex = days.findLastIndex((day) => day.clicks === peak);
  const ticks = clickAxisTicks(peak);
  const axisMax = ticks.at(-1) || 1;
  const baseline = PLOT_TOP + PLOT_HEIGHT;
  const slot = 1 / days.length;
  const firstLive = createdDay
    ? days.findIndex((day) => day.date >= createdDay)
    : 0;
  const preDays = firstLive === -1 ? days.length : firstLive;
  const liveDays = days.length - preDays;
  const barHeight = (clicks: number) =>
    Number(
      Math.max(MIN_BAR_HEIGHT, (clicks / axisMax) * PLOT_HEIGHT).toFixed(2),
    );
  const peakPlacement = labelPlacement(peakIndex, days.length);
  const peakIsToday = peakIndex === days.length - 1;
  const summary =
    peak > 0
      ? `Busiest day: ${labels[peakIndex]} with ${clicksLabel(peak)}.`
      : "No clicks in this period.";

  return (
    <div class="plot">
      <div class="plot-area">
        <svg
          class="plot-svg"
          role="img"
          aria-labelledby="chart-title chart-desc"
          width="100%"
          height={baseline + AXIS_HEIGHT}
        >
          <title id="chart-title">Clicks per day, last 30 days</title>
          <desc id="chart-desc">
            {`Bar chart from ${labels[0]} to ${labels.at(-1)}. ${summary} A table with every day follows.`}
          </desc>

          {preDays > 0 && (
            <rect
              class="before"
              x="0"
              y={PLOT_TOP}
              width={percent(preDays * slot)}
              height={PLOT_HEIGHT}
              rx="8"
            />
          )}

          {ticks.map((tick) => {
            const y = Math.round(baseline - (tick / axisMax) * PLOT_HEIGHT);
            return (
              <>
                {tick > 0 && (
                  <line class="grid" x1="0" x2="100%" y1={y} y2={y} />
                )}
                <text
                  class="tick y"
                  x="-10"
                  y={y}
                  dy="0.32em"
                  text-anchor="end"
                >
                  {compactNumber.format(tick)}
                </text>
              </>
            );
          })}
          <line class="baseline" x1="0" x2="100%" y1={baseline} y2={baseline} />

          {/* The nested viewport clips the square foot of each bar at the baseline. */}
          <svg y={PLOT_TOP} width="100%" height={PLOT_HEIGHT}>
            {days.map((day, index) => {
              if (day.clicks === 0) return null;
              const height = barHeight(day.clicks);
              return (
                <rect
                  class="bar"
                  data-date={day.date}
                  x={percent((index + (1 - BAR_WIDTH_OF_SLOT) / 2) * slot)}
                  y={PLOT_HEIGHT - height}
                  width={percent(slot * BAR_WIDTH_OF_SLOT)}
                  height={height + BAR_RADIUS}
                  rx={BAR_RADIUS}
                />
              );
            })}
          </svg>

          {/* A day with no clicks is a bead on the baseline. */}
          {days.map((day, index) =>
            day.clicks > 0 ? null : (
              <rect
                class={index < preDays ? "bar zero pre" : "bar zero"}
                data-date={day.date}
                x={percent((index + 0.5) * slot)}
                y={baseline - DOT_SIZE / 2}
                width={DOT_SIZE}
                height={DOT_SIZE}
                rx={DOT_SIZE / 2}
                transform={`translate(${-DOT_SIZE / 2} 0)`}
              />
            ),
          )}

          {preDays >= CAPTION_MIN_DAYS && (
            <text
              class="caption"
              x={percent((preDays * slot) / 2)}
              y={baseline - 20}
              text-anchor="middle"
            >
              Before this link existed
            </text>
          )}
          {peak === 0 && liveDays >= CAPTION_MIN_DAYS && (
            <text
              class="caption"
              x={percent((preDays + liveDays / 2) * slot)}
              y={PLOT_TOP + PLOT_HEIGHT / 2}
              text-anchor="middle"
            >
              Waiting for the first click
            </text>
          )}

          {days.map((_, index) => {
            const fromToday = days.length - 1 - index;
            if (fromToday % DATE_LABEL_EVERY_DAYS !== 0) return null;
            const placement = labelPlacement(index, days.length);
            return (
              <text
                class="tick x"
                x={percent(placement.x)}
                y={baseline + AXIS_HEIGHT - 8}
                text-anchor={placement.anchor}
              >
                {labels[index]}
              </text>
            );
          })}

          {peak > 0 && (
            <text
              class="peak"
              x={percent(peakPlacement.x)}
              y={baseline - barHeight(peak) - 8}
              text-anchor={peakPlacement.anchor}
            >
              {peakIsToday
                ? `${number.format(peak)} today`
                : `${number.format(peak)} on ${labels[peakIndex]}`}
            </text>
          )}
        </svg>

        <div class="hover" aria-hidden="true">
          {days.map((day, index) => {
            const edge =
              index < TIP_EDGE_DAYS
                ? " start"
                : index >= days.length - TIP_EDGE_DAYS
                  ? " end"
                  : "";
            const top = day.clicks > 0 ? barHeight(day.clicks) : DOT_SIZE;
            return (
              <div class={`hcol${edge}`} style={`--bar: ${top}px`}>
                <span class="tip">
                  <strong>
                    {index < preDays
                      ? "Link not created yet"
                      : clicksLabel(day.clicks)}
                  </strong>
                  {labels[index]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Visually hidden, so screen readers always have the exact daily values. A
// disclosure would snap shut on every automatic reload.
export function DailyTable({ days }: { days: DayClicks[] }) {
  return (
    <div class="sr-only">
      <table class="daily-table">
        <caption>Clicks per day, last 30 days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Clicks</th>
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
    </div>
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

function shareOf(clicks: number, total: number): string {
  if (total <= 0) return "";
  const share = (clicks / total) * 100;
  return share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`;
}

export function Referrers({
  referrers,
  totalClicks,
}: {
  referrers: ReferrerClicks[];
  totalClicks: number;
}) {
  if (referrers.length === 0) {
    return (
      <p class="refs-empty">
        No referrers yet. They show up here after the first click.
      </p>
    );
  }

  const top = Math.max(...referrers.map((row) => row.clicks));
  const note = referrerNote(referrers);

  return (
    <>
      <table class="refs">
        <thead>
          <tr>
            <th scope="col" class="rank">
              <span class="sr-only">Rank</span>
            </th>
            <th scope="col">Referrer</th>
            <th scope="col" class="num">
              Clicks
            </th>
            <th scope="col" class="pct">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {referrers.map((row, index) => (
            <tr>
              <td class="rank">{String(index + 1).padStart(2, "0")}</td>
              <td class="ref">
                <span
                  class="meter"
                  style={{ width: percent(row.clicks / top) }}
                  aria-hidden="true"
                ></span>
                <span class="ref-name">{row.referrer}</span>
              </td>
              <td class="num">{number.format(row.clicks)}</td>
              <td class="pct">{shareOf(row.clicks, totalClicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p class="refs-note">{note}</p>}
    </>
  );
}
