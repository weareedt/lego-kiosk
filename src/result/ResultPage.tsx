import { CHARACTERS } from '../lib/characters';
import { parseResult } from '../lib/qr';
import './result.css';

/**
 * Phone result page, opened from the kiosk QR (/match?s=…&c=…&n=…&t=…).
 * One screen, no scrolling: the sign header and the guest's character card,
 * to show at the redemption counter.
 */
export function ResultPage({ search = window.location.search }: { search?: string }) {
  const r = parseResult(search);
  const c = r ? CHARACTERS[r.character] : null;

  return (
    <div className="rp">
      <header className="rp-sign" aria-label="LEGO Santa’s Toy Factory">
        <span className="rp-bar" aria-hidden="true" />
        <img src="/assets/gift-the-love-of-bricks.png" alt="Gift the Love of Bricks" className="rp-lock" />
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
        <img src="/assets/lego-logo.png" alt="LEGO" className="rp-logo" />
      </header>

      {r && c ? (
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
        </main>
      ) : (
        <main className="rp-main rp-main-bad">
          <section className="rp-np">
            <h1 className="rp-d rp-ext rp-name" style={{ fontSize: 30 }}>Match not found</h1>
            <p className="rp-quote">This link doesn’t look right. Visit the LEGO® Santa’s Toy Factory booth to find your festive match!</p>
          </section>
        </main>
      )}
    </div>
  );
}
