import type { CreatedLink } from "./links";
import type {
  AppDeps,
  DayClicks,
  LinkRow,
  LinkStats,
  OverviewStats,
  ReferrerClicks,
} from "./types";

export interface ListedLink extends CreatedLink {
  totalClicks: number;
}

export interface LinkTotals {
  links: number;
  clicks: number;
}

type LinkWithClicks = LinkRow & { total_clicks: number };

const SELECT_LINK_WITH_CLICKS = `
  SELECT id, code, original_url, created_at, expires_at,
    (SELECT COUNT(*) FROM clicks WHERE link_id = links.id) AS total_clicks
  FROM links
`;

function toListedLink(baseUrl: string, link: LinkWithClicks): ListedLink {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    shortCode: link.code,
    shortUrl: `${base}/${link.code}`,
    analyticsUrl: `${base}/analytics/${link.code}`,
    originalUrl: link.original_url,
    createdAt: link.created_at,
    expiresAt: link.expires_at,
    totalClicks: link.total_clicks,
  };
}

export function listLinks(
  deps: Pick<AppDeps, "db" | "baseUrl">,
  limit: number,
): ListedLink[] {
  const links = deps.db
    .prepare(
      `${SELECT_LINK_WITH_CLICKS} ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(limit) as unknown as LinkWithClicks[];
  return links.map((link) => toListedLink(deps.baseUrl, link));
}

export function getLink(
  deps: Pick<AppDeps, "db" | "baseUrl">,
  code: string,
): ListedLink | null {
  const link = deps.db
    .prepare(`${SELECT_LINK_WITH_CLICKS} WHERE code = ?`)
    .get(code) as LinkWithClicks | undefined;
  return link ? toListedLink(deps.baseUrl, link) : null;
}

export function getTotals(deps: Pick<AppDeps, "db">): LinkTotals {
  return deps.db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM links) AS links,
        (SELECT COUNT(*) FROM clicks) AS clicks`,
    )
    .get() as unknown as LinkTotals;
}

function countClicksByDay(
  deps: Pick<AppDeps, "db" | "now">,
  linkId: number | null,
): DayClicks[] {
  const today = new Date(deps.now());
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 29);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 1);
  const range = [start.toISOString(), end.toISOString()];
  const dailyCounts = deps.db
    .prepare(
      `
      SELECT substr(clicked_at, 1, 10) AS date, COUNT(*) AS clicks
      FROM clicks
      WHERE ${linkId === null ? "" : "link_id = ? AND "}clicked_at >= ? AND clicked_at < ?
      GROUP BY substr(clicked_at, 1, 10)
    `,
    )
    .all(
      ...(linkId === null ? range : [linkId, ...range]),
    ) as unknown as DayClicks[];
  const countsByDate = new Map(
    dailyCounts.map((day) => [day.date, day.clicks]),
  );
  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    return { date, clicks: countsByDate.get(date) ?? 0 };
  });
}

function countTopReferrers(
  deps: Pick<AppDeps, "db">,
  linkId: number | null,
): ReferrerClicks[] {
  return deps.db
    .prepare(
      `
      SELECT referrer_host AS referrer, COUNT(*) AS clicks
      FROM clicks ${linkId === null ? "" : "WHERE link_id = ?"}
      GROUP BY referrer_host
      ORDER BY clicks DESC, referrer_host ASC
      LIMIT 10
    `,
    )
    .all(...(linkId === null ? [] : [linkId])) as unknown as ReferrerClicks[];
}

export function getStats(
  deps: Pick<AppDeps, "db" | "now">,
  code: string,
): LinkStats | null {
  const link = deps.db
    .prepare(`${SELECT_LINK_WITH_CLICKS} WHERE code = ?`)
    .get(code) as LinkWithClicks | undefined;
  if (!link) return null;

  return {
    shortCode: link.code,
    originalUrl: link.original_url,
    createdAt: link.created_at,
    expiresAt: link.expires_at,
    totalClicks: link.total_clicks,
    clicksByDay: countClicksByDay(deps, link.id),
    topReferrers: countTopReferrers(deps, link.id),
  };
}

export function getOverview(deps: Pick<AppDeps, "db" | "now">): OverviewStats {
  const totals = getTotals(deps);
  return {
    totalLinks: totals.links,
    totalClicks: totals.clicks,
    clicksByDay: countClicksByDay(deps, null),
    topReferrers: countTopReferrers(deps, null),
  };
}
