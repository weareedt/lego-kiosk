import { config } from './config';

export interface StageFit {
  /** Scale that makes the design canvas as large as fits on the screen. */
  scale: number;
  /** Stage size in canvas pixels: the canvas plus the bleed, so it has the screen's shape. */
  width: number;
  height: number;
  /** Extra space either side of the canvas (left = right, top = bottom), in canvas pixels. */
  bleedX: number;
  bleedY: number;
}

/**
 * Fits the design canvas to a screen of any shape. The canvas keeps its aspect ratio and
 * sits in the middle; the stage grows around it to cover the whole screen, so a wider iPad
 * (or Safari with its toolbar showing) gets background on both sides instead of bars.
 */
export function fitStage(viewWidth: number, viewHeight: number, canvas: { width: number; height: number } = config.stage): StageFit {
  const byWidth = viewWidth / canvas.width;
  const byHeight = viewHeight / canvas.height;
  const scale = Math.min(byWidth, byHeight);
  if (!(scale > 0) || !Number.isFinite(scale)) return { scale: 1, width: canvas.width, height: canvas.height, bleedX: 0, bleedY: 0 };
  // The tighter side fits exactly; the other one gets the bleed.
  const width = byWidth <= byHeight ? canvas.width : viewWidth / scale;
  const height = byHeight <= byWidth ? canvas.height : viewHeight / scale;
  return { scale, width, height, bleedX: (width - canvas.width) / 2, bleedY: (height - canvas.height) / 2 };
}
