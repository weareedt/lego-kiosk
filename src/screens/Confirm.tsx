import { Chrome } from '../components/Chrome';

/**
 * 04 · Photo confirmation. The photo drops in as a hanging Factory Pass.
 * If no face can be found in the photo (guest stepped out, covered up, dark
 * frame) we say so and suggest a retake, but the guest can still carry on:
 * the photo is just for fun.
 */
export function Confirm(props: {
  name: string;
  photo: string | null;
  /** null while the check is running (or if the detector is unavailable). */
  faceFound: boolean | null;
  passNo: string;
  onRetake: () => void;
  onUse: () => void;
}) {
  const noFace = props.faceFound === false;
  return (
    <div className="scr screen-confirm" data-face-found={String(props.faceFound)}>
      <Chrome tab="STEP 2 OF 4" />
      <div className="panel" style={{ top: 236, padding: '20px 26px' }}>
        <h1 className="d" style={{ fontSize: 40 }}>{noFace ? 'Where did you go?' : 'Looking good!'}</h1>
      </div>
      <div className="clip" />
      <div className="hang">
        <div className="pass">
          <div className="pb">
            <span>FACTORY PASS</span>
            <span>No. {props.passNo}</span>
          </div>
          <div className="ph">
            {props.photo ? <img src={props.photo} alt="Your photo" /> : <div className="ph-empty" />}
            {noFace && (
              <div className="noface" role="alert">
                <strong>We couldn’t spot a face!</strong>
                <span>Try a retake, or carry on anyway.</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 16px' }}>
            <span className="d" style={{ fontSize: props.name.length > 8 ? 28 : 40, maxWidth: 270, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {props.name}
            </span>
            {noFace ? <span className="stamp">NO FACE FOUND</span> : <span className="stamp">READY TO BUILD</span>}
          </div>
        </div>
      </div>
      <button type="button" className={noFace ? 'pill retake-main' : 'pill2'} style={{ left: 64, width: noFace ? 236 : 200, top: 990 }} onClick={props.onRetake}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
        Retake
      </button>
      <button type="button" className={noFace ? 'pill2 use-anyway' : 'pill'} style={{ left: noFace ? 336 : 300, right: 64, top: 990 }} onClick={props.onUse}>
        {noFace ? 'Use it anyway' : 'Use this photo'}
      </button>
    </div>
  );
}
