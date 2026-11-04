import { EXPIRY_PRESETS } from "../links";
import { safeCss } from "./theme";

export interface ShortenFormProps {
  url?: string;
  expiresIn?: string;
  error?: string;
  autofocus?: boolean;
}

export const SHORTEN_FORM_CSS = safeCss(`
.shorten-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.375rem;
  padding: 0.375rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-raised);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.shorten-bar:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 22%, transparent),
    var(--shadow-raised);
}
.shorten-bar:has([aria-invalid]) { border-color: var(--danger); }
.shorten-url { grid-column: 1 / -1; position: relative; min-width: 0; }
.shorten-url svg {
  position: absolute;
  top: 50%;
  left: 1rem;
  color: var(--ink-muted);
  transform: translateY(-50%);
  pointer-events: none;
}
.shorten-url input {
  width: 100%;
  height: 3.5rem;
  padding: 0 1rem 0 2.875rem;
  border: 0;
  border-radius: calc(var(--radius-xl) - 0.375rem);
  background: transparent;
  color: var(--ink);
  font: 400 1.1875rem/1.2 var(--font-sans);
  letter-spacing: -0.01em;
}
.shorten-url input::placeholder { color: var(--ink-muted); opacity: 1; }
.shorten-url input:focus-visible { outline: none; }
.shorten-expiry {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-left: 0.875rem;
  border-radius: var(--radius-md);
  background: var(--sunken);
}
.shorten-expiry label {
  color: var(--ink-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
}
.shorten-expiry select {
  height: 3rem;
  padding: 0 2rem 0 0.25rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink);
  font: 600 0.9375rem/1 var(--font-sans);
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}
.shorten-expiry svg {
  position: absolute;
  right: 0.75rem;
  color: var(--ink-muted);
  pointer-events: none;
}
.shorten-bar .button {
  height: 3rem;
  padding: 0 1.375rem;
  border-radius: calc(var(--radius-xl) - 0.375rem);
  font-size: 1.0625rem;
}
@media (min-width: 36rem) {
  .shorten-bar {
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
  }
  .shorten-url { grid-column: auto; }
  .shorten-expiry {
    height: 2.5rem;
    border-left: 1px solid var(--line);
    border-radius: 0;
    background: none;
  }
  .shorten-expiry select { height: 2.5rem; }
  .shorten-bar .button { height: 3.5rem; padding: 0 1.625rem; }
}
.shorten-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.875rem;
  padding-left: 0.5rem;
  color: var(--danger);
  font-size: 0.9375rem;
  font-weight: 600;
}
`);

// Validation messages start with the field name, written for API clients.
function displayError(message: string): string {
  const text = message.replace(/^url\b/, "URL");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function LinkIcon() {
  return (
    <svg
      width="20"
      height="20"
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

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function AlertIcon() {
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
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </svg>
  );
}

// novalidate lets the server's error show inline instead of a browser bubble.
export function ShortenForm({
  url,
  expiresIn = "never",
  error,
  autofocus = false,
}: ShortenFormProps) {
  return (
    <form class="shorten" method="post" action="/links" novalidate>
      <div class="shorten-bar">
        <div class="shorten-url">
          <label class="sr-only" for="url">
            Link to shorten
          </label>
          <LinkIcon />
          <input
            id="url"
            name="url"
            type="url"
            value={url}
            placeholder="https://example.com/a/long/page"
            required
            autofocus={autofocus}
            autocomplete="off"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? "url-error" : undefined}
          />
        </div>
        <div class="shorten-expiry">
          <label for="expiresIn">Expires</label>
          <select id="expiresIn" name="expiresIn">
            {EXPIRY_PRESETS.map((preset) => (
              <option
                value={preset.value}
                selected={preset.value === expiresIn}
              >
                {preset.label}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>
        <button class="button" type="submit">
          Shorten
        </button>
      </div>
      {error && (
        <p id="url-error" class="shorten-error" role="alert">
          <AlertIcon />
          {displayError(error)}
        </p>
      )}
    </form>
  );
}
