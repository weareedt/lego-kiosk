import { handleStats, storeFromEnv } from '../server/telemetry.js';

/** Per-day usage totals for the /stats dashboard. See server/telemetry.ts. */
export function GET(request: Request) {
  return handleStats(request, storeFromEnv(), process.env.STATS_KEY || undefined);
}
