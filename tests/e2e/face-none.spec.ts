import { expect, test } from '@playwright/test';

// Chromium's built-in fake camera: a test pattern with no face in it.
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });

test('no face: hint shown but Take photo still works, and Confirm says no face was found', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'none', { timeout: 15_000 });
  await expect(page.locator('.screen-camera .chip')).toHaveText('Move into the frame');
  await expect(page.locator('.screen-camera .head.ok')).toHaveCount(0);
  // Never blocked: the photo is just for fun
  await expect(page.locator('.screen-camera .pill')).toBeEnabled();
  await page.locator('.screen-camera .pill').click();

  const confirm = page.locator('.screen-confirm');
  await expect(confirm).toHaveAttribute('data-face-found', 'false', { timeout: 10_000 });
  await expect(confirm.locator('.noface')).toContainText('We couldn’t spot a face!');
  await expect(confirm.locator('.panel')).toContainText('Where did you go?');
  await expect(confirm.locator('.stamp')).toHaveText('NO FACE FOUND');

  // Guest can still carry on
  await confirm.getByRole('button', { name: 'Use it anyway' }).click();
  await expect(page.locator('.screen-reveal')).toBeVisible({ timeout: 8_000 });
});
