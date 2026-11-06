import { BackButton, Chrome } from '../components/Chrome';
import { config } from '../lib/config';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', '-ZXCVBNM'];

/** 02 · Name. Custom on-screen keyboard (no system keyboard on the kiosk). */
export function Name(props: {
  name: string;
  onChange: (name: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const { name, onChange } = props;
  const set = (v: string) => onChange(v.slice(0, config.maxNameLength));
  const hasName = name.trim().length > 0;

  return (
    <div className="scr screen-name">
      <Chrome tab="STEP 1 OF 4" />
      <BackButton onClick={props.onBack} />
      <div className="panel" style={{ top: 236 }}>
        <h1 className="d" style={{ fontSize: 36 }}>What should we call you?</h1>
        <div className="field">
          <span className="d" style={{ fontSize: 50, letterSpacing: 1 }}>
            {name}
            <span className="caret" />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#7A6F5E' }}>
            {name.length} / {config.maxNameLength}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="pill"
        style={{ left: 162, right: 162, top: 449, opacity: hasName ? 1 : 0.55 }}
        disabled={!hasName}
        onClick={props.onContinue}
      >
        Continue
      </button>
      <button type="button" className="skip" onClick={props.onSkip}>
        Skip — call me {config.fallbackName}
      </button>
      <div className="kb" aria-label="On-screen keyboard">
        {ROWS.map((row, i) => (
          <div className="row" key={row}>
            {row.split('').map((l) => (
              <button type="button" className="k" key={l} onClick={() => set(name + l)}>
                {l}
              </button>
            ))}
            {i === 2 && (
              <button type="button" className="k" style={{ width: 127 }} aria-label="Delete" onClick={() => set(name.slice(0, -1))}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 5H9l-6 7 6 7h12z" />
                  <path d="M17 9l-5 6M12 9l5 6" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <div className="row">
          <button type="button" className="k" onClick={() => set(name + '’')}>’</button>
          <button
            type="button"
            className="k"
            style={{ width: 400, fontSize: 17, letterSpacing: 2 }}
            onClick={() => name.length && !name.endsWith(' ') && set(name + ' ')}
          >
            SPACE
          </button>
          <button type="button" className="k" style={{ width: 194, fontSize: 17, letterSpacing: 2 }} onClick={() => set('')}>
            CLEAR
          </button>
        </div>
      </div>
    </div>
  );
}
