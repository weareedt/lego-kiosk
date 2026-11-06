/** 01 · Welcome / Attract. The client's campaign artwork; the whole screen is the start button. */
export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <button type="button" className="scr screen-welcome" aria-label="Touch to start" onClick={onStart}>
      <img className="art" src="/assets/welcome.jpg" alt="LEGO Santa’s Toy Factory — Touch to start. Gift the Love of Bricks." />
      <span className="ring" />
      <span className="glint">
        <i />
      </span>
    </button>
  );
}
