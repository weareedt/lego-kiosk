/** Central place for timings and kiosk settings. All durations are in milliseconds. */
export const config = {
  /** Design canvas: iPad mini portrait in CSS points. The stage is scaled to fit any screen. */
  stage: { width: 744, height: 1133 },

  /**
   * How far the Welcome artwork (welcome.jpg, same size as the canvas) may be enlarged to
   * fill a wider screen. cropTop / cropBottom: rows that may go off screen. The title plate
   * starts at row 93 and the title at 127, so 70 keeps the top of the plate and some of the
   * scene above it in view; the black tag ends at 1109. maxStretch: widening allowed on top
   * of that, small enough not to be noticed.
   */
  welcomeArt: { cropTop: 70, cropBottom: 14, maxStretch: 1.035 },

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
    /** The final Reveal + collect screen stays up this long (time to scan the QR), then resets. */
    final: 45_000,
  },

  /** Hold the Welcome screen's top-left corner this long to open the staff usage stats (/stats). */
  staffHoldMs: 3_000,

  /**
   * Official event dates (local days, inclusive). /stats and its CSV only show
   * these days; counts from earlier testing are kept but hidden.
   */
  event: { start: '2026-11-13', end: '2026-12-27' },

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
  },
} as const;
