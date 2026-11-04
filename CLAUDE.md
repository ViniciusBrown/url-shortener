# URL shortener

Live interview project. `DECISIONS.md` holds the API contract and design decisions.

## Stack

TypeScript, Hono, `node:sqlite`, Vitest, npm. Server-rendered `hono/jsx` with a dependency-free SVG chart.

## Rules

- Use as many subagents as are useful, and run in parallel whatever can safely run in parallel.
- Tests exercise public interfaces: HTTP for the API, props for presentational components. Do not mock internal collaborators.
- Make small conventional commits, and push after each stage.
- Do not add dependencies beyond the stack above without asking.
- Never claim that something works without showing the command output.
- Use the integrated browser for browser checks and screenshots, not agent-browser.
- Before pushing, run `npx prettier --write .` and `npx tsc --noEmit`.
