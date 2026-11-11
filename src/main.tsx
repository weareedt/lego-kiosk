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
import { ResultPage } from './result/ResultPage';
import { CameraProvider } from './lib/camera';
import { CHARACTER_IDS, type CharacterId } from './lib/characters';
import { setStaffOverride } from './lib/matching';
import { startTelemetry } from './lib/telemetry';
import { StatsPage } from './stats/StatsPage';

// /match is the guest's phone result page (opened from the kiosk QR), /stats is the staff
// usage dashboard; everything else is the kiosk.
const path = location.pathname.replace(/\/+$/, '');
const isResultPage = path === '/match';
const isStatsPage = path === '/stats';

if (isStatsPage) document.body.classList.add('is-stats');
else startTelemetry();

if (!isResultPage && !isStatsPage) {
  // Staff override for photo ops: open the kiosk with ?force=santa (one-shot, next guest only).
  const force = new URLSearchParams(location.search).get('force') as CharacterId | null;
  if (force && CHARACTER_IDS.includes(force)) setStaffOverride(force);

  // Kiosk hardening: no context menu or pinch/double-tap zoom.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStatsPage ? (
      <StatsPage />
    ) : isResultPage ? (
      <ResultPage />
    ) : (
      <CameraProvider>
        <App />
      </CameraProvider>
    )}
  </StrictMode>,
);
