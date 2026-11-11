import type { CharacterId } from './characters';

/**
 * Usage counts for the staff stats screen (/stats), kept on this iPad in
 * localStorage. One counter set per local day:
 *
 *   <step>        guests who reached that step
 *   <step>@<HH>   the same, by hour of the day
 *   char:<id>     cards handed out per character
 *
 * Only counts are kept: no names, photos or session ids.
 */

export type Step = 'start' | 'camera' | 'confirm' | 'cameraError' | 'matching' | 'reveal';

export interface DayStats {
  day: string;
  counts: Record<string, number>;
}

const KEY = 'stf.usage';

const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar day, so a day at the venue is a day in the stats. */
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Store = Record<string, Record<string, number>>;

function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  } catch {
    return {};
  }
}

/** Count one guest reaching a step. Call once per guest per step. */
export function recordStep(step: Step, opts: { character?: CharacterId; at?: Date } = {}) {
  const at = opts.at ?? new Date();
  const store = load();
  const day = (store[localDay(at)] ??= {});
  const bump = (k: string) => (day[k] = (day[k] ?? 0) + 1);
  bump(step);
  bump(`${step}@${pad(at.getHours())}`);
  if (step === 'reveal' && opts.character) bump(`char:${opts.character}`);
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable: this guest just isn't counted */
  }
}

/** Every day with data, oldest first. */
export function loadUsage(): DayStats[] {
  return Object.entries(load())
    .filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, counts]) => ({ day, counts }));
}

// ---- Online copy ------------------------------------------------------------
// Every few minutes the iPad uploads its whole set of counts to /api/usage, so
// /stats can be opened from anywhere (see server/usage.ts). One small request,
// only when something changed. Offline: it just tries again next time.

const KIOSK_KEY = 'stf.kioskId';
const SYNCED_KEY = 'stf.usageSynced';
const SYNC_MS = 3 * 60_000;
const SYNC_URL = '/api/usage';

/** This iPad's id for the online copy (random, made once). With create = false, null if it has none. */
export function kioskId(): string;
export function kioskId(create: false): string | null;
export function kioskId(create = true): string | null {
  try {
    let id = localStorage.getItem(KIOSK_KEY);
    if (!id && !create) return null;
    if (!id) {
      const a = 'abcdefghjkmnpqrstuvwxyz23456789';
      id = 'ipad-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => a[b % a.length]).join('');
      localStorage.setItem(KIOSK_KEY, id);
    }
    return id;
  } catch {
    return create ? 'ipad-unknown' : null;
  }
}

let syncing = false;

/** Upload this iPad's counts if they changed since the last successful upload. */
export async function syncUsage(): Promise<void> {
  if (syncing) return;
  let raw: string;
  try {
    raw = localStorage.getItem(KEY) ?? '{}';
    if (raw === localStorage.getItem(SYNCED_KEY)) return;
  } catch {
    return;
  }
  syncing = true;
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kiosk: kioskId(), days: JSON.parse(raw) }),
    });
    if (res.ok) localStorage.setItem(SYNCED_KEY, raw);
  } catch {
    /* offline or not configured: try again next round */
  } finally {
    syncing = false;
  }
}

/** Kiosk only: upload now, every few minutes, and when the network comes back. */
export function startUsageSync() {
  void syncUsage();
  window.setInterval(() => void syncUsage(), SYNC_MS);
  window.addEventListener('online', () => void syncUsage());
}
