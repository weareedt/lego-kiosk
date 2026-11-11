import { describe, expect, it } from 'vitest';
import { loadUsage, localDay, recordStep } from '../../src/lib/usage';

describe('usage counts', () => {
  it('counts steps per local day, per hour, and cards per character', () => {
    const at = new Date(2026, 11, 5, 14, 30);
    recordStep('start', { at });
    recordStep('start', { at: new Date(2026, 11, 5, 15, 5) });
    recordStep('reveal', { at, character: 'yeti' });
    recordStep('start', { at: new Date(2026, 11, 4, 11, 0) });
    expect(loadUsage()).toEqual([
      { day: '2026-12-04', counts: { start: 1, 'start@11': 1 } },
      { day: '2026-12-05', counts: { start: 2, 'start@14': 1, 'start@15': 1, reveal: 1, 'reveal@14': 1, 'char:yeti': 1 } },
    ]);
  });

  it('uses the local calendar day', () => {
    expect(localDay(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('stf.usage', 'not json');
    expect(loadUsage()).toEqual([]);
    recordStep('start');
    expect(loadUsage()).toHaveLength(1);
  });
});
