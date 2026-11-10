import type { FaceBox } from './faceDetector';

export type FaceState = 'none' | 'left' | 'right' | 'up' | 'down' | 'closer' | 'back' | 'ok';

export interface FrameGeometry {
  /** Visible camera window (inside the white border), in CSS px. */
  viewW: number;
  viewH: number;
  /** object-position of the video (0–1). */
  posX: number;
  posY: number;
  /** The minifig-head outline, in the same coordinates as the window. */
  head: { x: number; y: number; w: number; h: number };
}

/** Matches .win / .head in kiosk.css (Camera screen). */
export const CAMERA_FRAME: FrameGeometry = {
  viewW: 636,
  viewH: 440,
  posX: 0.5,
  posY: 0.4,
  head: { x: 203, y: 92, w: 230, h: 270 },
};

/** Face width (on screen) that counts as a good distance. */
const MIN_FACE_W = 90;
const MAX_FACE_W = 270;

/**
 * Decides whether a guest's face sits nicely inside the head outline.
 * Pure function: detections are in raw camera coordinates, the preview is
 * mirrored and object-fit: cover, so we map each face into screen space first.
 * Groups are welcome: any one face in the outline is enough.
 */
export function evaluateFaces(faces: FaceBox[], video: { width: number; height: number }, g: FrameGeometry = CAMERA_FRAME): FaceState {
  if (!faces.length || !video.width || !video.height) return 'none';
  const s = Math.max(g.viewW / video.width, g.viewH / video.height);
  const w = video.width * s;
  const h = video.height * s;
  const ox = (g.viewW - w) * g.posX;
  const oy = (g.viewH - h) * g.posY;

  // Allowed zone for the face centre: the head outline shrunk by 15% each side.
  const inX = g.head.w * 0.15;
  const inY = g.head.h * 0.15;
  const zone = { l: g.head.x + inX, r: g.head.x + g.head.w - inX, t: g.head.y + inY, b: g.head.y + g.head.h - inY };
  const headCx = g.head.x + g.head.w / 2;
  const headCy = g.head.y + g.head.h / 2;

  // Judge the face closest to the centre of the outline.
  const mapped = faces
    .map((f) => ({ cx: ox + (1 - f.xCenter) * w, cy: oy + f.yCenter * h, fw: f.width * w }))
    .sort((a, b) => Math.hypot(a.cx - headCx, a.cy - headCy) - Math.hypot(b.cx - headCx, b.cy - headCy));
  const f = mapped[0];

  if (f.fw < MIN_FACE_W) return 'closer';
  if (f.fw > MAX_FACE_W) return 'back';
  // Mirrored preview: a face shown left of the outline needs to move to the guest's right.
  if (f.cx < zone.l) return 'right';
  if (f.cx > zone.r) return 'left';
  if (f.cy < zone.t) return 'down';
  if (f.cy > zone.b) return 'up';
  return 'ok';
}

export const FACE_HINT: Record<Exclude<FaceState, 'ok'>, string> = {
  none: 'Move into the frame',
  left: 'Move a little to your left',
  right: 'Move a little to your right',
  up: 'Move up a little',
  down: 'Move down a little',
  closer: 'Come a little closer',
  back: 'Step back a little',
};
