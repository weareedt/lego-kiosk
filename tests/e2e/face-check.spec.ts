import { expect, test } from '@playwright/test';

test('a face in the outline shows “Perfect”', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'ok', { timeout: 15_000 });
  await expect(page.locator('.screen-camera .chip')).toHaveText('Perfect — hold that smile!');
  await expect(page.locator('.screen-camera .pill')).toBeEnabled();
});

test('if face detection can’t load, the camera still works but never claims “Perfect”', async ({ page }) => {
  await page.route('**/mediapipe/**', (r) => r.abort());
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'off', { timeout: 15_000 });
  await expect(page.locator('.screen-camera .chip')).toHaveText('Line up your face, then tap Take photo');
  await expect(page.locator('.screen-camera .head.ok')).toHaveCount(0);
  await expect(page.locator('.screen-camera .pill')).toBeEnabled();
});
