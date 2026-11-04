export interface ShortenInput {
  url: string;
  expiresAt: string | null;
}

export function referrerHost(referrer: string | null): string {
  if (!referrer) return "(direct)";
  try {
    return new URL(referrer).hostname || "(unknown)";
  } catch {
    return "(unknown)";
  }
}

// Check calendar fields before Date.parse: Date accepts impossible dates by
// rolling them into the following month, as well as non-RFC timestamp formats.
function parseTimestamp(value: string): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/i.exec(
      value,
    );
  if (!match || match[0].length !== value.length) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  const maxDay = daysInMonth[month - 1];
  const timezone = match[7]!;
  if (
    maxDay === undefined ||
    day < 1 ||
    day > maxDay ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59 ||
    (timezone.toUpperCase() !== "Z" &&
      (Number(timezone.slice(1, 3)) > 23 || Number(timezone.slice(4, 6)) > 59))
  )
    return null;

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function validateShortenInput(
  body: unknown,
  now: Date,
): ShortenInput | string {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !("url" in body) ||
    typeof body.url !== "string"
  ) {
    return "Body must be a JSON object with a string url";
  }

  const { url } = body;
  if (url.length > 2048 || /[\s\p{Cc}]/u.test(url)) {
    return "url must be at most 2048 characters with no whitespace or control characters";
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "url must use http or https";
    }
  } catch {
    return "url must be a valid absolute HTTP or HTTPS URL";
  }

  let expiresAt: string | null = null;
  if ("expiresAt" in body && body.expiresAt !== null) {
    const parsed =
      typeof body.expiresAt === "string"
        ? parseTimestamp(body.expiresAt)
        : null;
    if (!parsed)
      return "expiresAt must be a real RFC 3339 timestamp with a timezone";
    if (parsed.getTime() <= now.getTime())
      return "expiresAt must be after the current time";
    expiresAt = parsed.toISOString();
  }

  return { url, expiresAt };
}
