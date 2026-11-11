import { describe, expect, it } from 'vitest';
import { cleanDays, handleUsage, memoryStore, mergeDays } from '../../server/usage';

const post = (body: unknown) => new Request('http://x/api/usage', { method: 'POST', body: JSON.stringify(body) });
const get = (init?: RequestInit, q = '') => new Request(`http://x/api/usage${q}`, init);

describe('cleanDays', () => {
  it('keeps real days and counters, drops junk', () => {
    expect(
      cleanDays({
        '2026-12-05': { start: 3, 'start@14': 2, 'char:yeti': 1, cameraError: 1, '<script>': 9, reveal: -1, camera: 1.5 },
        'not-a-day': { start: 1 },
      }),
    ).toEqual({ '2026-12-05': { start: 3, 'start@14': 2, 'char:yeti': 1, cameraError: 1 } });
    expect(cleanDays(null)).toBeNull();
    expect(cleanDays([1])).toBeNull();
  });
});

describe('mergeDays', () => {
  it('adds up iPads', () => {
    expect(mergeDays([{ d: { start: 1, reveal: 1 } }, { d: { start: 2 }, e: { start: 1 } }])).toEqual({ d: { start: 3, reveal: 1 }, e: { start: 1 } });
  });
});

describe('/api/usage', () => {
  it('stores each iPad’s latest snapshot and returns them all', async () => {
    const store = memoryStore();
    expect((await handleUsage(post({ kiosk: 'ipad-aaaa', days: { '2026-12-05': { start: 1 } } }), store)).status).toBe(200);
    await handleUsage(post({ kiosk: 'ipad-aaaa', days: { '2026-12-05': { start: 4 } } }), store); // newer copy replaces
    await handleUsage(post({ kiosk: 'ipad-bbbb', days: { '2026-12-05': { start: 2 } } }), store);
    const body = await (await handleUsage(get(), store)).json();
    expect(Object.keys(body.kiosks).sort()).toEqual(['ipad-aaaa', 'ipad-bbbb']);
    expect(body.kiosks['ipad-aaaa'].days).toEqual({ '2026-12-05': { start: 4 } });
    expect(typeof body.kiosks['ipad-aaaa'].at).toBe('string');
  });

  it('rejects bad uploads', async () => {
    const store = memoryStore();
    expect((await handleUsage(post({ kiosk: 'x', days: {} }), store)).status).toBe(400);
    expect((await handleUsage(post({ kiosk: 'ipad-aaaa', days: 'nope' }), store)).status).toBe(400);
    expect((await handleUsage(new Request('http://x', { method: 'POST', body: '{' }), store)).status).toBe(400);
    expect((await handleUsage(new Request('http://x', { method: 'DELETE' }), store)).status).toBe(405);
  });

  it('reports when storage is not configured', async () => {
    expect((await handleUsage(post({ kiosk: 'ipad-aaaa', days: {} }), null)).status).toBe(503);
    expect((await handleUsage(get(), null)).status).toBe(503);
  });

  it('needs the stats key to read when one is set (uploads don’t)', async () => {
    const store = memoryStore();
    expect((await handleUsage(post({ kiosk: 'ipad-aaaa', days: {} }), store, 'secret')).status).toBe(200);
    expect((await handleUsage(get(), store, 'secret')).status).toBe(401);
    expect((await handleUsage(get(undefined, '?key=secret'), store, 'secret')).status).toBe(200);
    expect((await handleUsage(get({ headers: { 'x-stats-key': 'secret' } }), store, 'secret')).status).toBe(200);
  });
});
