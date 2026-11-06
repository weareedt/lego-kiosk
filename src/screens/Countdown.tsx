import { useEffect, useRef, useState } from 'react';
import { Chrome } from '../components/Chrome';
import { CameraPreview } from '../lib/camera';
import { config } from '../lib/config';

/** 03b · 3-2-1 countdown, then a white flash and capture. */
export function Countdown({ onCapture }: { onCapture: () => void }) {
  const total = config.countdownSeconds;
  const [n, setN] = useState<number>(total);
  const [flash, setFlash] = useState(false);
  const done = useRef(false);
  const capture = useRef(onCapture);
  capture.current = onCapture;

  useEffect(() => {
    if (n > 0) {
      const t = window.setTimeout(() => setN(n - 1), 1000);
      return () => window.clearTimeout(t);
    }
    if (done.current) return;
    done.current = true;
    setFlash(true);
    capture.current();
  }, [n]);

  const lit = total - n; // how many lights are on
  return (
    <div className="scr screen-countdown" aria-label="Countdown, continues automatically">
      <Chrome tab="STEP 2 OF 4" />
      <div className="panel" style={{ top: 236 }}>
        <h1 className="d" style={{ fontSize: 40 }}>Big smile!</h1>
        <p style={{ margin: '8px 0 0', fontSize: 19, fontWeight: 700, color: '#3A3328' }}>Hold still…</p>
      </div>
      <div className="win">
        <CameraPreview className="photo" />
        <div className="stud" />
        <div className="head" />
        {n > 0 && (
          <span key={n} className="num num-live">
            {n}
          </span>
        )}
        {flash && <span className="flash flash-live" />}
      </div>
      <div className="lights" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const on = i <= lit;
          const last = i === total - 1;
          return (
            <span key={i} className="lt" style={on ? { background: last ? '#0B6B3A' : '#E3000B', color: '#fff' } : undefined}>
              {total - i}
            </span>
          );
        })}
      </div>
    </div>
  );
}
