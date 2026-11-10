import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// The guest stands to one side of the outline (face visible, but not inside the head frame).
const OFF_CENTRE = fileURLToPath(new URL('../fixtures/face-off-centre.y4m', import.meta.url));
test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${OFF_CENTRE}`],
  },
});

test('a face outside the head outline is not “Perfect”: hint shown, Take photo locked', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'right', { timeout: 15_000 });
  await expect(page.locator('.screen-camera .chip')).toHaveText('Move a little to your right');
  await expect(page.locator('.screen-camera .head.ok')).toHaveCount(0);
  await expect(page.locator('.screen-camera .pill')).toBeDisabled();
});
