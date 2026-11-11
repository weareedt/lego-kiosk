import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// The guest stands to one side of the outline (face visible, but not inside the head frame).
const OFF_CENTRE = fileURLToPath(new URL('../fixtures/face-off-centre.y4m', import.meta.url));
test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${OFF_CENTRE}`],
  },
});

test('a face outside the head outline gets a hint (not “Perfect”), and the photo still counts', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'right', { timeout: 15_000 });
  await expect(page.locator('.screen-camera .chip')).toHaveText('Move a little to your right');
  await expect(page.locator('.screen-camera .head.ok')).toHaveCount(0);
  await expect(page.locator('.screen-camera .pill')).toBeEnabled();
  await page.locator('.screen-camera .pill').click();
  // A face is in the photo, just not centred: no "no face" message
  await expect(page.locator('.screen-confirm')).toHaveAttribute('data-face-found', 'true', { timeout: 10_000 });
  await expect(page.locator('.screen-confirm .noface')).toHaveCount(0);
});
