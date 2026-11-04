// Shared look for every server-rendered page: warm paper, ink, and one ember
// accent. Pages put BASE_CSS first in their single <style>, then the CSS of
// the components they use, then their own rules.
//
// hono/jsx escapes text inside <style>, so CSS must not contain ampersands,
// angle brackets or quotes. That rules out the child combinator and quoted
// strings, including content values. Font names are valid unquoted. Wrap
// every stylesheet in safeCss, which throws at startup if one slips in.

export const fonts = {
  sans: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
  mono: "ui-monospace, SF Mono, SFMono-Regular, Menlo, Cascadia Mono, Consolas, Liberation Mono, monospace",
} as const;

// Each key becomes a custom property: inkMuted is var(--ink-muted).
// accent paints chart marks, accentFill is for buttons, so its text passes 4.5:1.
const light = {
  page: "#f6f5f1",
  surface: "#ffffff",
  sunken: "#f8f7f3",
  line: "#e9e6de",
  lineStrong: "#d7d3c8",
  ink: "#1b1a17",
  inkSoft: "#4a4741",
  inkMuted: "#6c6860",
  accent: "#e0532a",
  accentStrong: "#b53c15",
  accentWash: "#fbe6dd",
  accentFill: "#cc4518",
  accentFillHover: "#b53c15",
  accentFillInk: "#ffffff",
  good: "#1d9a52",
  danger: "#c0362c",
  dangerWash: "#fbe9e7",
  dot: "#cdc8bc",
  hover: "rgb(27 26 23 / 0.05)",
  shadow:
    "0 1px 2px rgb(27 26 23 / 0.04), 0 8px 24px -12px rgb(27 26 23 / 0.14)",
  shadowRaised:
    "0 1px 2px rgb(27 26 23 / 0.05), 0 24px 48px -20px rgb(27 26 23 / 0.22)",
};

const dark: typeof light = {
  page: "#11100e",
  surface: "#1a1917",
  sunken: "#151412",
  line: "#2b2a26",
  lineStrong: "#3b3934",
  ink: "#f3f1ea",
  inkSoft: "#cbc7bd",
  inkMuted: "#9b968c",
  accent: "#ef6334",
  accentStrong: "#ff9a70",
  accentWash: "#3a2119",
  accentFill: "#ef6334",
  accentFillHover: "#ff7a4d",
  accentFillInk: "#1b0d07",
  good: "#3ccf7e",
  danger: "#ff8f7e",
  dangerWash: "#3a1c18",
  dot: "#4a4842",
  hover: "rgb(243 241 234 / 0.06)",
  shadow: "0 1px 2px rgb(0 0 0 / 0.3)",
  shadowRaised: "0 1px 2px rgb(0 0 0 / 0.4), 0 24px 48px -20px rgb(0 0 0 / 0.6)",
};

// The accent drops to a neutral for expired links and other dead states.
const muted = {
  light: { accent: "#8a857b", accentWash: "#eeece6" },
  dark: { accent: "#77736b", accentWash: "#2a2925" },
} as const;

export const colors = { light, dark, muted } as const;

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "16px",
  xl: "20px",
  pill: "999px",
} as const;

export const tokens = { fonts, colors, radius } as const;

const UNSAFE_IN_STYLE = /[&<>"']/;

// Splits a short URL for display as a muted host and a bold code, without
// the scheme: http://localhost:3000/aZ3kP9x becomes localhost:3000/ and aZ3kP9x.
export function shortUrlParts(url: string): { host: string; code: string } {
  const bare = url.replace(/^https?:\/\//, "");
  const slash = bare.lastIndexOf("/");
  return { host: bare.slice(0, slash + 1), code: bare.slice(slash + 1) };
}

export function safeCss(css: string): string {
  const match = css.match(UNSAFE_IN_STYLE);
  if (match) {
    throw new Error(`CSS contains ${match[0]}, which hono/jsx would escape`);
  }
  return css;
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function customProperties(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => `--${kebab(name)}: ${value};`)
    .join("\n  ");
}

export const BASE_CSS = safeCss(`
*, *::before, *::after { box-sizing: border-box; }
:root {
  color-scheme: light dark;
  --font-sans: ${fonts.sans};
  --font-mono: ${fonts.mono};
  ${customProperties(Object.fromEntries(Object.entries(radius).map(([name, value]) => [`radius-${name}`, value])))}
  ${customProperties(light)}
}
.dead { ${customProperties(muted.light)} }
@media (prefers-color-scheme: dark) {
  :root { ${customProperties(dark)} }
  .dead { ${customProperties(muted.dark)} }
}

html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--page);
  color: var(--ink);
  font: 400 1rem/1.5 var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
h1, h2, h3, p, figure, dl, dd, ul, ol { margin: 0; }
ul, ol { padding: 0; list-style: none; }
h1, h2, h3 { font-weight: 650; line-height: 1.2; text-wrap: balance; }
h2 { font-size: 1.0625rem; letter-spacing: -0.01em; }
a {
  color: inherit;
  text-decoration-line: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 1.5px;
  text-underline-offset: 0.22em;
}
a:hover { color: var(--accent-strong); }
:focus-visible {
  outline: 2px solid var(--accent-strong);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}
::selection { background: var(--accent-wash); color: var(--ink); }
svg { flex: none; }
[hidden] { display: none !important; }

.wrap {
  width: 100%;
  max-width: 70rem;
  margin-inline: auto;
  padding-inline: clamp(1rem, 4vw, 2.5rem);
}
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}
.eyebrow {
  color: var(--ink-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.3;
  text-transform: uppercase;
}
.mono { font-family: var(--font-mono); }
.muted { color: var(--ink-muted); }
.num { font-variant-numeric: tabular-nums; }
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 2.75rem;
  padding: 0 1.125rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--accent-fill);
  color: var(--accent-fill-ink);
  font: 650 0.9375rem/1 var(--font-sans);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, transform 0.15s;
}
.button:hover { background: var(--accent-fill-hover); color: var(--accent-fill-ink); }
.button:active { transform: translateY(1px); }
.button.secondary {
  border-color: var(--line-strong);
  background: var(--surface);
  color: var(--ink);
}
.button.secondary:hover { border-color: var(--ink-muted); background: var(--sunken); }

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.4375rem;
  padding: 0.1875rem 0.6875rem 0.1875rem 0.5625rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}
.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--ink-muted);
}
.status.is-live .status-dot { background: var(--good); }
.status.is-pulsing .status-dot { animation: live-pulse 2.4s ease-out infinite; }
@keyframes live-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--good) 55%, transparent); }
  70%, 100% { box-shadow: 0 0 0 0.375rem transparent; }
}

.field {
  display: block;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--sunken);
  color: var(--ink);
  font: 500 0.875rem/1.45 var(--font-mono);
  overflow-wrap: anywhere;
  -webkit-user-select: all;
  user-select: all;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
`);
