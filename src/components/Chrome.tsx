import type { ReactNode } from 'react';

/** Background, sign header (from the client PSD) and brand marks shared by screens 02–07. */
export function Chrome({ tab, children }: { tab: string; children?: ReactNode }) {
  return (
    <>
      <img className="bg" src="/assets/background.jpg" alt="" />
      {children}
      <div className="bar" />
      <img className="pil" style={{ left: 113 }} src="/assets/pillar-left.png" alt="" />
      <img className="side" style={{ left: 167 }} src="/assets/side-left.png" alt="" />
      <img className="pil" style={{ right: 113 }} src="/assets/pillar-right.png" alt="" />
      <img className="side" style={{ right: 167 }} src="/assets/side-right.png" alt="" />
      <div className="tab">{tab}</div>
      <div className="plate">
        <span className="d ext" style={{ fontSize: 40, lineHeight: 0.95 }}>
          LEGO® Santa’s
          <br />
          Toy Factory
        </span>
      </div>
      <img className="lock" src="/assets/gift-the-love-of-bricks.png" alt="Gift the Love of Bricks" />
      <img className="logo" src="/assets/lego-logo.png" alt="LEGO" />
    </>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="back" aria-label="Back" onClick={onClick}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      Back
    </button>
  );
}
