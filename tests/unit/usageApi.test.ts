import { describe, expect, it } from 'vitest';
import { ROOT, cleanDays, firebaseStore, handleUsage, memoryStore, mergeDays, serviceAccountFromEnv, storeFromEnv, type DbRequest } from '../../server/usage';

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

  it('keeps the iPad’s screen size when it is sent, and ignores a malformed one', async () => {
    const store = memoryStore();
    const days = { '2026-12-05': { start: 1 } };
    const device = { screen: [1024, 1366], view: [1024, 1292], standalone: false };
    await handleUsage(post({ kiosk: 'ipad-aaaa', days, device: { ...device, extra: 'dropped' } }), store);
    await handleUsage(post({ kiosk: 'ipad-bbbb', days }), store); // an iPad still on the old version
    expect((await handleUsage(post({ kiosk: 'ipad-cccc', days, device: { screen: ['wide', 2], view: [1, 2] } }), store)).status).toBe(200);
    expect((await handleUsage(post({ kiosk: 'ipad-dddd', days, device: { screen: [744, 1133], view: [744, 1133], standalone: true } }), store)).status).toBe(200);
    const { kiosks } = await (await handleUsage(get(), store)).json();
    expect(kiosks['ipad-aaaa'].device).toEqual(device);
    expect(kiosks['ipad-bbbb']).not.toHaveProperty('device');
    expect(kiosks['ipad-cccc']).not.toHaveProperty('device');
    expect(kiosks['ipad-cccc'].days).toEqual(days);
    expect(kiosks['ipad-dddd'].device.standalone).toBe(true);
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

/**
 * Stands in for the Realtime Database REST API: just the calls the store makes.
 * Like the real one, it doesn't keep empty objects. Counts reads of everything.
 */
function fakeDb() {
  const kiosks = new Map<string, Record<string, unknown>>();
  const reads = { all: 0 };
  const request: DbRequest = async (method, path, body) => {
    if (method === 'GET' && path === `${ROOT}?shallow=true`) return kiosks.size ? Object.fromEntries([...kiosks.keys()].map((k) => [k, true])) : null;
    if (method === 'GET' && path === ROOT) return reads.all++, kiosks.size ? Object.fromEntries(kiosks) : null;
    if (method === 'PUT' && path.startsWith(`${ROOT}/`)) {
      const kept = Object.entries(body as object).filter(([, v]) => !(v && typeof v === 'object' && !Object.keys(v).length));
      kiosks.set(path.slice(ROOT.length + 1), structuredClone(Object.fromEntries(kept)));
      return body;
    }
    throw new Error(`fakeDb: unexpected ${method} ${path}`);
  };
  return { request, kiosks, reads };
}

describe('Firebase store', () => {
  it('keeps one entry per iPad and serves them through /api/usage', async () => {
    const { request, kiosks } = fakeDb();
    const store = firebaseStore(request);
    expect((await (await handleUsage(get(), store)).json()).kiosks).toEqual({}); // empty database
    await handleUsage(post({ kiosk: 'ipad-aaaa', days: { '2026-12-05': { start: 1 } } }), store);
    await handleUsage(post({ kiosk: 'ipad-aaaa', days: { '2026-12-05': { start: 4, 'start@14': 4, 'char:yeti': 2 } } }), store);
    await handleUsage(post({ kiosk: 'ipad-bbbb', days: {} }), store);
    expect([...kiosks.keys()]).toEqual(['ipad-aaaa', 'ipad-bbbb']);
    expect(kiosks.get('ipad-aaaa')).toEqual({ at: expect.any(String), days: { '2026-12-05': { start: 4, 'start@14': 4, 'char:yeti': 2 } } });
    const body = await (await handleUsage(get(), store)).json();
    expect(body.kiosks['ipad-aaaa'].days['2026-12-05'].start).toBe(4);
    expect(body.kiosks['ipad-bbbb'].days).toEqual({}); // an iPad with no days yet is still listed
  });

  it('reuses a read for a moment, but never past an upload', async () => {
    const { request, reads } = fakeDb();
    const store = firebaseStore(request);
    await store.put('ipad-aaaa', { at: 'a', days: {} });
    await store.all();
    await store.all();
    expect(reads.all).toBe(1);
    await store.put('ipad-bbbb', { at: 'b', days: {} });
    expect(Object.keys(await store.all())).toEqual(['ipad-aaaa', 'ipad-bbbb']);
    expect(reads.all).toBe(2);
  });

  it('stops registering iPads at the limit, but existing ones keep uploading', async () => {
    const { request, kiosks } = fakeDb();
    const store = firebaseStore(request);
    for (let i = 0; i < 20; i++) kiosks.set(`ipad-${1000 + i}`, { at: 'x' });
    expect((await handleUsage(post({ kiosk: 'ipad-new1', days: {} }), store)).status).toBe(409);
    expect((await handleUsage(post({ kiosk: 'ipad-1000', days: {} }), store)).status).toBe(200);
  });

  it('answers 502 when Firebase can’t be reached', async () => {
    const store = firebaseStore(() => Promise.reject(new Error('offline')));
    expect((await handleUsage(post({ kiosk: 'ipad-aaaa', days: {} }), store)).status).toBe(502);
    expect((await handleUsage(get(), store)).status).toBe(502);
  });

  it('reads the service account key as JSON or base64, and is off without one', () => {
    const key = JSON.stringify({ project_id: 'demo', client_email: 'a@demo.iam.gserviceaccount.com', private_key: 'line1\\nline2' });
    const want = { projectId: 'demo', clientEmail: 'a@demo.iam.gserviceaccount.com', privateKey: 'line1\nline2' };
    expect(serviceAccountFromEnv({ FIREBASE_SERVICE_ACCOUNT: key })).toEqual(want);
    expect(serviceAccountFromEnv({ FIREBASE_SERVICE_ACCOUNT: Buffer.from(key).toString('base64') })).toEqual(want);
    expect(serviceAccountFromEnv({ FIREBASE_SERVICE_ACCOUNT: '{"project_id":"demo"}' })).toBeNull();
    expect(serviceAccountFromEnv({ FIREBASE_SERVICE_ACCOUNT: 'not a key' })).toBeNull();
    expect(serviceAccountFromEnv({})).toBeNull();
    expect(storeFromEnv({})).toBeNull();
  });
});
