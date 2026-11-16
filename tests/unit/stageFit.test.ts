import { describe, expect, it } from 'vitest';
import { fillArt, fitStage } from '../../src/lib/stageFit';

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

describe('filling a wider screen with the Welcome artwork', () => {
  const art = { cropTop: 96, cropBottom: 14, maxStretch: 1.035 };
  /** What ends up on screen, in rows/columns of the artwork and stage pixels. */
  const shown = (w: number, h: number) => {
    const fit = fitStage(w, h, canvas);
    const fill = fillArt(fit, art, canvas);
    const top = -fill.offsetY / fill.scaleY; // first artwork row on screen
    const bottom = top + canvas.height / fill.scaleY; // last artwork row on screen
    return { fit, fill, top, bottom, covered: canvas.width * fill.scaleX };
  };

  it('iPad mini: the artwork is untouched', () => {
    expect(fillArt(fitStage(744, 1133, canvas), art, canvas)).toEqual({ scaleX: 1, scaleY: 1, offsetY: 0 });
  });

  it.each([
    ['iPad 11-inch', 834, 1194],
    ['iPad 10.9-inch', 820, 1180],
    ['iPad 11-inch (M4)', 834, 1210],
  ])('%s: fills the width by cropping only, no stretch', (_name, w, h) => {
    const s = shown(w, h);
    expect(s.fill.scaleX).toBe(s.fill.scaleY);
    expect(s.covered).toBeCloseTo(s.fit.width, 6);
    expect(s.top).toBeLessThanOrEqual(art.cropTop);
    expect(s.bottom).toBeGreaterThanOrEqual(canvas.height - art.cropBottom);
  });

  it.each([
    ['iPad 10.2-inch', 810, 1080],
    ['iPad Pro 13-inch', 1032, 1376],
  ])('%s (3:4): fills the width with the full crop and a slight stretch', (_name, w, h) => {
    const s = shown(w, h);
    expect(s.covered).toBeCloseTo(s.fit.width, 6);
    expect(s.top).toBeCloseTo(art.cropTop, 6);
    expect(s.bottom).toBeCloseTo(canvas.height - art.cropBottom, 6);
    expect(s.fill.scaleX / s.fill.scaleY).toBeGreaterThan(1);
    expect(s.fill.scaleX / s.fill.scaleY).toBeLessThanOrEqual(art.maxStretch);
  });

  it('a much wider screen: never crops or stretches past the limits, the rest is background', () => {
    const s = shown(1200, 900);
    expect(s.top).toBeCloseTo(art.cropTop, 6);
    expect(s.bottom).toBeCloseTo(canvas.height - art.cropBottom, 6);
    expect(s.fill.scaleX / s.fill.scaleY).toBeCloseTo(art.maxStretch, 6);
    expect(s.covered).toBeLessThan(s.fit.width);
  });

  it('a taller, narrower screen: the artwork is untouched', () => {
    expect(fillArt(fitStage(390, 844, canvas), art, canvas)).toEqual({ scaleX: 1, scaleY: 1, offsetY: 0 });
  });
});
