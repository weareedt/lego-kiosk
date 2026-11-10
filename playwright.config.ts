import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/** A still of a guest, fed to Chromium as the camera so face detection has a real face. */
export const FACE_VIDEO = fileURLToPath(new URL('./tests/fixtures/face.y4m', import.meta.url));

/**
 * End-to-end tests run against the production build (vite preview).
 * Chromium's fake camera (playing tests/fixtures/face.y4m) stands in for the iPad camera.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 744, height: 1133 },
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${FACE_VIDEO}`],
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
