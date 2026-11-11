import { Chrome } from '../components/Chrome';
import type { Character } from '../lib/characters';
import { config } from '../lib/config';
import { useTimeout } from '../lib/useIdle';

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

/**
 * 06 · Reveal + collect (the final screen; Reveal and Stamp Card combined).
 * The character reveal, then one clear next step: scan the QR to save the
 * card, and show it at the counter for the Stamp Card. There is no guest
 * "Done" button to walk away on: the screen stays up, then resets itself.
 * Staff can tap the small Finish button to reset early.
 */
export function Reveal(props: { name: string; character: Character; qr: string | null; qrHref?: string | null; onFinish: () => void }) {
  const c = props.character;
  useTimeout(config.idle.final, props.onFinish);
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
        <h1 className="d ext" style={{ fontSize: 60 }}>{c.name}</h1>
      </div>

      <section className="collect" aria-label="Collect your Stamp Card">
        <div className="collect-head">COLLECT YOUR STAMP CARD</div>
        <div className="collect-body">
          <div className="collect-qr">{props.qr && <img src={props.qr} data-href={props.qrHref ?? undefined} alt="QR code to save your match card" />}</div>
          <ol className="collect-steps">
            <li>
              <b>1</b>
              <span>
                <strong>Scan</strong> to save your match card
              </span>
            </li>
            <li>
              <b>2</b>
              <span>
                <strong>Show it at the counter</strong> to get your Stamp Card
              </span>
            </li>
          </ol>
        </div>
      </section>

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
            style={{ animationDuration: `${config.idle.final / 1000}s` }}
          />
        </svg>
        Starting over for the next elf…
      </div>
      <button type="button" className="staff-finish" onClick={props.onFinish} aria-label="Finish (staff)">
        Finish
      </button>
    </div>
  );
}
