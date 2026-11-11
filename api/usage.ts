import { handleUsage, storeFromEnv } from '../server/usage.js';

/** Kiosk usage snapshots for /stats. See server/usage.ts. */
export function GET(request: Request) {
  return handleUsage(request, storeFromEnv(), process.env.STATS_KEY || undefined);
}

export function POST(request: Request) {
  return handleUsage(request, storeFromEnv());
}
