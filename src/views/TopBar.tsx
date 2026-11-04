import { ShortenForm } from "./ShortenForm";

// hono/jsx escapes text inside <style>, so this CSS must not contain
// ampersands, angle brackets or quotes.
const STYLES = `
.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.5rem;
  padding: 0.625rem clamp(1rem, 4vw, 2rem);
  border-bottom: 1px solid color-mix(in srgb, CanvasText 20%, Canvas);
  background: Canvas;
  color: CanvasText;
  font-size: 0.875rem;
}
.topbar-home { font-weight: 600; white-space: nowrap; }
.topbar .shorten {
  display: flex;
  flex: 1 1 20rem;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.topbar .shorten-url { flex: 1 1 12rem; min-width: 0; }
.topbar .shorten-url label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.topbar .shorten-expiry { display: flex; align-items: center; gap: 0.375rem; }
.topbar input, .topbar select, .topbar button {
  height: 2.25rem;
  padding: 0 0.625rem;
  border: 1px solid color-mix(in srgb, CanvasText 45%, Canvas);
  border-radius: 0.375rem;
  background: Field;
  color: FieldText;
  font: inherit;
}
.topbar input { width: 100%; }
.topbar button {
  border-color: CanvasText;
  background: CanvasText;
  color: Canvas;
  font-weight: 600;
  cursor: pointer;
}
.topbar :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
`;

export function TopBar() {
  return (
    <header class="topbar">
      <style>{STYLES}</style>
      <a class="topbar-home" href="/">
        All links
      </a>
      <ShortenForm />
    </header>
  );
}
