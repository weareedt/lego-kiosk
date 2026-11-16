/**
 * Online copy of the kiosk usage counts, so /stats can be viewed from anywhere.
 *
 * Each iPad keeps its own per-day counts (src/lib/usage.ts) and every few
 * minutes uploads the whole set as one snapshot. /stats reads all snapshots and
 * adds them up, so a second iPad would just work.
 *
 *   /lego-kiosk-usage/<kiosk id>      { at, days }
 *
 * Storage is Firebase Realtime Database over its REST API (no SDK), signed in
 * with a service account. The same handlers run on Vercel (api/usage.ts) and in
 * the Vite dev/preview server (vite.config.ts), which uses an in-memory store
 * when Firebase isn't configured.
 */
import { createSign } from 'node:crypto';

export type Counts = Record<string, number>;
/** day (YYYY-MM-DD) → counts */
export type Days = Record<string, Counts>;

/** What the iPad's screen is like. Sent with the counts; nothing in it identifies a person. */
export interface KioskDevice {
  /** The device's screen in CSS points, [width, height]. */
  screen: [number, number];
  /** The space the app has, [width, height]: smaller than the screen when Safari's bars show. */
  view: [number, number];
  /** Opened from the Home Screen icon (full screen) rather than in a Safari tab. */
  standalone: boolean;
}

export interface KioskSnapshot {
  /** When the iPad sent it (ISO time). */
  at: string;
  days: Days;
  /** Missing for uploads from before the app reported it. */
  device?: KioskDevice;
}

export interface Store {
  /** The kiosks that have a snapshot. */
  ids(): Promise<string[]>;
  /** Saves this kiosk's snapshot, replacing its previous one. */
  put(kiosk: string, snap: KioskSnapshot): Promise<void>;
  /** Every kiosk's snapshot as stored (not yet validated), by kiosk id. */
  all(): Promise<Record<string, unknown>>;
}

export const ROOT = 'lego-kiosk-usage';
/** The lego-kiosk Firebase project's database. FIREBASE_DATABASE_URL overrides it. */
export const DATABASE_URL = 'https://lego-kiosk-default-rtdb.asia-southeast1.firebasedatabase.app';
const MAX_BODY = 200_000;
/**
 * Most entries the store will hold: a guard against junk, not a count of real iPads. An iPad
 * gets a new entry whenever it is added to the Home Screen or opened in another browser, so
 * this has to leave room for that. Existing entries can always upload.
 */
export const MAX_KIOSKS = 50;
/** How long one server instance reuses a read of all snapshots (/stats refreshes every minute, per viewer). */
const READ_CACHE_MS = 30_000;

// ---- Stores ---------------------------------------------------------------

export interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Reads FIREBASE_SERVICE_ACCOUNT: the service account key file from the
 * Firebase console, as JSON or base64 of that JSON. Null if unset or unusable.
 */
export function serviceAccountFromEnv(env: Record<string, string | undefined> = process.env): ServiceAccount | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const key = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')) as Record<string, unknown>;
    const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = key;
    if (typeof projectId !== 'string' || typeof clientEmail !== 'string' || typeof privateKey !== 'string') return null;
    return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email';

/** Google's service account sign-in: a signed JWT exchanged for an access token (good for an hour, reused). */
function accessTokens(account: ServiceAccount): () => Promise<string> {
  let current: { token: string; until: number } | null = null;
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return async () => {
    if (current && Date.now() < current.until) return current.token;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
    const assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(account.privateKey, 'base64url')}`;
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const out = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !out.access_token) throw new Error(`Firebase sign-in ${res.status}${out.error_description ? `: ${out.error_description}` : ''}`);
    current = { token: out.access_token, until: Date.now() + ((out.expires_in ?? 3600) - 300) * 1000 };
    return current.token;
  };
}

/** One call to the database: `path` is below the database root, without ".json". Returns the parsed JSON (null if nothing is there). */
export type DbRequest = (method: 'GET' | 'PUT', path: string, body?: unknown) => Promise<unknown>;

/** Realtime Database REST, signed in as the service account. */
export function firebaseRequest(account: ServiceAccount, databaseUrl: string): DbRequest {
  const token = accessTokens(account);
  const base = databaseUrl.replace(/\/+$/, '');
  return async (method, path, body) => {
    const [name, query] = path.split('?');
    const res = await fetch(`${base}/${name}.json${query ? `?${query}` : ''}`, {
      method,
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Firebase ${res.status}`);
    return res.json();
  };
}

