import { useState } from 'react';
import { CHARACTERS, type Character } from '../lib/characters';
import { parseResult } from '../lib/qr';
import './result.css';

/**
 * Phone result page, opened from the kiosk QR (/match?s=…&c=…&n=…&t=…).
 * Shows the client's match card for the guest's character, exactly as
 * designed, in a frame, with a button to save it and a reminder to show it to
 * the crew for a character card. Fits one screen, no scrolling.
 */
export function ResultPage({ search = window.location.search }: { search?: string }) {
  const r = parseResult(search);
  const c = r ? CHARACTERS[r.character] : null;

  if (!r || !c) {
    return (
      <div className="rp rp-bad">
        <div className="rp-msg">
          <h1 className="rp-d">Match not found</h1>
          <p>This link doesn’t look right. Visit the LEGO® Santa’s Toy Factory booth to find your festive match!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rp">
      <p className="rp-pre">
        {r.name ? (
          <>
            <span>{r.name}</span>, you’re {withArticle(c.name)}!
          </>
        ) : (
          <>You’re {withArticle(c.name)}!</>
        )}
      </p>
      <div className="rp-frame">
        <img className="rp-card" src={c.card} alt={`Your LEGO festive match: ${c.name}`} />
      </div>
      <SaveButton character={c} name={r.name} />
      <p className="rp-note">
        Show this screen to our crew
        <br />
        to get a character card!
      </p>
    </div>
  );
}

/** "Santa" stays "Santa"; everyone else gets "the": "the Yeti", "the Elf Girl". */
function withArticle(name: string) {
  return name === 'Santa' ? 'Santa' : `the ${name}`;
}

function fileName(c: Character, name: string | null) {
  const who = (name ?? '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  return `LEGO-Santas-Toy-Factory-${c.name.replace(/\s+/g, '-')}${who ? `-${who}` : ''}.jpg`;
}

/**
 * Save the card. On phones that support sharing files (iOS Safari, Android
 * Chrome) this opens the share sheet, where "Save Image" puts it in Photos.
 * Everywhere else it downloads the JPEG.
 */
function SaveButton({ character, name }: { character: Character; name: string | null }) {
  const [busy, setBusy] = useState(false);
  const fname = fileName(character, name);

  const save = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(character.card)).blob();
      const file = new File([blob], fname, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My LEGO festive match' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      // Share sheet dismissed, or offline: nothing to do.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="rp-save" onClick={save} disabled={busy}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E3000B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v11" />
        <path d="M7 10l5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
      Save my card
    </button>
  );
}
