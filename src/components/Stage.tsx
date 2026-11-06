import { useEffect, useState, type ReactNode } from 'react';
import { config } from '../lib/config';

/** Scales the fixed 744×1133 design canvas to fit the screen, keeping its aspect ratio. */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / config.stage.width, window.innerHeight / config.stage.height));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
