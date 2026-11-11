import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS, type CharacterId } from '../../src/lib/characters';
import { getStaffOverride, matchGuest, pickCharacter, setStaffOverride } from '../../src/lib/matching';

const today = () => new Date().toISOString().slice(0, 10);

const run = (n: number) => {
  const counts: Partial<Record<CharacterId, number>> = {};
  let prev: CharacterId | null = null;
  let repeats = 0;
  for (let i = 0; i < n; i++) {
    const c = pickCharacter();
    counts[c] = (counts[c] ?? 0) + 1;
    if (c === prev) repeats++;
    prev = c;
  }
  return { counts, repeats };
};

describe('even odds', () => {
  it('every character is equally likely on a fresh day', () => {
    // No history: all seven at weight 1, so each takes 1/7 of the roll.
    expect(pickCharacter(() => 0.5 / 7)).toBe(CHARACTER_IDS[0]);
    localStorage.clear();
    expect(pickCharacter(() => 6.5 / 7)).toBe(CHARACTER_IDS[6]);
  });

  it('hands out every character, and keeps the counts close together', () => {
    const n = 700;
    const { counts } = run(n);
    expect(Object.keys(counts).sort()).toEqual([...CHARACTER_IDS].sort());
    // Even share is 100 each. The balancing rule keeps every character close to it.
    for (const id of CHARACTER_IDS) {
      expect(counts[id]).toBeGreaterThan(85);
      expect(counts[id]).toBeLessThan(115);
    }
  });

  it('matchGuest picks from all seven characters', async () => {
    const seen = new Set<CharacterId>();
    for (let i = 0; i < 300; i++) seen.add(await matchGuest());
    expect([...seen].sort()).toEqual([...CHARACTER_IDS].sort());
  });
});

describe('variety rules', () => {
  it('never gives the same character twice in a row', () => {
    expect(run(400).repeats).toBe(0);
  });

  it('halves the weight of a character ahead of its even share today', () => {
    // 14 results today, even share 2 each. Santa has 5 (more than one ahead).
    const counts = { elfboy: 2, elfgirl: 2, santa: 5, reindeer: 1, gingerbread: 2, snowman: 1, yeti: 1 };
    localStorage.setItem('stf.matchStats', JSON.stringify({ day: today(), counts }));
    localStorage.setItem('stf.lastMatch', 'yeti');
    // Without Yeti (last): elfboy 1, elfgirl 1, santa 0.5, reindeer 1, gingerbread 1, snowman 1 → total 5.5.
    // Santa covers 2 to 2.5 of the roll.
    expect(pickCharacter(() => 2.4 / 5.5)).toBe('santa');
    localStorage.setItem('stf.matchStats', JSON.stringify({ day: today(), counts }));
    localStorage.setItem('stf.lastMatch', 'yeti');
    expect(pickCharacter(() => 2.6 / 5.5)).toBe('reindeer');
  });

  it('ignores stats from a previous day', () => {
    localStorage.setItem('stf.matchStats', JSON.stringify({ day: '2000-01-01', counts: { elfboy: 99 } }));
    // Full weight again: the first seventh of the roll is still Elf Boy.
    expect(pickCharacter(() => 0.5 / 7)).toBe('elfboy');
  });
});

describe('staff override', () => {
  it('forces the next result once, then clears', () => {
    setStaffOverride('yeti');
    expect(getStaffOverride()).toBe('yeti');
    expect(pickCharacter()).toBe('yeti');
    expect(getStaffOverride()).toBeNull();
  });

  it('ignores an unknown override value', () => {
    localStorage.setItem('stf.staffOverride', 'grinch');
    expect(getStaffOverride()).toBeNull();
  });
});
