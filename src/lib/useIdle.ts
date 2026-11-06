import { useEffect, useRef } from 'react';

/**
 * Calls `onIdle` after `ms` without any pointer or key activity.
 * Pass `ms = null` to disable. Activity anywhere on the page restarts the timer.
 */
export function useIdle(ms: number | null, onIdle: () => void) {
  const cb = useRef(onIdle);
  cb.current = onIdle;

  useEffect(() => {
    if (ms == null) return;
    let t = window.setTimeout(() => cb.current(), ms);
    const reset = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => cb.current(), ms);
    };
    const events = ['pointerdown', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [ms]);
}

/** Runs `fn` once after `ms`. */
export function useTimeout(ms: number | null, fn: () => void) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const t = window.setTimeout(() => cb.current(), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
}
