/** Central place for timings and kiosk settings. All durations are in milliseconds. */
export const config = {
  /** Design canvas: iPad mini portrait in CSS points. The stage is scaled to fit any screen. */
  stage: { width: 744, height: 1133 },

  maxNameLength: 12,
  /** Used when the guest skips the name step. */
  fallbackName: 'Festive Friend',

  /** Inactivity before the "Still building?" prompt appears, per screen. */
  idle: {
    name: 30_000,
    camera: 30_000,
    confirm: 20_000,
    /** How long the prompt waits for a tap before starting over. */
    promptCountdown: 10_000,
    /** Reveal moves on to the Stamp Card screen after this long without a tap. */
    reveal: 60_000,
    /** Stamp Card screen resets for the next guest after this long (time to scan the QR). */
    stampCard: 20_000,
  },

  countdownSeconds: 3,
  /** Length of the Matching "theatre" animation. */
  matchingDuration: 4_500,

  /** QR target for the phone result page. Empty = this deployment's /match page. */
  qrBaseUrl: (import.meta.env.VITE_QR_BASE_URL as string | undefined) ?? '',

  camera: {
    width: 1280,
    height: 960,
    /** JPEG quality of the captured still. */
    quality: 0.9,
    /** If no face is found in the outline for this long, Take photo unlocks anyway. */
    unlockWithoutFaceAfter: 10_000,
  },
} as const;
