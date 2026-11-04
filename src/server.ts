import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createClientIpResolver } from "./client-ip";
import { openDb } from "./db";

const port = Number(process.env.PORT ?? 3000);
const baseUrl = process.env.BASE_URL ?? `http://localhost:${port}`;
const db = openDb(process.env.DATABASE_PATH ?? "./data/urlshortener.db");
const trustProxy = process.env.TRUST_PROXY === "true";

const app = createApp({
  db,
  baseUrl,
  getClientIp: createClientIpResolver({ trustProxy }),
});

serve({ fetch: app.fetch, port }, () => {
  console.log(`URL shortener listening on ${baseUrl}`);
});
