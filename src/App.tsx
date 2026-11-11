import { useCallback, useEffect, useRef, useState } from 'react';
import { IdlePrompt } from './components/IdlePrompt';
import { Stage } from './components/Stage';
import { useCamera } from './lib/camera';
import { CHARACTERS, type CharacterId } from './lib/characters';
import { config } from './lib/config';
import { photoHasFace } from './lib/faceDetector';
import { matchGuest } from './lib/matching';
import { newSessionId, qrDataUrl, resultUrl } from './lib/qr';
import { track, type EventType } from './lib/telemetry';
import { useIdle } from './lib/useIdle';
import { Camera } from './screens/Camera';
import { CameraError } from './screens/CameraError';
import { Confirm } from './screens/Confirm';
import { Countdown } from './screens/Countdown';
import { Matching } from './screens/Matching';
import { Name } from './screens/Name';
import { Reveal } from './screens/Reveal';
import { Welcome } from './screens/Welcome';

export type Screen = 'welcome' | 'name' | 'camera' | 'countdown' | 'confirm' | 'cameraError' | 'matching' | 'reveal';

interface Session {
  id: string;
  passNo: string;
  name: string;
  photo: string | null;
  /** Whether a face was found in the captured photo (null = still checking / unknown). */
  faceFound: boolean | null;
  character: CharacterId | null;
  qr: string | null;
  /** The URL encoded in the QR (also exposed as data-href for staff/testing). */
  qrHref: string | null;
}

const newSession = (): Session => ({
  id: newSessionId(),
  passNo: String(1000 + Math.floor(Math.random() * 9000)),
  name: '',
  photo: null,
  faceFound: null,
  character: null,
  qr: null,
  qrHref: null,
});

/** Inactivity before the "Still building?" prompt, for screens that have one. */
/** Usage event sent the first time a session reaches each screen (for /stats). */
const SCREEN_EVENT: Partial<Record<Screen, EventType>> = {
  name: 'start',
  camera: 'camera',
  confirm: 'confirm',
  cameraError: 'cameraError',
  matching: 'matching',
  reveal: 'reveal',
};

const IDLE_PROMPT: Partial<Record<Screen, number>> = {
  name: config.idle.name,
  camera: config.idle.camera,
  confirm: config.idle.confirm,
};

export function App() {
  const cam = useCamera();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [session, setSession] = useState<Session>(newSession);
  const [prompt, setPrompt] = useState(false);
  const [matchDone, setMatchDone] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const go = useCallback((s: Screen) => {
    setPrompt(false);
    setScreen(s);
  }, []);

  /** Wipes everything (photo, name, match) and returns to the attract screen. */
  const reset = useCallback(() => {
    cam.stop();
    setSession(newSession());
    setMatchDone(false);
    go('welcome');
  }, [cam, go]);

  useIdle(prompt ? null : (IDLE_PROMPT[screen] ?? null), () => setPrompt(true));

  const displayName = session.name.trim() || config.fallbackName;

  const startMatching = () => {
    cam.stop();
    setMatchDone(false);
    go('matching');
    // Lock the result at t = 0 so the reveal and QR are ready when the animation ends.
    const { id, name } = sessionRef.current;
    matchGuest().then(async (character) => {
      const qrHref = resultUrl(id, character, name.trim());
      const qr = await qrDataUrl(qrHref);
      setSession((s) => (s.id === id ? { ...s, character, qr, qrHref } : s));
    });
  };

  // Usage telemetry: one event per session per step (retakes and repeats don't recount).
  const tracked = useRef(new Set<string>());
  useEffect(() => {
    const type = SCREEN_EVENT[screen];
    const key = `${session.id}:${type}`;
    if (!type || tracked.current.has(key)) return;
    tracked.current.add(key);
    track(type, session.id, type === 'reveal' && session.character ? { character: session.character } : {});
  }, [screen, session.id, session.character]);

  // Leave Matching once both the animation has finished and the result is ready.
  useEffect(() => {
    if (screen === 'matching' && matchDone && session.character) go('reveal');
  }, [screen, matchDone, session.character, go]);

  const character = session.character ? CHARACTERS[session.character] : null;

  let view: JSX.Element;
  switch (screen) {
    case 'welcome':
      view = <Welcome onStart={() => go('name')} />;
      break;
    case 'name':
      view = (
        <Name
          name={session.name}
          onChange={(name) => setSession((s) => ({ ...s, name }))}
          onContinue={() => go('camera')}
          onSkip={() => {
            setSession((s) => ({ ...s, name: '' }));
            go('camera');
          }}
          onBack={reset}
        />
      );
      break;
    case 'camera':
      view = (
        <Camera
          onShoot={() => go('countdown')}
          onBack={() => go('name')}
          onError={() => go('cameraError')}
        />
      );
      break;
    case 'countdown':
      view = (
        <Countdown
          onCapture={async () => {
            // The flash is on screen now; grab a frame (retrying briefly if the camera hiccups).
            let photo: string | null = null;
            for (let i = 0; i < 6 && !photo; i++) {
              photo = cam.capture();
              if (!photo) await new Promise((r) => window.setTimeout(r, 120));
            }
            const id = sessionRef.current.id;
            setSession((s) => ({ ...s, photo, faceFound: photo ? null : false }));
            window.setTimeout(() => go('confirm'), 450);
            // Check the still for a face; Confirm shows a friendly note if there isn't one.
            if (photo) {
              const found = await photoHasFace(photo);
              setSession((s) => (s.id === id && s.photo === photo ? { ...s, faceFound: found } : s));
            }
          }}
        />
      );
      break;
    case 'confirm':
      view = (
        <Confirm
          name={displayName}
          photo={session.photo}
          passNo={session.passNo}
          faceFound={session.faceFound}
          onRetake={() => {
            // If the last shot came out blank, the stream is stuck: get a fresh one.
            if (!session.photo) cam.stop();
            setSession((s) => ({ ...s, photo: null, faceFound: null }));
            go('camera');
          }}
          onUse={startMatching}
        />
      );
      break;
    case 'cameraError':
      view = (
        <CameraError
          status={cam.status}
          onRetry={() => {
            cam.stop();
            go('camera');
          }}
          onSkipPhoto={startMatching}
          onStartOver={reset}
        />
      );
      break;
    case 'matching':
      view = <Matching onDone={() => setMatchDone(true)} />;
      break;
    case 'reveal':
      view = character ? <Reveal name={displayName} character={character} qr={session.qr} qrHref={session.qrHref} onFinish={reset} /> : <></>;
      break;
  }

  return (
    <Stage>
      <div key={screen + session.id} className="scr-wrap screen-enter">
        {view}
      </div>
      {prompt && <IdlePrompt onStay={() => setPrompt(false)} onStartOver={reset} />}
    </Stage>
  );
}
