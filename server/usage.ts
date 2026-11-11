/**
 * Online copy of the kiosk usage counts, so /stats can be viewed from anywhere.
 *
 * Each iPad keeps its own per-day counts (src/lib/usage.ts) and every few
 * minutes uploads the whole set as one snapshot. That is one Redis command per
 * upload, so it barely touches a shared database's quota. /stats reads all
 * snapshots and adds them up, so a second iPad would just work.
 *
 *   lego-kiosk:usage      hash: <kiosk id> → JSON { at, days }
 *
 * Storage is Upstash Redis over its REST API (no SDK). The same handlers run on
 * Vercel (api/usage.ts) and in the Vite dev/preview server (vite.config.ts),
 * which uses an in-memory store when Redis isn't configured.
 */

export type Counts = Record<string, number>;
/** day (YYYY-MM-DD) → counts */
export type Days = Record<string, Counts>;

export interface KioskSnapshot {
  /** When the iPad sent it (ISO time). */
  at: string;
  days: Days;
}

type Cmd = (string | number)[];

export interface Store {
  exec(cmds: Cmd[]): Promise<unknown[]>;
}

const HASH = 'lego-kiosk:usage';
const MAX_BODY = 200_000;
const MAX_KIOSKS = 20;

// ---- Stores ---------------------------------------------------------------

/** Upstash Redis REST, as provided by Vercel's Upstash integration. Null if not configured. */
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

/** In-memory store for local dev and tests (HSET, HGETALL, HLEN only). */
export function memoryStore(): Store {
  const hashes = new Map<string, Map<string, string>>();
  const get = (k: string) => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
  const run = ([cmd, key, ...args]: Cmd): unknown => {
    const h = get(String(key));
    if (cmd === 'HSET') {
      const isNew = !h.has(String(args[0]));
      h.set(String(args[0]), String(args[1]));
      return isNew ? 1 : 0;
    }
    if (cmd === 'HGETALL') return [...h].flat();
    if (cmd === 'HLEN') return h.size;
    if (cmd === 'HEXISTS') return h.has(String(args[0])) ? 1 : 0;
    throw new Error(`memoryStore: unsupported ${cmd}`);
  };
  return { exec: async (cmds) => cmds.map(run) };
}

// ---- Validation -----------------------------------------------------------

const KIOSK_RE = /^[A-Za-z0-9_-]{4,32}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const FIELD_RE = /^[A-Za-z]{1,16}(@\d{2}|:[a-z]{1,16})?$|^char:[a-z]{1,16}$/;

/** Keeps only well-formed days and counters. */
export function cleanDays(raw: unknown): Days | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Days = {};
  for (const [day, counts] of Object.entries(raw as Record<string, unknown>)) {
    if (!DAY_RE.test(day) || !counts || typeof counts !== 'object') continue;
    const c: Counts = {};
    for (const [k, v] of Object.entries(counts as Record<string, unknown>)) {
      if (FIELD_RE.test(k) && Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1e7) c[k] = v as number;
    }
    out[day] = c;
  }
  return out;
}

/** Adds up every kiosk's counts into one day → counts map. */
export function mergeDays(snapshots: Days[]): Days {
  const out: Days = {};
  for (const days of snapshots) {
    for (const [day, counts] of Object.entries(days)) {
      const o = (out[day] ??= {});
      for (const [k, v] of Object.entries(counts)) o[k] = (o[k] ?? 0) + v;
    }
  }
  return out;
}

// ---- HTTP handler (Web Request/Response) ----------------------------------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/**
 * POST /api/usage  { kiosk, days }  stores this iPad's snapshot.
 * GET  /api/usage  → { kiosks: { <id>: { at, days } }, at }  (needs ?key= or x-stats-key when STATS_KEY is set)
 */
export async function handleUsage(req: Request, store: Store | null, statsKey?: string): Promise<Response> {
  if (req.method === 'POST') {
    if (!store) return json({ error: 'not_configured' }, 503);
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413);
    let body: { kiosk?: unknown; days?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const days = cleanDays(body.days);
    if (typeof body.kiosk !== 'string' || !KIOSK_RE.test(body.kiosk) || !days) return json({ error: 'bad_body' }, 400);
    try {
      const [exists, count] = await store.exec([
        ['HEXISTS', HASH, body.kiosk],
        ['HLEN', HASH],
      ]);
      if (!exists && Number(count) >= MAX_KIOSKS) return json({ error: 'too_many_kiosks' }, 409);
      const snap: KioskSnapshot = { at: new Date().toISOString(), days };
      await store.exec([['HSET', HASH, body.kiosk, JSON.stringify(snap)]]);
      return json({ ok: true, at: snap.at });
    } catch (err) {
      return json({ error: 'store', detail: String(err) }, 502);
    }
  }

  if (req.method === 'GET') {
    if (statsKey) {
      const given = req.headers.get('x-stats-key') ?? new URL(req.url).searchParams.get('key');
      if (given !== statsKey) return json({ error: 'unauthorized' }, 401);
    }
    if (!store) return json({ error: 'not_configured' }, 503);
    try {
      const [flat] = (await store.exec([['HGETALL', HASH]])) as string[][];
      const kiosks: Record<string, KioskSnapshot> = {};
      for (let i = 0; i + 1 < (flat ?? []).length; i += 2) {
        try {
          const s = JSON.parse(flat[i + 1]) as KioskSnapshot;
          const days = cleanDays(s.days);
          if (days) kiosks[flat[i]] = { at: String(s.at), days };
        } catch {
          /* skip a bad entry */
        }
      }
      return json({ kiosks, at: new Date().toISOString() });
    } catch (err) {
      return json({ error: 'store', detail: String(err) }, 502);
    }
  }

  return json({ error: 'method' }, 405);
}
