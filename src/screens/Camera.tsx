import { useEffect, useRef } from 'react';
import { BackButton, Chrome } from '../components/Chrome';
import { CameraPreview, useCamera } from '../lib/camera';
import { FACE_HINT } from '../lib/faceFrame';
import { useFaceCheck } from '../lib/useFaceCheck';

/**
 * 03 · Camera. Live preview inside the photo window. On-device face detection
 * guides the guest into the minifig-head outline (green "Perfect" or a hint
 * like "Come a little closer"), but never blocks: Take photo works as soon as
 * the camera is live. The photo is just for fun.
 */
export function Camera(props: { onShoot: () => void; onBack: () => void; onError: () => void }) {
  const cam = useCamera();
  const { start, status } = cam;
  const video = useRef<HTMLVideoElement>(null);
  // Start the camera on arrival (this also replaces a stalled stream, e.g. on Retake),
  // and again if it stops by itself while the guest is here.
  useEffect(() => {
    start();
  }, [start]);
  useEffect(() => {
    if (status === 'idle') start();
  }, [status, start]);
  useEffect(() => {
    if (status === 'denied' || status === 'unavailable') props.onError();
  }, [status, props]);

  const live = status === 'live';
  const face = useFaceCheck(video, live);
  const ok = live && face.state === 'ok';

  // Without a detector the frame never claims "Perfect".
  const noDetector = face.mode === 'off';
  const canShoot = live;
  const hint = !live || face.mode === 'loading'
    ? 'Starting camera…'
    : noDetector
      ? 'Line up your face, then tap Take photo'
      : face.state === 'ok'
        ? null
        : FACE_HINT[face.state];

  return (
    <div className="scr screen-camera">
      <Chrome tab="STEP 2 OF 4" />
      <BackButton onClick={props.onBack} />
      <div className="panel" style={{ top: 236 }}>
        <h1 className="d" style={{ fontSize: 40 }}>Smile for Santa!</h1>
        <p style={{ margin: '8px 0 0', fontSize: 19, fontWeight: 700, color: '#3A3328' }}>Position your face inside the frame.</p>
      </div>
      <div className="win" data-face={face.mode === 'live' ? face.state : face.mode}>
        <CameraPreview className="photo" videoRef={video} />
        {ok ? (
          <>
            <div className="stud ok" />
            <div className="head ok" />
            <div className="chip" style={{ background: '#0B6B3A', color: '#fff' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5 9-10" />
              </svg>
              Perfect — hold that smile!
            </div>
          </>
        ) : (
          <>
            <div className="stud" />
            <div className="head wait" />
            <div className="chip" style={{ background: '#fff', color: '#171717' }}>
              {hint}
            </div>
          </>
        )}
        <span className="live">
          <span className="dot" />
          LIVE
        </span>
      </div>
      <button
        type="button"
        className="pill"
        style={{ left: 162, right: 162, top: 880, opacity: canShoot ? 1 : 0.55 }}
        disabled={!canShoot}
        onClick={props.onShoot}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E3000B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.6" />
        </svg>
        Take photo
      </button>
      <p className="note" style={{ margin: 0 }}>Your photo is only used for your match card.</p>
    </div>
  );
}
