import { describe, expect, it } from 'vitest';
import { handleEvents, handleStats, memoryStore, parseEvent, readStats, recordEvents, type TelemetryEvent } from '../../server/telemetry';

const NOW = Date.parse('2026-12-05T10:00:00Z');
const ev = (over: Partial<TelemetryEvent> = {}): TelemetryEvent => ({ type: 'start', session: 'ABC123', day: '2026-12-05', hour: 14, ...over });

describe('parseEvent', () => {
  it('accepts a valid event', () => {
    expect(parseEvent(ev({ type: 'reveal', character: 'santa' }), NOW)).toEqual(ev({ type: 'reveal', character: 'santa' }));
  });
  it('rejects bad types, sessions, days and hours', () => {
    expect(parseEvent(ev({ type: 'hack' as never }), NOW)).toBeNull();
    expect(parseEvent(ev({ session: 'x' }), NOW)).toBeNull();
    expect(parseEvent(ev({ day: '05/12/2026' }), NOW)).toBeNull();
    expect(parseEvent(ev({ day: '2020-01-01' }), NOW)).toBeNull();
    expect(parseEvent(ev({ hour: 24 }), NOW)).toBeNull();
    expect(parseEvent(null, NOW)).toBeNull();
  });
  it('drops an unknown character but keeps the event', () => {
    expect(parseEvent({ ...ev({ type: 'reveal' }), character: 'grinch' }, NOW)?.character).toBeUndefined();
  });
});

describe('recording', () => {
  it('counts per day, per hour and per character, once per session and step', async () => {
    const store = memoryStore();
    await recordEvents(store, [ev(), ev(), ev({ session: 'DEF456', hour: 15 })]);
    await recordEvents(store, [ev()]); // retried from an offline queue
    await recordEvents(store, [ev({ type: 'reveal', character: 'yeti' }), ev({ day: '2026-12-04', session: 'GHI789' })]);
    const days = await readStats(store);
    expect(days.map((d) => d.day)).toEqual(['2026-12-04', '2026-12-05']);
    expect(days[1].counts).toEqual({ start: 2, 'start@14': 1, 'start@15': 1, reveal: 1, 'reveal@14': 1, 'char:yeti': 1 });
  });
});

describe('handlers', () => {
  it('POST /api/events stores valid events and skips invalid ones', async () => {
    const store = memoryStore();
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const res = await handleEvents(
      new Request('http://x/api/events', { method: 'POST', body: JSON.stringify({ events: [ev({ day }), { type: 'nope' }] }) }),
      store,
    );
    expect(await res.json()).toEqual({ received: 2, recorded: 1 });
  });

  it('reports when storage is not configured', async () => {
    expect((await handleEvents(new Request('http://x', { method: 'POST', body: '{}' }), null)).status).toBe(503);
    expect((await handleStats(new Request('http://x'), null)).status).toBe(503);
  });

  it('GET /api/stats checks the stats key when one is set', async () => {
    const store = memoryStore();
    expect((await handleStats(new Request('http://x/api/stats'), store, 'secret')).status).toBe(401);
    expect((await handleStats(new Request('http://x/api/stats?key=secret'), store, 'secret')).status).toBe(200);
    const res = await handleStats(new Request('http://x/api/stats', { headers: { 'x-stats-key': 'secret' } }), store, 'secret');
    expect((await res.json()).days).toEqual([]);
  });
});
