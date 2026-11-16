import { describe, expect, it } from 'vitest';
import { fitStage } from '../../src/lib/stageFit';

const canvas = { width: 744, height: 1133 };

describe('fitting the design canvas to the screen', () => {
  it('iPad mini, the design size: no scaling and no bleed', () => {
    expect(fitStage(744, 1133, canvas)).toEqual({ scale: 1, width: 744, height: 1133, bleedX: 0, bleedY: 0 });
  });

  it.each([
    ['iPad 11-inch', 834, 1194],
    ['iPad 10.9-inch', 820, 1180],
    ['iPad 10.2-inch', 810, 1080],
    ['iPad Pro 13-inch', 1032, 1376],
    ['iPad mini in a Safari tab (toolbar showing)', 744, 1040],
  ])('%s: the stage covers the whole screen, canvas centred', (_name, w, h) => {
    const fit = fitStage(w, h, canvas);
    // wider than the canvas: full height, background either side
    expect(fit.scale).toBeCloseTo(h / canvas.height, 6);
    expect(fit.height).toBe(canvas.height);
    expect(fit.bleedY).toBe(0);
    expect(fit.bleedX).toBeGreaterThan(0);
    // stage × scale = screen, so nothing is left uncovered
    expect(fit.width * fit.scale).toBeCloseTo(w, 6);
    expect(fit.height * fit.scale).toBeCloseTo(h, 6);
    expect(fit.width).toBeCloseTo(canvas.width + 2 * fit.bleedX, 6);
  });

  it('a taller, narrower screen bleeds top and bottom instead', () => {
    const fit = fitStage(390, 844, canvas);
    expect(fit.scale).toBeCloseTo(390 / 744, 6);
    expect(fit.bleedX).toBe(0);
    expect(fit.bleedY).toBeGreaterThan(0);
    expect(fit.height * fit.scale).toBeCloseTo(844, 6);
  });

  it('a screen with no size yet falls back to the plain canvas', () => {
    expect(fitStage(0, 0, canvas)).toEqual({ scale: 1, width: 744, height: 1133, bleedX: 0, bleedY: 0 });
  });
});
