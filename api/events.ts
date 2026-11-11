import { handleEvents, storeFromEnv } from '../server/telemetry.js';

/** Kiosk and result-page usage events. See server/telemetry.ts. */
export function POST(request: Request) {
  return handleEvents(request, storeFromEnv());
}
