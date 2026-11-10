import { CHARACTERS } from '../lib/characters';
import { parseResult } from '../lib/qr';
import './result.css';

/**
 * Phone result page, opened from the kiosk QR (/match?s=…&c=…&n=…&t=…).
 * Shows the guest's character and a code to show at the redemption counter.
 *
 * NOTE: the result lives in the link itself, so staff should check the code and
 * time against the kiosk if fraud matters. A backend (e.g. Firebase) can make
 * this verifiable later.
 */
export function ResultPage({ search = window.location.search }: { search?: string }) {
  const r = parseResult(search);

  return (
    <div className="rp">
      <header className="rp-brand">
        <img src="/assets/gift-the-love-of-bricks.png" alt="Gift the Love of Bricks" className="rp-lock" />
        <img src="/assets/lego-logo.png" alt="LEGO" className="rp-logo" />
      </header>

      <div className="rp-sign" aria-label="LEGO Santa’s Toy Factory">
        <img src="/assets/pillar-left.png" alt="" className="rp-pil" />
        <img src="/assets/side-left.png" alt="" className="rp-side" />
        <div className="rp-plate">
          <span className="rp-d rp-ext">
            LEGO® Santa’s
            <br />
            Toy Factory
          </span>
        </div>
        <img src="/assets/side-right.png" alt="" className="rp-side" />
        <img src="/assets/pillar-right.png" alt="" className="rp-pil" />
      </div>

      {r ? <Match r={r} /> : <Invalid />}
    </div>
  );
}

function Match({ r }: { r: NonNullable<ReturnType<typeof parseResult>> }) {
  const c = CHARACTERS[r.character];
  const when = r.at?.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <main className="rp-main">
      <p className="rp-pre">{r.name ? `${r.name}, your` : 'Your'} LEGO festive match is…</p>
      <div className="rp-stage">
        <div className="rp-glow" style={{ background: c.color }} />
        <div className="rp-rays" />
        <img className="rp-char" src={c.image} alt={c.name} />
      </div>
      <section className="rp-np">
        <h1 className="rp-d rp-ext rp-name">{c.name}</h1>
        <span className="rp-title" style={{ background: c.deep }}>{c.title}</span>
        <p className="rp-quote">{c.quote}</p>
      </section>

      <section className="rp-redeem">
        <div className="rp-redeem-head">COLLECT YOUR STAMP CARD</div>
        <p className="rp-redeem-text">Show this screen at the redemption counter to collect your LEGO Stamp Card.</p>
        <div className="rp-code" aria-label={`Match code ${r.sessionId}`}>
          {r.sessionId.split('').map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </div>
        <p className="rp-meta">
          Match code{when ? ` · ${when}` : ''}
        </p>
      </section>
      <p className="rp-foot">LEGO® Santa’s Toy Factory · Gift the Love of Bricks</p>
    </main>
  );
}

function Invalid() {
  return (
    <main className="rp-main">
      <section className="rp-redeem" style={{ marginTop: 32 }}>
        <div className="rp-redeem-head">MATCH NOT FOUND</div>
        <p className="rp-redeem-text">This link doesn’t look right. Visit the LEGO® Santa’s Toy Factory booth to find your festive match!</p>
      </section>
    </main>
  );
}
