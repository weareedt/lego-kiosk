import { useStageFit } from '../components/Stage';
import { fillArt } from '../lib/stageFit';

/**
 * 01 · Welcome / Attract. The client's campaign artwork; the whole screen is the start button.
 * On a screen wider than the canvas the artwork is enlarged to fill it, cropped only where
 * it has nothing that must be seen (config.welcomeArt). If a screen is wider still, the
 * blurred background shows either side.
 */
export function Welcome({ onStart }: { onStart: () => void }) {
  const fill = fillArt(useStageFit());
  return (
    <button type="button" className="scr screen-welcome" aria-label="Touch to start" onClick={onStart}>
      <img className="bg" src="/assets/background.jpg" alt="" />
      <span className="art-fill" style={{ transform: `translateY(${fill.offsetY}px) scale(${fill.scaleX}, ${fill.scaleY})` }}>
        <img className="art" src="/assets/welcome.jpg" alt="LEGO Santa’s Toy Factory — Touch to start. Gift the Love of Bricks." />
        <span className="ring" />
        <span className="glint">
          <i />
        </span>
      </span>
    </button>
  );
}
