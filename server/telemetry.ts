/**
 * Usage telemetry: the kiosk and the phone result page send small events; the
 * /stats dashboard reads per-day totals.
 *
 * Storage is Upstash Redis over its REST API (no SDK). Each event only bumps
 * counters, so nothing identifying is kept: no names, no photos.
 *
 *   tm:days            set of days that have data (YYYY-MM-DD, kiosk local time)
 *   tm:day:<day>       hash: <type> → count, <type>@<HH> → count by hour,
 *                      char:<id> → cards handed out
 *   tm:seen:<s>:<type> dedupe marker, so a retried or repeated event counts once
 *
 * The same handlers run on Vercel (api/*.ts) and in the Vite dev/preview
 * server (vite.config.ts), which uses an in-memory store.
 */
import { CHARACTER_IDS, type CharacterId } from '../src/lib/characters.js';

export const EVENT_TYPES = ['start', 'camera', 'confirm', 'cameraError', 'matching', 'reveal', 'qr'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface TelemetryEvent {
  type: EventType;
  /** Kiosk session id (same as the QR's `s`). */
  session: string;
  /** Local day and hour on the device where it happened. */
  day: string;
  hour: number;
  character?: CharacterId;
}

export interface DayStats {
  day: string;
  counts: Record<string, number>;
}

type Cmd = (string | number)[];

export interface Store {
  exec(cmds: Cmd[]): Promise<unknown[]>;
}

const SEEN_TTL = 60 * 24 * 3600;
const MAX_BATCH = 100;

// ---- Stores ---------------------------------------------------------------

/** Upstash Redis REST (also what Vercel's Upstash/KV integration provides). Null if not configured. */
export function storeFromEnv(env: Record<string, string | undefined> = process.env): Store | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return {
    async exec(cmds) {
      const res = await fetch(`${url.replace(/\/+$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmds),
      });
      if (!res.ok) throw new Error(`Redis ${res.status}`);
      const out = (await res.json()) as { result?: unknown; error?: string }[];
      const err = out.find((r) => r.error);
      if (err) throw new Error(`Redis: ${err.error}`);
      return out.map((r) => r.result);
    },
  };
}

/** In-memory store for local dev and tests. Supports only the commands used here. */
export function memoryStore(): Store {
  const strings = new Map<string, string>();
  const hashes = new Map<string, Map<string, number>>();
  const sets = new Map<string, Set<string>>();
  const run = ([cmd, key, ...args]: Cmd): unknown => {
    const k = String(key);
    switch (cmd) {
      case 'SET':
        if (args.includes('NX') && strings.has(k)) return null;
        strings.set(k, String(args[0]));
        return 'OK';
      case 'HINCRBY': {
        const h = hashes.get(k) ?? new Map<string, number>();
        hashes.set(k, h);
        const v = (h.get(String(args[0])) ?? 0) + Number(args[1]);
        h.set(String(args[0]), v);
        return v;
      }
      case 'SADD': {
        const s = sets.get(k) ?? new Set<string>();
        sets.set(k, s);
        const before = s.size;
        args.forEach((a) => s.add(String(a)));
        return s.size - before;
      }
      case 'SMEMBERS':
        return [...(sets.get(k) ?? [])];
      case 'HGETALL':
        return [...(hashes.get(k) ?? new Map<string, number>())].flatMap(([f, v]) => [f, String(v)]);
      default:
        throw new Error(`memoryStore: unsupported ${cmd}`);
    }
  };
  return { exec: async (cmds) => cmds.map(run) };
}

// ---- Validation -----------------------------------------------------------

const DAY_MS = 24 * 3600 * 1000;

export function parseEvent(raw: unknown, now = Date.now()): TelemetryEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (!EVENT_TYPES.includes(e.type as EventType)) return null;
  if (typeof e.session !== 'string' || !/^[A-Z0-9]{4,12}$/.test(e.session)) return null;
  if (typeof e.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.day)) return null;
  const t = Date.parse(`${e.day}T12:00:00Z`);
  // Queued events may arrive days late (offline kiosk), but not from the far past or future.
  if (!Number.isFinite(t) || t > now + 2 * DAY_MS || t < now - 90 * DAY_MS) return null;
  if (!Number.isInteger(e.hour) || (e.hour as number) < 0 || (e.hour as number) > 23) return null;
  const character = CHARACTER_IDS.includes(e.character as CharacterId) ? (e.character as CharacterId) : undefined;
  return { type: e.type as EventType, session: e.session, day: e.day, hour: e.hour as number, character };
}

// ---- Recording and reading ------------------------------------------------

export async function recordEvents(store: Store, events: TelemetryEvent[]): Promise<number> {
  if (!events.length) return 0;
  const seen = await store.exec(events.map((e) => ['SET', `tm:seen:${e.session}:${e.type}`, 1, 'NX', 'EX', SEEN_TTL]));
  const fresh = events.filter((_, i) => seen[i] === 'OK');
  if (!fresh.length) return 0;
  const cmds: Cmd[] = [['SADD', 'tm:days', ...new Set(fresh.map((e) => e.day))]];
  for (const e of fresh) {
    const key = `tm:day:${e.day}`;
    cmds.push(['HINCRBY', key, e.type, 1], ['HINCRBY', key, `${e.type}@${String(e.hour).padStart(2, '0')}`, 1]);
    if (e.type === 'reveal' && e.character) cmds.push(['HINCRBY', key, `char:${e.character}`, 1]);
  }
  await store.exec(cmds);
  return fresh.length;
}

export async function readStats(store: Store): Promise<DayStats[]> {
  const [days] = (await store.exec([['SMEMBERS', 'tm:days']])) as string[][];
  if (!days?.length) return [];
  days.sort();
  const hashes = (await store.exec(days.map((d) => ['HGETALL', `tm:day:${d}`]))) as string[][];
  return days.map((day, i) => {
    const flat = hashes[i] ?? [];
    const counts: Record<string, number> = {};
    for (let j = 0; j + 1 < flat.length; j += 2) counts[flat[j]] = Number(flat[j + 1]) || 0;
    return { day, counts };
  });
}

// ---- HTTP handlers (Web Request/Response) ---------------------------------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** POST /api/events  body: { events: TelemetryEvent[] } */
export async function handleEvents(req: Request, store: Store | null): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!store) return json({ error: 'not_configured' }, 503);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const raw = (body as { events?: unknown })?.events;
  if (!Array.isArray(raw)) return json({ error: 'bad_body' }, 400);
  const events = raw.slice(0, MAX_BATCH).map((e) => parseEvent(e)).filter((e): e is TelemetryEvent => !!e);
  try {
    const recorded = await recordEvents(store, events);
    return json({ received: raw.length, recorded });
  } catch (err) {
    return json({ error: 'store', detail: String(err) }, 502);
  }
}

/** GET /api/stats  (needs ?key= or an x-stats-key header when STATS_KEY is set) */
export async function handleStats(req: Request, store: Store | null, statsKey?: string): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method' }, 405);
  if (statsKey) {
    const given = req.headers.get('x-stats-key') ?? new URL(req.url).searchParams.get('key');
    if (given !== statsKey) return json({ error: 'unauthorized' }, 401);
  }
  if (!store) return json({ error: 'not_configured' }, 503);
  try {
    return json({ days: await readStats(store), at: new Date().toISOString() });
  } catch (err) {
    return json({ error: 'store', detail: String(err) }, 502);
  }
}
