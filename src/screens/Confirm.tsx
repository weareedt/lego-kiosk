import { Chrome } from '../components/Chrome';

/** 04 · Photo confirmation. The photo drops in as a hanging Factory Pass. */
export function Confirm(props: { name: string; photo: string | null; passNo: string; onRetake: () => void; onUse: () => void }) {
  return (
    <div className="scr screen-confirm">
      <Chrome tab="STEP 2 OF 4" />
      <div className="panel" style={{ top: 236, padding: '20px 26px' }}>
        <h1 className="d" style={{ fontSize: 40 }}>Looking good!</h1>
      </div>
      <div className="clip" />
      <div className="hang">
        <div className="pass">
          <div className="pb">
            <span>FACTORY PASS</span>
            <span>No. {props.passNo}</span>
          </div>
          <div className="ph">{props.photo && <img src={props.photo} alt="Your photo" />}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 16px' }}>
            <span className="d" style={{ fontSize: 40, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {props.name}
            </span>
            <span className="stamp">READY TO BUILD</span>
          </div>
        </div>
      </div>
      <button type="button" className="pill2" style={{ left: 64, width: 200, top: 990 }} onClick={props.onRetake}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
        Retake
      </button>
      <button type="button" className="pill" style={{ left: 300, right: 64, top: 990 }} onClick={props.onUse}>
        Use this photo
      </button>
    </div>
  );
}
