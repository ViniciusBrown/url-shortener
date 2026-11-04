import type { Hono } from "hono";
import type { AppDeps } from "../types";

// Stub: the write-path stream owns this file. POST /api/shorten and GET /:code.
export function registerLinkRoutes(_app: Hono, _deps: AppDeps): void {}
