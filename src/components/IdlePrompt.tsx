import { config } from '../lib/config';
import { useTimeout } from '../lib/useIdle';

/**
 * "Still building?" — shown after inactivity on Name, Camera and Confirm.
 * Not blocking: a tap anywhere dismisses it. Starts over if nobody responds.
 */
export function IdlePrompt({ onStay, onStartOver }: { onStay: () => void; onStartOver: () => void }) {
  useTimeout(config.idle.promptCountdown, onStartOver);
  const secs = config.idle.promptCountdown / 1000;
  return (
    <div className="idle" onPointerDown={onStay} role="dialog" aria-label="Still building?">
      <div className="idle-card" onPointerDown={(e) => e.stopPropagation()}>
        <div className="idle-ring" aria-hidden="true">
          <svg width="76" height="76" viewBox="0 0 76 76">
            <circle cx="38" cy="38" r="32" fill="none" stroke="#F3E8CC" strokeWidth="8" />
            <circle
              className="idle-drain"
              cx="38"
              cy="38"
              r="32"
              fill="none"
              stroke="#E3000B"
              strokeWidth="8"
              strokeLinecap="round"
              transform="rotate(-90 38 38)"
              style={{ animationDuration: `${secs}s` }}
            />
          </svg>
        </div>
        <h2 className="d" style={{ fontSize: 40 }}>Still building?</h2>
        <p className="idle-sub">Tap to keep going, or we’ll start over for the next elf.</p>
        <button type="button" className="pill idle-stay" onClick={onStay}>I’m still here</button>
        <button type="button" className="idle-over" onClick={onStartOver}>Start over</button>
      </div>
    </div>
  );
}
