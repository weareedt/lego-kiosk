import { useEffect, useRef, useState, type RefObject } from 'react';
import { getFaceDetector } from './faceDetector';
import { evaluateFaces, type FaceState } from './faceFrame';

export type FaceCheck =
  | { mode: 'loading'; state: 'none' }
  | { mode: 'live'; state: FaceState }
  /** Detector couldn't load (old device, blocked files): don't block the guest, but don't claim a face either. */
  | { mode: 'off'; state: 'none' };

const INTERVAL = 150; // ms between checks
const STABLE = 3; // consecutive results needed before the state changes

/** Watches the camera preview and reports whether a face sits inside the head outline. */
export function useFaceCheck(video: RefObject<HTMLVideoElement>, enabled: boolean): FaceCheck {
  const [check, setCheck] = useState<FaceCheck>({ mode: 'loading', state: 'none' });
  const streak = useRef<{ state: FaceState; n: number }>({ state: 'none', n: 0 });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer = 0;

    getFaceDetector()
      .then((det) => {
        if (!alive) return;
        setCheck({ mode: 'live', state: 'none' });
        const tick = async () => {
          const v = video.current;
          if (v && v.readyState >= 2 && v.videoWidth) {
            const faces = await det.detect(v);
            if (!alive) return;
            const s = evaluateFaces(faces, { width: v.videoWidth, height: v.videoHeight });
            const st = streak.current;
            st.n = st.state === s ? st.n + 1 : 1;
            st.state = s;
            if (st.n === STABLE) setCheck({ mode: 'live', state: s });
          }
          if (alive) timer = window.setTimeout(tick, INTERVAL);
        };
        tick();
      })
      .catch((err) => {
        console.warn('[face-check] detector unavailable, camera works without it:', err);
        if (alive) setCheck({ mode: 'off', state: 'none' });
      });

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [enabled, video]);

  return check;
}
