import { Chrome } from '../components/Chrome';
import type { CameraStatus } from '../lib/camera';

/** Edge state: camera permission denied or no camera. The guest can still get a match without a photo. */
export function CameraError(props: { status: CameraStatus; onRetry: () => void; onSkipPhoto: () => void; onStartOver: () => void }) {
  const denied = props.status === 'denied';
  return (
    <div className="scr screen-camera-error">
      <Chrome tab="STEP 2 OF 4" />
      <div className="panel" style={{ top: 236 }}>
        <h1 className="d" style={{ fontSize: 38 }}>{denied ? 'Camera needs a hand' : 'Camera’s taking a break'}</h1>
        <p style={{ margin: '10px 0 0', fontSize: 19, fontWeight: 700, color: '#3A3328' }}>
          {denied ? 'Ask our team to switch the camera on, then try again.' : 'No problem — you can still get your festive match.'}
        </p>
      </div>
      <button type="button" className="pill" style={{ left: 96, right: 96, top: 470 }} onClick={props.onSkipPhoto}>
        Match me anyway
      </button>
      <button type="button" className="pill2" style={{ left: 96, right: 96, top: 600 }} onClick={props.onRetry}>
        Try the camera again
      </button>
      <button type="button" className="pill2" style={{ left: 96, right: 96, top: 710 }} onClick={props.onStartOver}>
        Start over
      </button>
    </div>
  );
}
