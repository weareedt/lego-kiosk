import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { fitStage, type StageFit } from '../lib/stageFit';

const FitContext = createContext<StageFit>(fitStage(0, 0));

/** The current fit of the canvas to the screen, for screens that lay themselves out by it. */
export const useStageFit = () => useContext(FitContext);

/**
 * Scales the 744×1133 design canvas to fit the screen, keeping its aspect ratio. On a screen
 * of another shape the stage is wider (or taller) than the canvas so it still fills the
 * screen: the canvas sits in the middle and backgrounds run into the bleed (see app.css).
 */
export function Stage({ children }: { children: ReactNode }) {
  const [fit, setFit] = useState(() => fitStage(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const refit = () => setFit(fitStage(window.innerWidth, window.innerHeight));
    refit();
    window.addEventListener('resize', refit);
    return () => window.removeEventListener('resize', refit);
  }, []);
  const style = {
    width: fit.width,
    height: fit.height,
    transform: `scale(${fit.scale})`,
    '--bleed-x': `${fit.bleedX}px`,
    '--bleed-y': `${fit.bleedY}px`,
  } as CSSProperties;
  return (
    <div className="viewport">
      <div className="stage" style={style}>
        <FitContext.Provider value={fit}>{children}</FitContext.Provider>
      </div>
    </div>
  );
}
