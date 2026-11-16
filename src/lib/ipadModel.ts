/**
 * Portrait screen sizes of iPads in CSS points, at the default Display Zoom. Several models
 * share a size, so this names the size class, not the exact model.
 */
const SIZES: [short: number, long: number, name: string][] = [
  [744, 1133, 'iPad mini'],
  [768, 1024, 'iPad 9.7-inch / older mini'],
  [810, 1080, 'iPad 10.2-inch'],
  [820, 1180, 'iPad / iPad Air 11-inch'],
  [834, 1112, 'iPad 10.5-inch'],
  [834, 1194, 'iPad Pro 11-inch'],
  [834, 1210, 'iPad Pro 11-inch (M4)'],
  [1024, 1366, 'iPad 13-inch'],
  [1032, 1376, 'iPad Pro 13-inch (M4)'],
];

/** The likely iPad for a screen size (either orientation), or null if it isn't a known one. */
export function ipadName(screen: readonly [number, number]): string | null {
  const short = Math.min(...screen);
  const long = Math.max(...screen);
  return SIZES.find(([s, l]) => s === short && l === long)?.[2] ?? null;
}
