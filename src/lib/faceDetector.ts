/**
 * On-device face detection (MediaPipe Face Detection, short-range model).
 * Runs fully in the browser; the runtime and model are served from
 * /mediapipe/face_detection (copied from node_modules at build time), so it
 * works offline. Nothing is uploaded or stored.
 */

export interface FaceBox {
  /** Normalised 0–1 in the raw (un-mirrored) camera image. */
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
}

interface MPDetection {
  boundingBox: FaceBox;
}
interface MPFaceDetection {
  setOptions(o: { model: 'short' | 'full'; minDetectionConfidence: number }): void;
  onResults(cb: (r: { detections: MPDetection[] }) => void): void;
  initialize(): Promise<void>;
  send(input: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>;
}
declare global {
  interface Window {
    FaceDetection?: new (cfg: { locateFile: (file: string) => string }) => MPFaceDetection;
  }
}

const BASE = '/mediapipe/face_detection/';
let ready: Promise<FaceDetectorApi> | null = null;

export interface FaceDetectorApi {
  detect(image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<FaceBox[]>;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.FaceDetection) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/** Loads the detector once and reuses it for every guest. Rejects if it can't load. */
export function getFaceDetector(): Promise<FaceDetectorApi> {
  if (!ready) {
    ready = (async () => {
      await loadScript(BASE + 'face_detection.js');
      if (!window.FaceDetection) throw new Error('FaceDetection not available');
      const fd = new window.FaceDetection({ locateFile: (f) => BASE + f });
      fd.setOptions({ model: 'short', minDetectionConfidence: 0.6 });
      let pending: ((faces: FaceBox[]) => void) | null = null;
      fd.onResults((r) => {
        pending?.((r.detections ?? []).map((d) => d.boundingBox));
        pending = null;
      });
      await fd.initialize();
      let busy: Promise<FaceBox[]> | null = null;
      return {
        detect(image) {
          if (busy) return busy; // one frame at a time
          busy = new Promise<FaceBox[]>((resolve) => {
            pending = resolve;
            fd.send({ image }).catch(() => resolve([]));
          }).finally(() => {
            busy = null;
          });
          return busy;
        },
      };
    })();
    ready.catch(() => {
      ready = null; // allow a retry on the next guest
    });
  }
  return ready;
}
