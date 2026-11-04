import type { Child } from "hono/jsx";

// Analytics pages reload themselves so new clicks show up without JavaScript.
export const REFRESH_SECONDS = 5;

export function Document({
  title,
  css,
  refresh = false,
  dead = false,
  head,
  children,
}: {
  title: string;
  css: string;
  refresh?: boolean;
  dead?: boolean;
  head?: Child;
  children: Child;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        {refresh && (
          <meta http-equiv="refresh" content={String(REFRESH_SECONDS)} />
        )}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <style>{css}</style>
        {head}
      </head>
      <body class={dead ? "dead" : undefined}>{children}</body>
    </html>
  );
}
