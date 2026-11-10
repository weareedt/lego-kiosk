import { CHARACTER_IDS, type CharacterId } from './characters';

/**
 * Character matching.
 *
 * 1. Read: a photo "read" returns a presentation estimate. This build ships a
 *    SIMULATED reader; swap `readPhoto` for an on-device model later. Nothing
 *    identifying is stored, and the read is never shown on screen.
 * 2. Weighted pick from the pool for that read. The neutral characters
 *    (Gingerbread, Snowman, Yeti) sit in every pool, so an unexpected match
 *    still feels festive.
 * 3. Variety rules: never the same character twice in a row on this kiosk, and
 *    any character above 25% of today's results has its weight halved.
 * 4. A staff override (see `setStaffOverride`) forces the next result.
 */

export type PhotoRead = 'masculine' | 'feminine' | 'unsure';

type Weights = Partial<Record<CharacterId, number>>;

export const POOLS: Record<PhotoRead, Weights> = {
  masculine: { elfboy: 30, santa: 25, gingerbread: 15, snowman: 15, yeti: 15 },
  feminine: { elfgirl: 30, reindeer: 25, gingerbread: 15, snowman: 15, yeti: 15 },
  unsure: { elfboy: 10, santa: 10, elfgirl: 10, reindeer: 10, gingerbread: 20, snowman: 20, yeti: 20 },
};

/**
 * SIMULATED read. Face *presence* is real (from the camera's face check); the
 * presentation estimate is still simulated. Replace with an on-device
 * classifier when ready. No photo or no face found → 'unsure' pool.
 */
export async function readPhoto(photo: string | null, faceFound = true): Promise<PhotoRead> {
  if (!photo || !faceFound) return 'unsure';
  const r = Math.random();
  if (r < 0.45) return 'masculine';
  if (r < 0.9) return 'feminine';
  return 'unsure';
}

// ---- Persistence for variety rules (per kiosk, per day) -------------------

const STATS_KEY = 'stf.matchStats';
const LAST_KEY = 'stf.lastMatch';
const OVERRIDE_KEY = 'stf.staffOverride';

interface DayStats {
  day: string;
  counts: Partial<Record<CharacterId, number>>;
}

const today = () => new Date().toISOString().slice(0, 10);

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: variety rules fall back to in-memory behaviour */
  }
}

function loadStats(): DayStats {
  try {
    const s = JSON.parse(safeGet(STATS_KEY) ?? '') as DayStats;
    if (s.day === today()) return s;
  } catch {
    /* ignore */
  }
  return { day: today(), counts: {} };
}

export function setStaffOverride(id: CharacterId | null) {
  safeSet(OVERRIDE_KEY, id);
}

export function getStaffOverride(): CharacterId | null {
  const v = safeGet(OVERRIDE_KEY) as CharacterId | null;
  return v && CHARACTER_IDS.includes(v) ? v : null;
}

export function pickCharacter(read: PhotoRead, rand: () => number = Math.random): CharacterId {
  const forced = getStaffOverride();
  if (forced) {
    setStaffOverride(null); // one-shot
    record(forced);
    return forced;
  }

  const stats = loadStats();
  const total = Object.values(stats.counts).reduce((a, b) => a + (b ?? 0), 0);
  const last = safeGet(LAST_KEY) as CharacterId | null;

  const entries = (Object.entries(POOLS[read]) as [CharacterId, number][])
    .filter(([id]) => id !== last)
    .map(([id, w]) => {
      const share = total >= 8 ? (stats.counts[id] ?? 0) / total : 0;
      return [id, share > 0.25 ? w / 2 : w] as const;
    });

  const sum = entries.reduce((a, [, w]) => a + w, 0);
  let roll = rand() * sum;
  let chosen = entries[entries.length - 1][0];
  for (const [id, w] of entries) {
    roll -= w;
    if (roll <= 0) {
      chosen = id;
      break;
    }
  }
  record(chosen);
  return chosen;
}

function record(id: CharacterId) {
  const stats = loadStats();
  stats.counts[id] = (stats.counts[id] ?? 0) + 1;
  safeSet(STATS_KEY, JSON.stringify(stats));
  safeSet(LAST_KEY, id);
}

/** Read + pick in one call. Resolved at the start of Matching so the reveal is ready. */
export async function matchGuest(photo: string | null, faceFound = true): Promise<CharacterId> {
  const read = await readPhoto(photo, faceFound);
  return pickCharacter(read);
}
