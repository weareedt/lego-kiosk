import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { config } from './config';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable';

interface CameraApi {
  status: CameraStatus;
  stream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Grabs a mirrored JPEG still from the live stream (as a data URL). */
  capture: () => string | null;
}

const CameraContext = createContext<CameraApi | null>(null);

/**
 * Owns the camera stream so it survives from the Camera screen through the
 * countdown without restarting. Stopped on reset.
 */
export function CameraProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const active = useRef<MediaStream | null>(null);
  const starting = useRef(false);

  const start = useCallback(async () => {
    if (active.current || starting.current) return;
    starting.current = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      starting.current = false;
      return;
    }
    setStatus('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: config.camera.width }, height: { ideal: config.camera.height } },
      });
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.srcObject = s;
      await v.play().catch(() => undefined);
      video.current = v;
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

  const stop = useCallback(() => {
    active.current?.getTracks().forEach((t) => t.stop());
    active.current = null;
    video.current = null;
    setStream(null);
    setStatus('idle');
  }, []);

  const capture = useCallback(() => {
    const v = video.current;
    if (!v || !v.videoWidth) return null;
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

  useEffect(() => () => active.current?.getTracks().forEach((t) => t.stop()), []);

  return <CameraContext.Provider value={{ status, stream, start, stop, capture }}>{children}</CameraContext.Provider>;
}

export function useCamera() {
  const ctx = useContext(CameraContext);
  if (!ctx) throw new Error('useCamera must be used inside <CameraProvider>');
  return ctx;
}

/** A mirrored live preview bound to the shared stream. */
export function CameraPreview({ className }: { className?: string }) {
  const { stream } = useCamera();
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => undefined);
    }
  }, [stream]);
  return <video ref={ref} className={className} muted playsInline autoPlay style={{ transform: 'scaleX(-1)' }} />;
}
