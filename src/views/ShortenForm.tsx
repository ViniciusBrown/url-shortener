import { EXPIRY_PRESETS } from "../links";

export interface ShortenFormProps {
  url?: string;
  expiresIn?: string;
  error?: string;
  autofocus?: boolean;
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
      <div class="shorten-url">
        <label for="url">Link to shorten</label>
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
            <option value={preset.value} selected={preset.value === expiresIn}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit">Shorten</button>
      {error && (
        <p id="url-error" class="shorten-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
