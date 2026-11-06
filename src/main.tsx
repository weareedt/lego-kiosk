import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import '@fontsource/rubik/800.css';
import '@fontsource/rubik/900.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';
import './styles/app.css';
import './styles/kiosk.css';
import { App } from './App';
import { CameraProvider } from './lib/camera';
import { CHARACTER_IDS, type CharacterId } from './lib/characters';
import { setStaffOverride } from './lib/matching';

// Kiosk hardening: no context menu or pinch/double-tap zoom.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Staff override for photo ops: open the kiosk with ?force=santa (one-shot, next guest only).
const force = new URLSearchParams(location.search).get('force') as CharacterId | null;
if (force && CHARACTER_IDS.includes(force)) setStaffOverride(force);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CameraProvider>
      <App />
    </CameraProvider>
  </StrictMode>,
);
