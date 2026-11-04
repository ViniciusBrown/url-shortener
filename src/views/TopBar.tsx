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
.topbar-nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--sunken);
}
.topbar-link {
  padding: 0.375rem 0.875rem;
  border-radius: var(--radius-pill);
  color: var(--ink-muted);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 0.15s, color 0.15s;
}
.topbar-link:hover { color: var(--ink); }
.topbar-link[aria-current] {
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--line), 0 1px 2px rgb(0 0 0 / 0.06);
  color: var(--ink);
}
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

const PAGES = [
  { key: "shorten", label: "Shorten", href: "/" },
  { key: "analytics", label: "Analytics", href: "/analytics" },
] as const;

export function TopBar({
  current = "analytics",
}: {
  current?: (typeof PAGES)[number]["key"];
}) {
  return (
    <header class="topbar">
      <div class="wrap topbar-inner">
        <a class="brand" href="/" aria-label="URL shortener">
          <BrandMark />
          <span class="brand-name">URL shortener</span>
        </a>
        <nav class="topbar-nav" aria-label="Main">
          {PAGES.map((page) => (
            <a
              class="topbar-link"
              href={page.href}
              aria-current={page.key === current ? "page" : undefined}
            >
              {page.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
