import { describe, expect, it } from 'vitest';
import { ipadName } from '../../src/lib/ipadModel';

describe('naming an iPad from its screen size', () => {
  it('knows the common sizes, in either orientation', () => {
    expect(ipadName([744, 1133])).toBe('iPad mini');
    expect(ipadName([1133, 744])).toBe('iPad mini');
    expect(ipadName([1024, 1366])).toBe('iPad 13-inch');
    expect(ipadName([834, 1194])).toBe('iPad Pro 11-inch');
  });

  it('says nothing for a size it does not know (a laptop, a zoomed display)', () => {
    expect(ipadName([1680, 1050])).toBeNull();
    expect(ipadName([700, 1000])).toBeNull();
  });
});
