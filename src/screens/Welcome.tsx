import { useStageFit } from '../components/Stage';

/**
 * 01 · Welcome / Attract. The client's campaign artwork; the whole screen is the start button.
 * The artwork is always shown whole, at the canvas size. On a screen wider than the canvas
 * the blurred background fills the space either side, and the artwork's edges fade into it.
 */
export function Welcome({ onStart }: { onStart: () => void }) {
  const soft = useStageFit().bleedX > 0.5;
  return (
    <button type="button" className="scr screen-welcome" aria-label="Touch to start" onClick={onStart}>
      <img className="bg" src="/assets/background.jpg" alt="" />
      <span className={soft ? 'art-box art-soft' : 'art-box'}>
        <img className="art" src="/assets/welcome.jpg" alt="LEGO Santa’s Toy Factory — Touch to start. Gift the Love of Bricks." />
        <span className="ring" />
        <span className="glint">
          <i />
        </span>
      </span>
    </button>
  );
}
