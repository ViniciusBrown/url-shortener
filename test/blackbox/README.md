# Black-box contract tests

These tests were written from `DECISIONS.md`, the Portuguese brief and the
permitted foundation interfaces. No route, validation, code-generation, stats,
client-IP or view implementation was read or imported directly.

Every fixture has a real `openDb(":memory:")` database. All creation and click
seeding uses HTTP requests to `createApp`, with an injected clock, code generator,
base URL and IP resolver. One test deliberately uses the application's default
code generator to test its public seven-character format. The only direct database
operation is `DROP TABLE clicks` in the specified write-failure test. The Unicode
redirect test uses `serve` from `@hono/node-server`, binds loopback port 0, fetches
with `redirect: "manual"` and closes the server in `finally`. Databases close after
each test. No background server or external destination is required.

Run from the repository root:

```sh
npx prettier --write 'test/blackbox/**/*.ts' test/blackbox/README.md
npx tsc --noEmit
npm test
```

Stub routes are expected to fail the HTTP assertions. No assertions are skipped,
marked as expected failures, or changed to accept stub behavior.

## Coverage map

| Contract or risk                                                                       | Test files           |
| -------------------------------------------------------------------------------------- | -------------------- |
| Creation response, exact original URL, validation, RFC 3339 expiry and normalization   | `shorten.test.ts`    |
| Injected base URL versus forged Host, real default code format                         | `shorten.test.ts`    |
| 301/no-store, five repeat GETs, 404/410, expiry equality, HEAD parity and no counting  | `redirect.test.ts`   |
| Case sensitivity, route collisions, Unicode HTTP headers, broken click storage         | `redirect.test.ts`   |
| Code collision retry, fifth-attempt success, five-attempt exhaustion/500, no overwrite | `collisions.test.ts` |
| List fields/counts, newest first, same-millisecond ties, limit boundaries and default  | `list.test.ts`       |
| 30 UTC days, zero fill, midnight/window edges, leap day/year rollover, all-time totals | `stats.test.ts`      |
| Referrer host normalization, direct/unknown groups, top ten and deterministic ties     | `stats.test.ts`      |
| HTML known/unknown/zero/expired states, SVG, total, referrer table, CSP and escaping   | `analytics.test.ts`  |
| IP and user-agent absence in bodies and headers, success and error responses           | `privacy.test.ts`    |

## Contract conflicts and observation limits

- The risk table requests five **real browser** navigations with a control lacking
  `no-store`, and a real-browser XSS check. This assignment prescribes `app.request()`
  except for the Unicode HTTP-server test. The automated suite checks the relevant
  response headers, five repeat HTTP GETs, HTML escaping, CSP and lack of scripts.
  Those assertions do not prove browser cache behavior or browser execution. The
  separate browser/control checks remain unverified while the routes are stubs;
  there is no skip or fake browser pass in this suite.
- The request says a script payload in `Referer` should appear escaped. The
  contract exposes **hostname aggregates**, not raw referrers. A script in a valid
  referrer's path therefore must disappear; a script-only malformed referrer must
  become `(unknown)`. Both cases are tested. A script-bearing original URL tests
  actual escaped output (`&lt;script&gt;`), and known and unknown analytics pages
  receive script-bearing Referer headers. Requiring the raw referrer payload to
  appear, even escaped, would contradict the aggregate-only output contract.
- “Every error body” being JSON conflicts with the analytics route's explicit
  HTML 404. The route-specific HTML requirement takes precedence in the tests.
- A 30-day SVG chart has no specified markup, labels, bar primitives or accessibility
  representation. The suite checks SVG presence and API day data without imposing
  a particular count of SVG rectangles. The expired badge accepts English or
  Portuguese wording, since the contract does not fix UI copy.
- The numeric range for `limit` does not specify duplicate parameters, exponent or
  hexadecimal notation, leading zeroes or whitespace. Tests cover ordinary integer
  boundaries and unambiguously invalid values without choosing those grammars.
- Leap seconds and precision beyond milliseconds are not resolved relative to the
  injected JavaScript `Date` clock. Tests cover real calendar dates, leap years,
  explicit zones, lowercase RFC 3339 separators and millisecond boundaries, without
  making a leap-second or sub-millisecond rounding policy.
- IP/user-agent/raw-referrer persistence, the exact stored click timestamp, WAL,
  foreign keys, the logging sink for failed writes, socket/proxy extraction and
  environment defaults are not exposed by the permitted HTTP/injection interface.
  Tests verify privacy, observable timestamp/day behavior and redirect survival;
  they do not claim to inspect those internal storage/configuration properties.
