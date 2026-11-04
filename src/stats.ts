import type {
  AppDeps,
  DayClicks,
  LinkRow,
  LinkStats,
  ReferrerClicks,
} from "./types";

export function getStats(
  deps: Pick<AppDeps, "db" | "now">,
  code: string,
): LinkStats | null {
  const link = deps.db
    .prepare(
      `
      SELECT id, code, original_url, created_at, expires_at,
        (SELECT COUNT(*) FROM clicks WHERE link_id = links.id) AS total_clicks
      FROM links WHERE code = ?
    `,
    )
    .get(code) as (LinkRow & { total_clicks: number }) | undefined;
  if (!link) return null;

  const today = new Date(deps.now());
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 29);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 1);
  const dailyCounts = deps.db
    .prepare(
      `
      SELECT substr(clicked_at, 1, 10) AS date, COUNT(*) AS clicks
      FROM clicks
      WHERE link_id = ? AND clicked_at >= ? AND clicked_at < ?
      GROUP BY substr(clicked_at, 1, 10)
    `,
    )
    .all(
      link.id,
      start.toISOString(),
      end.toISOString(),
    ) as unknown as DayClicks[];
  const countsByDate = new Map(
    dailyCounts.map((day) => [day.date, day.clicks]),
  );
  const clicksByDay = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    return { date, clicks: countsByDate.get(date) ?? 0 };
  });
  const topReferrers = deps.db
    .prepare(
      `
      SELECT referrer_host AS referrer, COUNT(*) AS clicks
      FROM clicks WHERE link_id = ?
      GROUP BY referrer_host
      ORDER BY clicks DESC, referrer_host ASC
      LIMIT 10
    `,
    )
    .all(link.id) as unknown as ReferrerClicks[];

  return {
    shortCode: link.code,
    originalUrl: link.original_url,
    createdAt: link.created_at,
    expiresAt: link.expires_at,
    totalClicks: link.total_clicks,
    clicksByDay,
    topReferrers,
  };
}
