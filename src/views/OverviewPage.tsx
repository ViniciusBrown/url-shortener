import type { ListedLink } from "../stats";
import type { OverviewStats } from "../types";

export interface OverviewPageProps {
  overview: OverviewStats;
  links: ListedLink[];
  now: Date;
}

// Functional placeholder: the design pass replaces this markup and adds the chart.
export function OverviewPage({ overview, links }: OverviewPageProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="refresh" content="5" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Analytics for all links</title>
      </head>
      <body>
        <main>
          <p>
            <a href="/">Shorten a link</a>
          </p>
          <h1>
            {overview.totalClicks} clicks across {overview.totalLinks} links
          </h1>
          <h2>Clicks per day</h2>
          <ul>
            {overview.clicksByDay
              .filter((day) => day.clicks > 0)
              .map((day) => (
                <li>
                  {day.date}: {day.clicks}
                </li>
              ))}
          </ul>
          <h2>Top referrers</h2>
          <ul>
            {overview.topReferrers.map((row) => (
              <li>
                {row.referrer}: {row.clicks}
              </li>
            ))}
          </ul>
          <h2>All links</h2>
          <table>
            <thead>
              <tr>
                <th>Link</th>
                <th>Goes to</th>
                <th>Clicks</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr>
                  <td>
                    <a href={`/analytics/${link.shortCode}`}>
                      {link.shortCode}
                    </a>
                  </td>
                  <td>{link.originalUrl}</td>
                  <td>{link.totalClicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      </body>
    </html>
  );
}
