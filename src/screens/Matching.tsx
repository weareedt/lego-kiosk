import { Chrome } from '../components/Chrome';
import { CHARACTER_IDS, CHARACTERS } from '../lib/characters';
import { config } from '../lib/config';
import { useTimeout } from '../lib/useIdle';

const STEPS = ['Scanning your festive energy', 'Checking Santa’s character list', 'Building your match'];
const REEL = [...CHARACTER_IDS, CHARACTER_IDS[0]]; // last frame repeats the first for a seamless loop

const Tick = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

/**
 * 05 · Matching theatre (~4.5 s, not interruptible). The result is already
 * picked when this screen opens; `onDone` fires when the animation ends.
 */
export function Matching({ onDone }: { onDone: () => void }) {
  useTimeout(config.matchingDuration, onDone);
  return (
    <div className="scr screen-matching" aria-label="Finding your match, continues automatically">
      <Chrome tab="STEP 3 OF 4" />
      <div className="panel" style={{ top: 236 }}>
        <h1 className="d" style={{ fontSize: 32, lineHeight: 1.02 }}>
          Santa’s factory is
          <br />
          finding your match…
        </h1>
      </div>
      <div className="mach">
        <div className="bulbs">
          {[0, 0.18, 0.36, 0.54, 0.72].map((d) => (
            <i key={d} style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
        <div className="screen">
          <div className="reel">
            {REEL.map((id, i) => (
              <img key={i} src={CHARACTERS[id].image} alt="" />
            ))}
          </div>
          <div className="found">
            <span className="d" style={{ fontSize: 84, color: '#fff', textShadow: '0 5px 0 #9E0008' }}>?</span>
            <span className="d" style={{ fontSize: 24, color: '#fff', border: '4px solid #fff', borderRadius: 10, padding: '5px 10px', transform: 'rotate(-6deg)' }}>
              Match found!
            </span>
          </div>
        </div>
        <div className="keys">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <span className="red" />
        <div className="lever" />
      </div>
      <div className="status">
        <div className="sh">FACTORY STATUS</div>
        <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            return (
              <div key={label} className={n === 1 ? 'row' : `row o${n}`}>
                <span className={`hl a${n}`} />
                <span className="ic">
                  <span className="pend" />
                  <span className={`act a${n}`}>
                    <i />
                  </span>
                  <span className={`ok d${n}`}>
                    <Tick />
                  </span>
                </span>
                <span className="txt">{label}</span>
              </div>
            );
          })}
          <div className="row o4">
            <span className="hl a4" style={{ background: '#FFE0DE' }} />
            <span className="ic">
              <span className="pend" />
              <span className="ok d4" style={{ background: '#E3000B' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                  <path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7z" />
                </svg>
              </span>
            </span>
            <span className="txt" style={{ color: '#C2000A' }}>Match found!</span>
          </div>
          <div className="bricks" role="progressbar" aria-label="Building your match">
            <span className="fill" />
          </div>
        </div>
      </div>
    </div>
  );
}
