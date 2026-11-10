import { describe, expect, it } from 'vitest';
import { newSessionId, parseResult, qrDataUrl, resultUrl } from '../../src/lib/qr';

describe('QR result link', () => {
  it('round-trips session, character, name and time', () => {
    const at = new Date('2026-12-01T10:30:00Z');
    const url = new URL(resultUrl('AB12CD', 'santa', 'ANNA', at));
    expect(url.origin + url.pathname).toBe('https://kiosk.test/match');
    const r = parseResult(url.search);
    expect(r).toEqual({ sessionId: 'AB12CD', character: 'santa', name: 'ANNA', at });
  });

  it('leaves the name out when the guest skipped it', () => {
    const url = new URL(resultUrl('AB12CD', 'yeti', ''));
    expect(url.searchParams.has('n')).toBe(false);
    expect(parseResult(url.search)?.name).toBeNull();
  });

  it('rejects broken or tampered links', () => {
    expect(parseResult('')).toBeNull();
    expect(parseResult('?s=AB12CD')).toBeNull();
    expect(parseResult('?s=AB12CD&c=grinch')).toBeNull();
    expect(parseResult('?s=<script>&c=santa')).toBeNull();
  });

  it('caps the name at 12 characters', () => {
    expect(parseResult('?s=AB12CD&c=santa&n=ABCDEFGHIJKLMNOP')?.name).toBe('ABCDEFGHIJKL');
  });

  it('makes readable session ids (no 0/O/1/I)', () => {
    for (let i = 0; i < 200; i++) expect(newSessionId()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('renders a PNG QR code', async () => {
    expect(await qrDataUrl('https://kiosk.test/match?s=AB12CD&c=santa')).toMatch(/^data:image\/png;base64,/);
  });
});
