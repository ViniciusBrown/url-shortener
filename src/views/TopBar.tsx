import { safeCss } from "./theme";

export const TOP_BAR_CSS = safeCss(`
.topbar {
  border-bottom: 1px solid var(--line);
  background: color-mix(in oklab, var(--surface) 70%, var(--page));
}
.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 3.75rem;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--ink);
  font-size: 0.9375rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  text-decoration: none;
  white-space: nowrap;
}
.brand:hover { color: var(--ink); }
.brand-mark { color: var(--accent); }
.topbar-nav { display: flex; align-items: center; gap: 0.25rem 0.75rem; }
.topbar-link {
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  color: var(--ink-soft);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.topbar-link:hover { background: var(--hover); color: var(--ink); }
.topbar .button { height: 2.25rem; padding: 0 0.875rem; font-size: 0.875rem; }
@media (max-width: 25rem) {
  .brand-name { display: none; }
}
`);

function BrandMark() {
  return (
    <svg
      class="brand-mark"
      width="26"
      height="26"
      viewBox="0 0 26 26"
      aria-hidden="true"
    >
      <rect width="26" height="26" rx="7" fill="currentColor" />
      <path
        d="M8 13h9.5m-3.5-4 4 4-4 4"
        fill="none"
        stroke="#fff"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

// The dashboard hides the links, because it is the page they lead to.
export function TopBar({ links = true }: { links?: boolean }) {
  return (
    <header class="topbar">
      <div class="wrap topbar-inner">
        <a class="brand" href="/" aria-label="URL shortener">
          <BrandMark />
          <span class="brand-name">URL shortener</span>
        </a>
        {links && (
          <nav class="topbar-nav" aria-label="Main">
            <a class="topbar-link" href="/">
              All links
            </a>
            <a class="button" href="/">
              Shorten a link
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
