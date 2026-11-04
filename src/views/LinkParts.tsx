import { safeCss, shortUrlParts } from "./theme";

export const number = new Intl.NumberFormat("en-US");

export function plural(count: number, unit: string): string {
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

export function linkStatus(
  expiresAt: string | null,
  now: Date,
): { label: string; live: boolean } {
  if (expiresAt === null) return { label: "Active", live: true };
  const left = new Date(expiresAt).getTime() - now.getTime();
  return left > 0
    ? { label: `Expires in ${timeLeft(left)}`, live: true }
    : { label: "Expired", live: false };
}

export function StatusPill({ label, live }: { label: string; live: boolean }) {
  return (
    <span class={`status ${live ? "is-live" : "is-off"}`}>
      <span class="status-dot" aria-hidden="true"></span>
      {label}
    </span>
  );
}

export function ShortUrlText({ url }: { url: string }) {
  const { host, code } = shortUrlParts(url);
  return (
    <span class="short-url">
      <span class="short-host">{host}</span>
      <span class="short-code">{code}</span>
    </span>
  );
}

export const LINK_PARTS_CSS = safeCss(`
.short-url { font-family: var(--font-mono); overflow-wrap: anywhere; }
.short-host { color: var(--ink-muted); font-weight: 450; }
.short-code { color: var(--ink); font-weight: 650; white-space: nowrap; }

.rows { overflow: hidden; }
.rows-head {
  display: none;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--line);
  background: var(--sunken);
}
.rows-head span { text-align: left; }
.rows-head .right { text-align: right; }
.rows li + li { border-top: 1px solid var(--line); }
.row-dest {
  display: block;
  margin-top: 0.1875rem;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-clicks { text-align: right; font-variant-numeric: tabular-nums; }
.row-clicks strong {
  display: block;
  color: var(--ink);
  font-size: 1.25rem;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.row-unit { color: var(--ink-muted); font-size: 0.75rem; }
@media (min-width: 52rem) {
  .rows-head { display: grid; }
  .row-clicks strong { display: inline; font-size: 1rem; letter-spacing: 0; }
  .row-unit {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
.empty {
  display: grid;
  justify-items: center;
  gap: 0.375rem;
  padding: clamp(2rem, 6vw, 3rem) 1.5rem;
  text-align: center;
}
.empty-icon {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-bottom: 0.5rem;
  border-radius: 50%;
  background: var(--accent-wash);
  color: var(--accent-strong);
}
.empty h3 { font-size: 1rem; }
.empty p { max-width: 26rem; color: var(--ink-muted); font-size: 0.9375rem; }
.empty .button { margin-top: 0.875rem; }
`);
