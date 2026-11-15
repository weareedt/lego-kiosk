#!/usr/bin/env node
/**
 * One-off: copies the kiosk usage snapshots from the old Upstash Redis database
 * into Firebase (Realtime Database). See server/usage.ts for the layout.
 *
 *   node scripts/migrate-usage-to-firebase.mjs [source] [--key <file>] [--dry-run]
 *
 * source (first match wins):
 *   a URL        GET that /api/usage (a deployment still on Redis). Sends STATS_KEY if set.
 *   a file       JSON saved from /api/usage
 *   (nothing)    Redis itself, if KV_REST_API_URL and KV_REST_API_TOKEN are set
 *
 * Firebase: --key <service account key file>, or FIREBASE_SERVICE_ACCOUNT.
 * FIREBASE_DATABASE_URL picks another database than the project's own.
 *
 * A snapshot already in Firebase is only replaced by a newer one, so this is
 * safe to run at any time and more than once (before and after the switch).
 * Needs Node 22.18+ (it imports server/usage.ts directly).
 */
import { existsSync, readFileSync } from 'node:fs';
import { DATABASE_URL, ROOT, cleanDays, serviceAccountFromEnv, storeFromEnv } from '../server/usage.ts';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
let keyFile;
let source;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key') keyFile = args[++i];
  else if (!args[i].startsWith('--')) source ??= args[i];
}

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

/** → { <kiosk id>: { at, days } } as stored by the old database. */
async function readOld() {
  if (source && /^https?:\/\//.test(source)) {
    const res = await fetch(source, { headers: process.env.STATS_KEY ? { 'x-stats-key': process.env.STATS_KEY } : {} });
    if (!res.ok) fail(`${source} answered ${res.status}`);
    return (await res.json()).kiosks ?? {};
  }
  if (source) {
    if (!existsSync(source)) fail(`No such file: ${source}`);
    return JSON.parse(readFileSync(source, 'utf8')).kiosks ?? {};
  }
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) fail('Give a source: an /api/usage URL, a saved JSON file, or set KV_REST_API_URL and KV_REST_API_TOKEN.');
  const res = await fetch(`${url.replace(/\/+$/, '')}/hgetall/lego-kiosk:usage`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) fail(`Redis answered ${res.status}`);
  const flat = (await res.json()).result ?? [];
  const kiosks = {};
  for (let i = 0; i + 1 < flat.length; i += 2) {
    try {
      kiosks[flat[i]] = JSON.parse(flat[i + 1]);
    } catch {
      console.warn(`skipped ${flat[i]}: not JSON`);
    }
  }
  return kiosks;
}

const env = keyFile ? { ...process.env, FIREBASE_SERVICE_ACCOUNT: readFileSync(keyFile, 'utf8') } : process.env;
const account = serviceAccountFromEnv(env);
if (!account) fail('No Firebase key: pass --key <service account key file> or set FIREBASE_SERVICE_ACCOUNT.');

const old = await readOld();
const store = storeFromEnv(env);
const now = await store.all();
const guests = (days) => Object.values(days).reduce((n, c) => n + (c.start ?? 0), 0);

console.log(`${Object.keys(old).length} kiosks in the old database → ${env.FIREBASE_DATABASE_URL || DATABASE_URL}/${ROOT}${dryRun ? ' (dry run)' : ''}`);
let copied = 0;
for (const [id, snap] of Object.entries(old)) {
  const days = cleanDays(snap?.days);
  if (!days || typeof snap.at !== 'string') {
    console.log(`  ${id}: skipped (not a snapshot)`);
    continue;
  }
  const there = String(now[id]?.at ?? '');
  if (there >= snap.at) {
    console.log(`  ${id}: kept Firebase copy (${there})`);
    continue;
  }
  if (!dryRun) await store.put(id, { at: snap.at, days });
  copied++;
  console.log(`  ${id}: ${dryRun ? 'would copy' : 'copied'} ${Object.keys(days).length} days, ${guests(days)} guests (${snap.at})`);
}
console.log(`${dryRun ? 'Would copy' : 'Copied'} ${copied} of ${Object.keys(old).length}.`);
