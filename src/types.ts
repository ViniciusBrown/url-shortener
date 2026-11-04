import type { DatabaseSync } from "node:sqlite";
import type { Context } from "hono";

export interface AppDeps {
  db: DatabaseSync;
  now: () => Date;
  generateCode: () => string;
  baseUrl: string;
  getClientIp: (c: Context) => string | null;
}

export type AppOptions = Pick<AppDeps, "db"> & Partial<Omit<AppDeps, "db">>;

export interface LinkRow {
  id: number;
  code: string;
  original_url: string;
  created_at: string;
  expires_at: string | null;
}

export interface DayClicks {
  date: string;
  clicks: number;
}

export interface ReferrerClicks {
  referrer: string;
  clicks: number;
}

export interface LinkStats {
  shortCode: string;
  originalUrl: string;
  createdAt: string;
  expiresAt: string | null;
  totalClicks: number;
  clicksByDay: DayClicks[];
  topReferrers: ReferrerClicks[];
}

export interface OverviewStats {
  totalLinks: number;
  totalClicks: number;
  clicksByDay: DayClicks[];
  topReferrers: ReferrerClicks[];
}
