import { CHARACTER_IDS, type CharacterId } from './characters';

/**
 * Character matching.
 *
 * The client printed the same number of cards for every character, so every
 * character is equally likely: 1 in 7. Two variety rules keep stock even:
 *
 * 1. Never the same character twice in a row on this kiosk.
 * 2. Once 7 or more guests have played today on this kiosk, any character more
 *    than one ahead of its even share has its weight halved, so the counts
 *    stay close together through the day.
 *
 * A staff override (see `setStaffOverride`) forces the next result. The photo
 * is not used for matching, and nothing identifying is stored.
 */

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

export function pickCharacter(rand: () => number = Math.random): CharacterId {
  const forced = getStaffOverride();
  if (forced) {
    setStaffOverride(null); // one-shot
    record(forced);
    return forced;
  }

  const stats = loadStats();
  const total = Object.values(stats.counts).reduce((a, b) => a + (b ?? 0), 0);
  const last = safeGet(LAST_KEY) as CharacterId | null;

  const evenShare = total / CHARACTER_IDS.length;
  const entries = CHARACTER_IDS.filter((id) => id !== last).map((id) => {
    const ahead = total >= CHARACTER_IDS.length && (stats.counts[id] ?? 0) > evenShare + 1;
    return [id, ahead ? 0.5 : 1] as const;
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

/** Picks the guest's character. Resolved at the start of Matching so the reveal is ready. */
export async function matchGuest(): Promise<CharacterId> {
  return pickCharacter();
}
