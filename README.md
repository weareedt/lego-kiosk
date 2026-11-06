# LEGO® Santa’s Toy Factory — Character Match Kiosk

An iPad mini event-booth kiosk. Guests enter their name, take a photo, watch the
“factory” find their festive LEGO character, and get a QR code to collect a Stamp
Card at the counter.

Built with React + Vite + TypeScript. It runs in Safari as a full-screen web app.

## Flow

```
01 Welcome → 02 Name → 03 Camera → 03b 3-2-1 → 04 Confirm → 05 Matching → 06 Reveal + QR → 07 Collect Stamp Card → reset
```

| Screen | Moves on | Timeout |
| --- | --- | --- |
| 01 Welcome | Tap anywhere | — |
| 02 Name | Continue / Skip (“Festive Friend”) | 30 s → “Still building?” |
| 03 Camera | Take photo | 30 s → “Still building?” |
| 03b Countdown | Automatic (3 s), captures a still | — |
| 04 Confirm | Use this photo / Retake | 20 s → “Still building?” |
| 05 Matching | Automatic (4.5 s), not interruptible | — |
| 06 Reveal + QR | Done | 60 s → Stamp Card |
| 07 Stamp Card | Finish | 10 s → reset |

“Still building?” waits 10 s, then starts over. A reset clears the name, photo and
match, and stops the camera. If the camera is blocked or missing, the guest sees a
camera error screen with **Match me anyway**, which matches from the neutral pool
without a photo.

All timings live in `src/lib/config.ts`.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN via --host)
npm run build      # type-check + production build to dist/
npm run preview    # serve the build
```

The camera needs a **secure context**: HTTPS, or `localhost`. To test on the iPad
during development, deploy a preview (Vercel) or use an HTTPS tunnel.

### Environment

Copy `.env.example` to `.env.local`:

```
VITE_QR_BASE_URL=https://example.com/match
```

The QR on the Reveal and Stamp Card screens points to
`VITE_QR_BASE_URL?s=<sessionId>&c=<characterId>`.

## Deploying to Vercel

Import the repo in Vercel. The framework preset is Vite (build `npm run build`,
output `dist`). `vercel.json` rewrites every route to the app, and you set
`VITE_QR_BASE_URL` in the project's environment variables.

## iPad kiosk setup

1. Open the deployed URL in Safari, then **Share → Add to Home Screen**. The app
   opens full screen in portrait.
2. Launch it from the Home Screen and allow camera access when asked.
3. Turn on **Settings → Accessibility → Guided Access**, then triple-click to lock
   the iPad to the app. Disable touch on the screen edges if needed.
4. Set **Auto-Lock** to Never and keep the iPad on power.

The UI is designed on a 744 × 1133 canvas (iPad mini portrait). `Stage.tsx` scales
it to fit any screen, letterboxed.

## Project structure

```
src/
  App.tsx              Flow state machine (screens, session, idle prompt, reset)
  main.tsx             Entry, fonts, kiosk hardening, ?force= staff override
  components/
    Chrome.tsx         Background, sign header (from the client PSD), brand marks, Back
    Stage.tsx          Scales the 744×1133 canvas to the screen
    IdlePrompt.tsx     “Still building?” overlay
  screens/             One file per screen (Welcome … StampCard, CameraError)
  lib/
    config.ts          Timings, name length, QR base URL, camera settings
    characters.ts      The 7 characters: copy, colours, images
    matching.ts        Photo read (simulated) + weighted pick + variety rules
    camera.tsx         Shared camera stream, mirrored preview, still capture
    qr.ts              Session id + QR generation
    useIdle.ts         Inactivity / timeout hooks
  styles/
    kiosk.css          Screen styles ported from the design canvas (scoped per screen)
    app.css            Resets, stage, idle prompt, runtime states
public/assets/         Background, welcome artwork, sign parts, lockup, LEGO logo, characters
```

## Character matching

`src/lib/matching.ts` follows the UX spec:

1. **Read.** A photo read returns `masculine`, `feminine` or `unsure`. This build
   ships a **simulated** reader (`readPhoto`). Replace it with an on-device model
   when ready. Nothing identifying is stored, and the read is never shown on
   screen. Avoid the words “random”, “gender”, “male/female” and confidence scores
   in the UI.
2. **Weighted pick** (weights in %):

   | Read | Elf Boy | Santa | Elf Girl | Reindeer | Gingerbread | Snowman | Yeti |
   | --- | --- | --- | --- | --- | --- | --- | --- |
   | Masculine | 30 | 25 | — | — | 15 | 15 | 15 |
   | Feminine | — | — | 30 | 25 | 15 | 15 | 15 |
   | Unsure / no photo | 10 | 10 | 10 | 10 | 20 | 20 | 20 |

3. **Variety rules.** The same character never comes up twice in a row on one
   kiosk. Any character above 25% of today’s results has its weight halved. Today’s
   counts are stored in `localStorage`, per device.
4. **Lock early.** The result is picked when Matching starts, so the reveal and the
   QR are ready when the animation ends.

**Staff override (photo ops):** open the app with `?force=santa` (or any character
id) and the next guest gets that character. It’s one-shot.

Face-in-frame on the Camera screen is also simulated: it’s “ready” as soon as the
stream is live. Drive the `ok` flag in `screens/Camera.tsx` from a face detector
to make it real.

## Next steps

- [ ] Real face-in-frame check and photo read (e.g. MediaPipe Face Detection, on-device)
- [ ] Backend for the QR result page (e.g. Firebase: save match + photo, mobile result page)
- [ ] Ask the client for the welcome artwork and background exported at 2× iPad size
      (1488 × 2266). The current files are 744 × 1133.
- [ ] Optional: offline caching (service worker) for patchy venue Wi-Fi
- [ ] Staff/admin screen for daily stats and the character override
