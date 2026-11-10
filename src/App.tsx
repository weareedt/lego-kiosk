import { useCallback, useEffect, useRef, useState } from 'react';
import { IdlePrompt } from './components/IdlePrompt';
import { Stage } from './components/Stage';
import { useCamera } from './lib/camera';
import { CHARACTERS, type CharacterId } from './lib/characters';
import { config } from './lib/config';
import { matchGuest } from './lib/matching';
import { newSessionId, qrDataUrl, resultUrl } from './lib/qr';
import { useIdle } from './lib/useIdle';
import { Camera } from './screens/Camera';
import { CameraError } from './screens/CameraError';
import { Confirm } from './screens/Confirm';
import { Countdown } from './screens/Countdown';
import { Matching } from './screens/Matching';
import { Name } from './screens/Name';
import { Reveal } from './screens/Reveal';
import { StampCard } from './screens/StampCard';
import { Welcome } from './screens/Welcome';

export type Screen = 'welcome' | 'name' | 'camera' | 'countdown' | 'confirm' | 'cameraError' | 'matching' | 'reveal' | 'stampcard';

interface Session {
  id: string;
  passNo: string;
  name: string;
  photo: string | null;
  /** Whether the face check saw a face when the photo was taken. */
  faceFound: boolean;
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
  faceFound: false,
  character: null,
  qr: null,
  qrHref: null,
});

/** Inactivity before the "Still building?" prompt, for screens that have one. */
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

  const startMatching = (photo: string | null, faceFound: boolean) => {
    cam.stop();
    setMatchDone(false);
    go('matching');
    // Lock the result at t = 0 so the reveal and QR are ready when the animation ends.
    const { id, name } = sessionRef.current;
    matchGuest(photo, faceFound).then(async (character) => {
      const qrHref = resultUrl(id, character, name.trim());
      const qr = await qrDataUrl(qrHref);
      setSession((s) => (s.id === id ? { ...s, character, qr, qrHref } : s));
    });
  };

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
          onShoot={(faceFound) => {
            setSession((s) => ({ ...s, faceFound }));
            go('countdown');
          }}
          onBack={() => go('name')}
          onError={() => go('cameraError')}
        />
      );
      break;
    case 'countdown':
      view = (
        <Countdown
          onCapture={() => {
            const photo = cam.capture();
            setSession((s) => ({ ...s, photo }));
            window.setTimeout(() => go('confirm'), 450);
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
          onRetake={() => {
            setSession((s) => ({ ...s, photo: null }));
            go('camera');
          }}
          onUse={() => startMatching(session.photo, session.faceFound)}
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
          onSkipPhoto={() => startMatching(null, false)}
          onStartOver={reset}
        />
      );
      break;
    case 'matching':
      view = <Matching onDone={() => setMatchDone(true)} />;
      break;
    case 'reveal':
      view = character ? <Reveal name={displayName} character={character} qr={session.qr} qrHref={session.qrHref} onDone={() => go('stampcard')} /> : <></>;
      break;
    case 'stampcard':
      view = character ? <StampCard name={displayName} character={character} qr={session.qr} onFinish={reset} /> : <></>;
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
