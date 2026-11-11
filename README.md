# LEGO® Santa’s Toy Factory — Character Match Kiosk

An iPad mini event-booth kiosk. Guests enter their name, take a photo, watch the
“factory” find their festive LEGO character, and get a QR code to collect a Stamp
Card at the counter.

Built with React + Vite + TypeScript. It runs in Safari as a full-screen web app.

## Flow

```
01 Welcome → 02 Name → 03 Camera → 03b 3-2-1 → 04 Confirm → 05 Matching → 06 Reveal + collect Stamp Card (QR) → reset
```

| Screen | Moves on | Timeout |
| --- | --- | --- |
| 01 Welcome | Tap anywhere | — |
| 02 Name | Continue / Skip (“Festive Friend”) | 30 s → “Still building?” |
| 03 Camera | Take photo | 30 s → “Still building?” |
| 03b Countdown | Automatic (3 s), captures a still | — |
| 04 Confirm | Use this photo / Retake | 20 s → “Still building?” |
| 05 Matching | Automatic (4.5 s), not interruptible | — |
| 06 Reveal + collect | No guest button: scan the QR, show it at the counter | 45 s → reset (staff can tap Finish) |

“Still building?” waits 10 s, then starts over. A reset clears the name, photo and
match, and stops the camera. If the camera is blocked or missing, the guest sees a
camera error screen with **Match me anyway**, which gives them a match without a
photo.

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

### Phone result page (QR)

The QR on the final screen opens **`/match`** on the same
deployment, on the guest’s phone:

```
/match?s=<session code>&c=<character id>&n=<first name>&t=<unix time>
```

It shows the client’s finished match card for their character
(`public/assets/cards/<id>.jpg`, 1080×1350, shown untouched) in a frame, with their
name above (“ANNA, you’re the Elf Girl!”), a **Save my card** button, and a reminder
to show the screen at the counter to collect the Stamp Card. Everything fits one
screen on any phone. *Save my card* opens the share sheet on phones (where “Save
Image” puts it in Photos) and downloads the original JPEG elsewhere. Broken links
get a friendly “Match not found”. The result lives in the link itself; opening it
also counts a QR scan for the usage dashboard.

To host it somewhere else, set `VITE_QR_BASE_URL` in `.env.local` (see `.env.example`).

### Usage dashboard (`/stats`)

Open **`/stats`** on the deployment (laptop or phone) for per-day usage across all
iPads: guests, how far they got (name → camera → photo → matched → result → QR
scan), guests by hour, cards handed out per character, camera problems, and a
table of every day with a CSV download. It refreshes every minute. Days and hours
are the iPad's local time; a QR scan counts on the day the guest played.

How it works: the kiosk and the phone result page send small events to
`/api/events` (`src/lib/telemetry.ts`). Each event is queued on the device and
retried, so a kiosk that drops off the venue Wi-Fi catches up later, and the
server ignores repeats, so nothing is double counted. Events only bump counters in
Redis (`server/telemetry.ts`): no names or photos are stored.

**One-time setup on Vercel:**

1. In the Vercel project, open **Storage → Create / Connect Database → Upstash
   (Redis)**, pick the free plan, and connect it to this project. That adds
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) to the
   environment.
2. Optional: add a `STATS_KEY` environment variable. `/stats` then asks for it once
   per browser. Without it, anyone with the link can see the (anonymous) totals.
3. Redeploy.

Until storage is connected, `/stats` says so and the kiosk keeps its events queued
on the device. Locally, `npm run dev` and `npm run preview` serve the same API from
memory (reset on restart), so the dashboard works without Redis.

## Tests

```bash
npm test           # unit tests (Vitest): matching rules, QR links, telemetry API
npm run test:e2e   # end-to-end (Playwright, Chromium fake camera): builds and runs the app
npm run test:all   # both
```

First run of the end-to-end tests needs a browser: `npx playwright install chromium`.

