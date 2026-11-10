import { expect, test } from '@playwright/test';

// Chromium's built-in fake camera: a test pattern with no face in it.
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

test('Take photo stays locked with a hint, then unlocks after 10 s', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'none', { timeout: 15_000 });
  await expect(page.locator('.screen-camera .chip')).toHaveText('Move into the frame');
  await expect(page.locator('.screen-camera .pill')).toBeDisabled();
  await page.waitForTimeout(3_000);
  await expect(page.locator('.screen-camera .pill')).toBeDisabled();
  await expect(page.locator('.screen-camera .pill')).toBeEnabled({ timeout: 10_000 });
});
