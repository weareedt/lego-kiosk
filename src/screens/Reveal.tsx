import { Chrome } from '../components/Chrome';
import type { Character } from '../lib/characters';
import { config } from '../lib/config';
import { useIdle } from '../lib/useIdle';

const CONFETTI = [
  { left: 40, bg: '#E3000B', dur: 5, delay: 0 },
  { left: 130, bg: '#00852B', dur: 6.5, delay: 1 },
  { left: 220, bg: '#fff', dur: 5.6, delay: 2.2 },
  { left: 310, bg: '#0B6FD6', dur: 7, delay: 0.4 },
  { left: 420, bg: '#E3000B', dur: 6, delay: 3 },
  { left: 520, bg: '#00852B', dur: 5.3, delay: 1.6 },
  { left: 610, bg: '#fff', dur: 6.8, delay: 2.6 },
  { left: 700, bg: '#0B6FD6', dur: 5.9, delay: 0.8 },
];

/** 06 · Character reveal + QR. Moves on to the Stamp Card screen on Done or after idle. */
export function Reveal(props: { name: string; character: Character; qr: string | null; onDone: () => void }) {
  const c = props.character;
  useIdle(config.idle.reveal, props.onDone);
  return (
    <div className="scr screen-reveal">
      <Chrome tab="STEP 4 OF 4">
        {CONFETTI.map((f) => (
          <span key={f.left} className="cf" style={{ left: f.left, background: f.bg, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }} />
        ))}
      </Chrome>
      <p className="pre" style={{ margin: 0 }}>
        {props.name}, your LEGO festive match is…
      </p>
      <div className="glow" style={{ background: c.color }} />
      <div className="rays" />
      <img className="char" src={c.image} alt={c.name} />
      <div className="np">
        <h1 className="d ext" style={{ fontSize: 52 }}>{c.name}</h1>
        <span className="title" style={{ background: c.deep }}>{c.title}</span>
        <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.35, fontWeight: 700, color: '#3A2A00' }}>{c.quote}</p>
      </div>
      <div className="qr">
        {props.qr && <img src={props.qr} alt="QR code to save your match" />}
        <div>
          <p className="d" style={{ fontSize: 24, lineHeight: 1 }}>
            Scan to save
            <br />
            your match
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 700, color: '#4A4135', lineHeight: 1.3 }}>
            Save it · Send it to your phone · Redeem at the booth
          </p>
        </div>
      </div>
      <button type="button" className="pill2" style={{ left: 96, right: 96, top: 1002 }} onClick={props.onDone}>
        Done
      </button>
    </div>
  );
}
