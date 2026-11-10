import QRCode from 'qrcode';
import { config } from './config';
import { CHARACTER_IDS, type CharacterId } from './characters';

/**
 * The QR opens the guest's result page on their phone: /match?s=<session>&c=<character>&n=<name>&t=<time>.
 * By default it points at this same deployment; set VITE_QR_BASE_URL to host it elsewhere.
 */
export function resultUrl(sessionId: string, character: CharacterId, name: string, at: Date = new Date()) {
  const base = config.qrBaseUrl || `${window.location.origin}/match`;
  const url = new URL(base, window.location.origin);
  url.searchParams.set('s', sessionId);
  url.searchParams.set('c', character);
  if (name) url.searchParams.set('n', name);
  url.searchParams.set('t', String(Math.floor(at.getTime() / 1000)));
  return url.toString();
}

export interface ResultParams {
  sessionId: string;
  character: CharacterId;
  name: string | null;
  at: Date | null;
}

/** Parses the result page query string. Returns null if the link is missing or invalid. */
export function parseResult(search: string): ResultParams | null {
  const q = new URLSearchParams(search);
  const s = q.get('s') ?? '';
  const c = q.get('c') as CharacterId | null;
  if (!/^[A-Z0-9]{4,12}$/.test(s) || !c || !CHARACTER_IDS.includes(c)) return null;
  const n = (q.get('n') ?? '').trim().slice(0, config.maxNameLength);
  const t = Number(q.get('t'));
  return { sessionId: s, character: c, name: n || null, at: Number.isFinite(t) && t > 0 ? new Date(t * 1000) : null };
}

export function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, { margin: 1, width: 400, errorCorrectionLevel: 'M', color: { dark: '#171717', light: '#FFFFFF' } });
}

export function newSessionId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
