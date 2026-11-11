import type { CharacterId } from './characters';

/**
 * Usage events for the /stats dashboard. Each event is queued in localStorage
 * and sent to /api/events in the background, so a kiosk on patchy venue Wi-Fi
 * keeps counting and catches up when it's back online. The server ignores
 * repeats, so retries never double count. Nothing identifying is sent: just
 * the step, the session id, the local day and hour, and (on Reveal) the
 * character.
 */

export type EventType = 'start' | 'camera' | 'confirm' | 'cameraError' | 'matching' | 'reveal' | 'qr';

interface QueuedEvent {
  type: EventType;
  session: string;
  day: string;
  hour: number;
  character?: CharacterId;
}

const QUEUE_KEY = 'stf.telemetryQueue';
const MAX_QUEUE = 3000;
const BATCH = 50;
const RETRY_MS = 30_000;
const ENDPOINT = '/api/events';

const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar day, so a day at the venue is a day on the dashboard. */
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function load(): QueuedEvent[] {
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}
function save(q: QueuedEvent[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch {
    /* storage full or blocked: events just won't survive a reload */
  }
}

let memory: QueuedEvent[] | null = null;
const queue = () => (memory ??= load());

let flushing = false;
let retry: number | undefined;

async function flush() {
  if (flushing) return;
  const batch = queue().slice(0, BATCH);
  if (!batch.length) return;
  flushing = true;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    // 2xx: stored. 4xx: the server will never take these, so drop them. 5xx: keep and retry.
    if (res.status < 500) {
      memory = queue().slice(batch.length);
      save(memory);
      flushing = false;
      if (memory.length) return flush();
      return;
    }
  } catch {
    /* offline: retry below */
  }
  flushing = false;
  window.clearTimeout(retry);
  retry = window.setTimeout(flush, RETRY_MS);
}

/** Record one step for a session. Fire and forget. */
export function track(type: EventType, session: string, opts: { character?: CharacterId; at?: Date } = {}) {
  const at = opts.at ?? new Date();
  const q = queue();
  q.push({ type, session, day: localDay(at), hour: at.getHours(), ...(opts.character ? { character: opts.character } : {}) });
  save(q);
  void flush();
}

/** Send anything left over from earlier (e.g. the kiosk was offline), and retry when the network comes back. */
export function startTelemetry() {
  window.addEventListener('online', () => void flush());
  void flush();
}
