import { describe, expect, it } from 'vitest';
import { evaluateFaces } from '../../src/lib/faceFrame';

// A 640×480 camera shown in the 636×440 window (object-fit: cover, mirrored).
const cam = { width: 640, height: 480 };
// Face centred in the head outline at a comfortable size.
const centred = { xCenter: 0.5, yCenter: 0.5, width: 0.3, height: 0.4 };

describe('face-in-frame check', () => {
  it('no faces → none', () => {
    expect(evaluateFaces([], cam)).toBe('none');
  });

  it('a centred face at a good distance → ok', () => {
    expect(evaluateFaces([centred], cam)).toBe('ok');
  });

  it('too small → closer, too big → back', () => {
    expect(evaluateFaces([{ ...centred, width: 0.08 }], cam)).toBe('closer');
    expect(evaluateFaces([{ ...centred, width: 0.6 }], cam)).toBe('back');
  });

  it('accounts for the mirrored preview when giving left/right hints', () => {
    // xCenter 0.85 in the raw image shows on the LEFT of the mirrored preview,
    // so the guest should move to their right.
    expect(evaluateFaces([{ ...centred, xCenter: 0.85 }], cam)).toBe('right');
    expect(evaluateFaces([{ ...centred, xCenter: 0.15 }], cam)).toBe('left');
  });

  it('too high → move down, too low → move up', () => {
    expect(evaluateFaces([{ ...centred, yCenter: 0.12 }], cam)).toBe('down');
    expect(evaluateFaces([{ ...centred, yCenter: 0.88 }], cam)).toBe('up');
  });

  it('groups are fine: one face in the outline is enough', () => {
    expect(evaluateFaces([{ ...centred, xCenter: 0.1 }, centred, { ...centred, xCenter: 0.9 }], cam)).toBe('ok');
  });

  it('ignores a video that has no size yet', () => {
    expect(evaluateFaces([centred], { width: 0, height: 0 })).toBe('none');
  });
});
