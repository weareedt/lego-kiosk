import QRCode from 'qrcode';
import { config } from './config';
import type { CharacterId } from './characters';

export function resultUrl(sessionId: string, character: CharacterId) {
  const url = new URL(config.qrBaseUrl);
  url.searchParams.set('s', sessionId);
  url.searchParams.set('c', character);
  return url.toString();
}

export function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, { margin: 1, width: 400, errorCorrectionLevel: 'M', color: { dark: '#171717', light: '#FFFFFF' } });
}

export function newSessionId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