The end-to-end suite feeds Chromium a still of a guest (`tests/fixtures/face.y4m`)
as the camera, so face detection runs for real. It covers face-in-frame (hints, never blocking,
the no-face message on Confirm), the camera dropping out and Retake recovering, the full guest journey through to the auto reset, Retake,
Skip, the keyboard (on-screen and laptop), the staff override, a blocked camera,
the idle prompt (both outcomes), and the phone result page, including opening the
kiosk’s QR link on a phone and getting the same character, and usage events
reaching `/stats`.

## Deploying to Vercel

Import the repo in Vercel. The framework preset is Vite (build `npm run build`,
output `dist`). `vercel.json` rewrites every route except `/api/*` to the app. Functions in
`api/` serve the usage stats (see *Usage dashboard* for the Redis setup).
`VITE_QR_BASE_URL` is optional.

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
  result/              Phone result page opened from the QR (/match)
  stats/               Staff usage dashboard (/stats)
  lib/
    config.ts          Timings, name length, QR base URL, camera settings
    characters.ts      The 7 characters: copy, colours, images
    matching.ts        Even-odds pick + variety rules + staff override
    camera.tsx         Shared camera stream, mirrored preview, still capture
    faceDetector.ts    Loads MediaPipe Face Detection (on-device, offline)
    faceFrame.ts       Is the face inside the head outline? (+ hints)
    useFaceCheck.ts    Runs the check on the live preview ~6×/second
    qr.ts              Session id + QR generation
    useIdle.ts         Inactivity / timeout hooks
    telemetry.ts       Usage events, queued on the device and sent to /api/events
  styles/
    kiosk.css          Screen styles ported from the design canvas (scoped per screen)
    app.css            Resets, stage, idle prompt, runtime states
public/assets/         Background, welcome artwork, sign parts, lockup, LEGO logo, characters
```

## Character matching

`src/lib/matching.ts`. The client printed the same number of cards for every
character, so **every character is equally likely (1 in 7)**. The photo is not
used for matching, and nothing identifying is stored.

1. **Variety rules.** The same character never comes up twice in a row on one
   kiosk. Once 7 or more guests have played today on that kiosk, any character more
   than one ahead of its even share has its weight halved, so the counts stay close
   together and no card runs out early. Today’s counts are stored in
   `localStorage`, per device. The *Cards handed out* panel on `/stats` shows the
   totals across all iPads.
2. **Lock early.** The result is picked when Matching starts, so the reveal and the
   QR are ready when the animation ends.

**Staff override (photo ops):** open the app with `?force=santa` (or any character
id) and the next guest gets that character. It’s one-shot.

## Face-in-frame check

The Camera screen runs **MediaPipe Face Detection** (short-range model) on the live
preview, entirely on the device. The runtime and model are copied from
`node_modules` into `public/mediapipe` before every `dev`/`build`
(`scripts/copy-mediapipe.mjs`), so it works without internet at the venue. Nothing
is uploaded or stored.

- The outline turns green (“Perfect — hold that smile!”) when a face sits inside it
  at a good distance. Otherwise the chip gives a hint: *Move into the frame*, *Come a
  little closer*, *Step back a little*, *Move a little to your left/right*, *Move
  up/down a little*. Left/right accounts for the mirrored preview.
- **It never blocks.** Take photo works as soon as the camera is live: the photo is
  just for fun. Groups are fine too.
- After the shot, the still is checked for a face. If there isn’t one (guest
  stepped out, covered up, a dark frame), Confirm says “We couldn’t spot a face!”
  with Retake as the main button and *Use it anyway* beside it.
- Blank or black frames are never saved. If the camera stalls or drops out, Retake
  restarts it automatically.
- If the detector can’t load at all, the camera works as normal and the frame never
  claims “Perfect”.
- Tuning: outline geometry and size limits in `src/lib/faceFrame.ts`.

Face presence only drives the hints and the Confirm message; it doesn’t change the
match.

## Next steps

- [ ] Backend for verified results (e.g. Firebase: save each match so staff can confirm codes)
- [ ] Ask the client for the welcome artwork and background exported at 2× iPad size
      (1488 × 2266). The current files are 744 × 1133.
- [ ] Optional: offline caching (service worker) for patchy venue Wi-Fi
- [ ] Staff screen for the character override (daily stats are at `/stats`)
