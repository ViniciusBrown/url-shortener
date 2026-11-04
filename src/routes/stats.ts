import type { Hono } from "hono";
import type { AppDeps } from "../types";

// Stub: the read-path stream owns this file. GET /api/urls and GET /api/stats/:code.
export function registerStatsRoutes(_app: Hono, _deps: AppDeps): void {}
