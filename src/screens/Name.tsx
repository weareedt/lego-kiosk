import { useEffect, useRef, useState } from 'react';
import { BackButton, Chrome } from '../components/Chrome';
import { config } from '../lib/config';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', '-ZXCVBNM'];

/**
 * 02 · Name. Custom on-screen keyboard: there is no text input, so the iPad's
 * system keyboard never opens. A physical keyboard also works (handy for
 * testing on a laptop): letters, space, ' and -, Backspace, Enter to continue.
 */
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

  // Briefly highlight the on-screen key that matches a physical key press.
  const [hit, setHit] = useState<string | null>(null);
  const latest = useRef({ name, set, hasName, onContinue: props.onContinue });
  latest.current = { name, set, hasName, onContinue: props.onContinue };

  useEffect(() => {
    let t = 0;
    const flash = (key: string) => {
      setHit(key);
      window.clearTimeout(t);
      t = window.setTimeout(() => setHit(null), 140);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const { name: n, set: put, hasName: ok, onContinue } = latest.current;
      const k = e.key;
      if (/^[a-z]$/i.test(k)) {
        put(n + k.toUpperCase());
        flash(k.toUpperCase());
      } else if (k === '-') {
        put(n + '-');
        flash('-');
      } else if (k === "'" || k === '’') {
        put(n + '’');
        flash('’');
      } else if (k === ' ') {
        if (n.length && !n.endsWith(' ')) put(n + ' ');
        flash('SPACE');
      } else if (k === 'Backspace') {
        put(n.slice(0, -1));
        flash('DEL');
      } else if (k === 'Enter') {
        if (ok) onContinue();
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, []);
  const hitClass = (key: string) => (hit === key ? 'k k-hit' : 'k');

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
              <button type="button" className={hitClass(l)} key={l} onClick={() => set(name + l)}>
                {l}
              </button>
            ))}
            {i === 2 && (
              <button type="button" className={hitClass('DEL')} style={{ width: 127 }} aria-label="Delete" onClick={() => set(name.slice(0, -1))}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 5H9l-6 7 6 7h12z" />
                  <path d="M17 9l-5 6M12 9l5 6" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <div className="row">
          <button type="button" className={hitClass('’')} onClick={() => set(name + '’')}>’</button>
          <button
            type="button"
            className={hitClass('SPACE')}
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
