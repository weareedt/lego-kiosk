import { expect, test } from '@playwright/test';

test('face in the outline unlocks Take photo with “Perfect”', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'ok', { timeout: 15_000 });
  await expect(page.locator('.screen-camera .chip')).toHaveText('Perfect — hold that smile!');
  await expect(page.locator('.screen-camera .pill')).toBeEnabled();
});
