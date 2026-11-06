import { Chrome } from '../components/Chrome';
import type { Character } from '../lib/characters';
import { config } from '../lib/config';
import { useTimeout } from '../lib/useIdle';

/** 07 · Collect your Stamp Card. Keeps the QR visible for staff, then resets for the next guest. */
export function StampCard(props: { name: string; character: Character; qr: string | null; onFinish: () => void }) {
  useTimeout(config.idle.stampCard, props.onFinish);
  return (
    <div className="scr screen-stampcard">
      <Chrome tab="ALMOST DONE!" />
      <div className="panel" style={{ top: 236 }}>
        <h1 className="d" style={{ fontSize: 42 }}>
          Collect your
          <br />
          Stamp Card!
        </h1>
        <p className="d" style={{ fontSize: 22, marginTop: 10, color: '#0B6B3A' }}>
          Head to the counter, {props.name}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 700, color: '#3A3328' }}>Show your QR code to our team to get your card.</p>
      </div>
      <img className="char" src={props.character.image} alt={`${props.character.name} waving`} />
      <svg className="arrow" viewBox="0 0 80 40" aria-hidden="true">
        <path d="M4 20h60M48 6l16 14-16 14" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="tag">
        <div className="tag-head">YOUR MATCH · {props.character.name.toUpperCase()}</div>
        {props.qr && <img src={props.qr} alt="QR code" style={{ width: 200, height: 200, margin: '16px 0 8px' }} />}
        <span className="tag-foot">SHOW THIS AT THE COUNTER</span>
      </div>
      <button type="button" className="pill" style={{ left: 162, right: 162, top: 918 }} onClick={props.onFinish}>
        Finish
      </button>
      <div className="rst">
        <svg width="32" height="32" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="14" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="5" />
          <circle
            className="ring"
            cx="17"
            cy="17"
            r="14"
            fill="none"
            stroke="#FFD500"
            strokeWidth="5"
            transform="rotate(-90 17 17)"
            style={{ animationDuration: `${config.idle.stampCard / 1000}s`, animationIterationCount: 1, animationFillMode: 'forwards' }}
          />
        </svg>
        Starting over for the next elf…
      </div>
    </div>
  );
}
