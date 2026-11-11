import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS, type CharacterId } from '../../src/lib/characters';
import { POOLS, getStaffOverride, matchGuest, pickCharacter, readPhoto, setStaffOverride, type PhotoRead } from '../../src/lib/matching';

const run = (read: PhotoRead, n: number) => {
  const counts: Partial<Record<CharacterId, number>> = {};
  let prev: CharacterId | null = null;
  let repeats = 0;
  for (let i = 0; i < n; i++) {
    const c = pickCharacter(read);
    counts[c] = (counts[c] ?? 0) + 1;
    if (c === prev) repeats++;
    prev = c;
  }
  return { counts, repeats };
};

describe('character pools', () => {
  it('pools match the spec weights and only use real characters', () => {
    for (const pool of Object.values(POOLS)) {
      for (const id of Object.keys(pool)) expect(CHARACTER_IDS).toContain(id);
      expect(Object.values(pool).reduce((a, b) => a + (b ?? 0), 0)).toBe(100);
    }
    expect(POOLS.unsure).toEqual({ elfboy: 10, santa: 10, elfgirl: 10, reindeer: 10, gingerbread: 20, snowman: 20, yeti: 20 });
  });

  it('neutral characters are in every pool', () => {
    for (const pool of Object.values(POOLS)) {
      for (const id of ['gingerbread', 'snowman', 'yeti']) expect(pool).toHaveProperty(id);
    }
  });

  it('masculine read never gives Elf Girl or Reindeer', () => {
    const { counts } = run('masculine', 500);
    expect(counts.elfgirl).toBeUndefined();
    expect(counts.reindeer).toBeUndefined();
  });

  it('feminine read never gives Elf Boy or Santa', () => {
    const { counts } = run('feminine', 500);
    expect(counts.elfboy).toBeUndefined();
    expect(counts.santa).toBeUndefined();
  });

  it('unsure read can give all seven characters', () => {
    const { counts } = run('unsure', 700);
    expect(Object.keys(counts).sort()).toEqual([...CHARACTER_IDS].sort());
  });
});

describe('variety rules', () => {
  it('never gives the same character twice in a row', () => {
    for (const read of ['masculine', 'feminine', 'unsure'] as const) {
      expect(run(read, 400).repeats).toBe(0);
    }
  });

  it('halves the weight of a character above 25% of today', () => {
    const today = new Date().toISOString().slice(0, 10);
    // Elf Girl already has 50% of today's results.
    localStorage.setItem('stf.matchStats', JSON.stringify({ day: today, counts: { elfgirl: 10, reindeer: 5, yeti: 5 } }));
    localStorage.setItem('stf.lastMatch', 'yeti');
    // Feminine pool minus Yeti (last): elfgirl 30→15, reindeer 25, gingerbread 15, snowman 15 (total 70).
    // A roll just under 15/70 still lands on Elf Girl; just over moves on to Reindeer.
    expect(pickCharacter('feminine', () => 14.9 / 70)).toBe('elfgirl');
    localStorage.setItem('stf.lastMatch', 'yeti');
    expect(pickCharacter('feminine', () => 15.1 / 70)).toBe('reindeer');
  });

  it('ignores stats from a previous day', () => {
    localStorage.setItem('stf.matchStats', JSON.stringify({ day: '2000-01-01', counts: { elfgirl: 99 } }));
    // Full weight again: 29.9 of 100 is still Elf Girl.
    expect(pickCharacter('feminine', () => 0.299)).toBe('elfgirl');
  });
});

describe('staff override', () => {
  it('forces the next result once, then clears', () => {
    setStaffOverride('yeti');
    expect(getStaffOverride()).toBe('yeti');
    expect(pickCharacter('masculine')).toBe('yeti');
    expect(getStaffOverride()).toBeNull();
  });

  it('ignores an unknown override value', () => {
    localStorage.setItem('stf.staffOverride', 'grinch');
    expect(getStaffOverride()).toBeNull();
  });
});

describe('photo read', () => {
  it('no photo or no face found → the unsure pool', async () => {
    expect(await readPhoto(null)).toBe('unsure');
    expect(await readPhoto('data:image/jpeg;base64,x', false)).toBe('unsure');
  });
});

describe('real-world mix', () => {
  it('guests with a face in their photo regularly get Elf Girl and Elf Boy', async () => {
    const counts: Record<string, number> = {};
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const c = await matchGuest('data:image/jpeg;base64,x', true);
      counts[c] = (counts[c] ?? 0) + 1;
    }
    // Expected ~14.5% each (45% masculine × 30% + 10% unsure × 10%), before variety rules.
    for (const elf of ['elfgirl', 'elfboy']) {
      expect(counts[elf] / n).toBeGreaterThan(0.08);
      expect(counts[elf] / n).toBeLessThan(0.25);
    }
    // and every character turns up
    expect(Object.keys(counts).sort()).toEqual([...CHARACTER_IDS].sort());
  });
});
