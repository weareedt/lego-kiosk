import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { config } from './config';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable';

interface CameraApi {
  status: CameraStatus;
  stream: MediaStream | null;
  /** Starts the camera, or restarts it if the previous stream has died. */
  start: () => Promise<void>;
  stop: () => void;
  /** Grabs a mirrored JPEG still (data URL) from the on-screen preview, or null if the frame is blank. */
  capture: () => string | null;
  /** Lets the visible preview register itself, so stills come from what the guest sees. */
  registerPreview: (v: HTMLVideoElement | null) => void;
}

const CameraContext = createContext<CameraApi | null>(null);

/** A stream is usable if it has a running, unmuted video track (muted tracks only deliver black frames). */
const isLive = (s: MediaStream | null) => !!s && s.getVideoTracks().some((t) => t.readyState === 'live' && !t.muted);

/** True if a frame is (nearly) all black, e.g. a camera that has stalled or been muted. */
function isBlank(source: CanvasImageSource) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 24;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, 32, 24);
  const d = ctx.getImageData(0, 0, 32, 24).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
  return sum / (d.length / 4) / 3 < 6;
}

/**
 * Owns the camera stream so it survives from the Camera screen through the
 * countdown and a Retake without restarting. If the stream dies (camera
 * unplugged, another app grabs it, iOS suspends it), it is restarted on the
 * next `start()`. Stopped on reset.
 */
export function CameraProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const active = useRef<MediaStream | null>(null);
  const preview = useRef<HTMLVideoElement | null>(null);
  const starting = useRef(false);

  const stop = useCallback(() => {
    active.current?.getTracks().forEach((t) => t.stop());
    active.current = null;
    setStream(null);
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    if (starting.current) return;
    if (isLive(active.current)) return;
    // A dead stream (ended track): throw it away and ask for a fresh one.
    if (active.current) {
      active.current.getTracks().forEach((t) => t.stop());
      active.current = null;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    starting.current = true;
    setStatus('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: config.camera.width }, height: { ideal: config.camera.height } },
      });
      // If the camera stops by itself, drop back to idle so the Camera screen restarts it.
      s.getVideoTracks().forEach((t) =>
        t.addEventListener('ended', () => {
          if (active.current === s) {
            active.current = null;
            setStream(null);
            setStatus('idle');
          }
        }),
      );
      active.current = s;
      setStream(s);
      setStatus('live');
    } catch (err) {
      const name = (err as DOMException)?.name;
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    } finally {
      starting.current = false;
    }
  }, []);

  const capture = useCallback(() => {
    const v = preview.current;
    if (!v || !v.videoWidth || v.readyState < 2 || !isLive(active.current)) return null;
    if (isBlank(v)) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1); // match the mirrored preview
    ctx.drawImage(v, 0, 0);
    return c.toDataURL('image/jpeg', config.camera.quality);
  }, []);

  const registerPreview = useCallback((v: HTMLVideoElement | null) => {
    if (v) preview.current = v;
  }, []);

  useEffect(() => () => active.current?.getTracks().forEach((t) => t.stop()), []);

  return <CameraContext.Provider value={{ status, stream, start, stop, capture, registerPreview }}>{children}</CameraContext.Provider>;
}

export function useCamera() {
  const ctx = useContext(CameraContext);
  if (!ctx) throw new Error('useCamera must be used inside <CameraProvider>');
  return ctx;
}

/** A mirrored live preview bound to the shared stream. Stills are taken from this element. */
export function CameraPreview({ className, videoRef }: { className?: string; videoRef?: RefObject<HTMLVideoElement> }) {
  const { stream, registerPreview } = useCamera();
  const own = useRef<HTMLVideoElement>(null);
  const ref = videoRef ?? own;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    registerPreview(v);
    if (stream && v.srcObject !== stream) v.srcObject = stream;
    if (stream) v.play().catch(() => undefined);
  }, [stream, ref, registerPreview]);
  return <video ref={ref} className={className} muted playsInline autoPlay style={{ transform: 'scaleX(-1)' }} />;
}