/** One child per kiosk under ROOT. */
export function firebaseStore(request: DbRequest): Store {
  let cached: { at: number; kiosks: Record<string, unknown> } | null = null;
  return {
    // shallow: just the kiosk ids, not their counts
    ids: async () => Object.keys(((await request('GET', `${ROOT}?shallow=true`)) as object | null) ?? {}),
    async put(kiosk, snap) {
      await request('PUT', `${ROOT}/${kiosk}`, { at: snap.at, days: snap.days });
      cached = null;
    },
    async all() {
      if (cached && Date.now() - cached.at < READ_CACHE_MS) return cached.kiosks;
      const kiosks: Record<string, unknown> = {};
      for (const [id, snap] of Object.entries(((await request('GET', ROOT)) as object | null) ?? {})) {
        // The database doesn't keep empty objects: an iPad with no days yet comes back without `days`.
        kiosks[id] = snap && typeof snap === 'object' ? { days: {}, ...snap } : snap;
      }
      cached = { at: Date.now(), kiosks };
      return kiosks;
    },
  };
}

let fromEnv: Store | null = null;

/** Firebase, using the FIREBASE_SERVICE_ACCOUNT key. Null if not configured. */
export function storeFromEnv(env: Record<string, string | undefined> = process.env): Store | null {
  const account = serviceAccountFromEnv(env);
  if (!account) return null;
  return (fromEnv ??= firebaseStore(firebaseRequest(account, env.FIREBASE_DATABASE_URL?.trim() || DATABASE_URL)));
}

/** In-memory store for local dev and tests. */
export function memoryStore(): Store {
  const kiosks = new Map<string, KioskSnapshot>();
  return {
    ids: async () => [...kiosks.keys()],
    put: async (kiosk, snap) => void kiosks.set(kiosk, snap),
    all: async () => Object.fromEntries(kiosks),
  };
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

/** A valid device description, or null (it is optional, so a bad one is just left out). */
export function cleanDevice(raw: unknown): KioskDevice | null {
  const size = (v: unknown): [number, number] | null =>
    Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n > 0 && n <= 20_000) ? [v[0], v[1]] : null;
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const screen = size(d.screen);
  const view = size(d.view);
  return screen && view ? { screen, view, standalone: d.standalone === true } : null;
}

// ---- HTTP handler (Web Request/Response) ----------------------------------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/**
 * POST /api/usage  { kiosk, days, device? }  stores this iPad's snapshot.
 * GET  /api/usage  → { kiosks: { <id>: { at, days, device? } }, at }  (needs ?key= or x-stats-key when STATS_KEY is set)
 */
export async function handleUsage(req: Request, store: Store | null, statsKey?: string): Promise<Response> {
  if (req.method === 'POST') {
    if (!store) return json({ error: 'not_configured' }, 503);
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413);
    let body: { kiosk?: unknown; days?: unknown; device?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const days = cleanDays(body.days);
    if (typeof body.kiosk !== 'string' || !KIOSK_RE.test(body.kiosk) || !days) return json({ error: 'bad_body' }, 400);
    try {
      const ids = await store.ids();
      if (!ids.includes(body.kiosk) && ids.length >= MAX_KIOSKS) return json({ error: 'too_many_kiosks' }, 409);
      const device = cleanDevice(body.device);
      const snap: KioskSnapshot = { at: new Date().toISOString(), days, ...(device && { device }) };
      await store.put(body.kiosk, snap);
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
      const kiosks: Record<string, KioskSnapshot> = {};
      for (const [id, raw] of Object.entries(await store.all())) {
        const s = raw as Partial<KioskSnapshot> | null;
        const days = cleanDays(s?.days);
        const device = cleanDevice(s?.device);
        if (days) kiosks[id] = { at: String(s?.at), days, ...(device && { device }) };
      }
      return json({ kiosks, at: new Date().toISOString() });
    } catch (err) {
      return json({ error: 'store', detail: String(err) }, 502);
    }
  }

  return json({ error: 'method' }, 405);
}
