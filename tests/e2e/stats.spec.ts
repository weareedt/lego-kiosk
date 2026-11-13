import { expect, test } from '@playwright/test';

test('a guest is counted, and holding the Welcome corner opens the stats', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .pill')).toBeEnabled({ timeout: 10_000 });
  await page.locator('.screen-camera .pill').click();
  await page.locator('.screen-confirm .pill').click({ timeout: 8_000 });
  await expect(page.locator('.screen-reveal')).toBeVisible({ timeout: 8_000 });
  const character = new URL((await page.locator('.screen-reveal .collect-qr img').getAttribute('data-href'))!).searchParams.get('c');

  // Staff Finish → Welcome, then hold the top-left corner for 3 s.
  await page.goto('/');
  const box = (await page.locator('.staff-hold').boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.waitForURL('**/stats', { timeout: 6_000 });
  await page.mouse.up();

  await expect(page.locator('.st-brand h1')).toHaveText('Kiosk usage');
  const today = page.locator('.st-table tbody tr').first();
  // At least this guest (other tests running in parallel may upload to the same local store).
  await expect(today.locator('td').first()).toHaveText(/^[1-9]\d*$/); // started
  await expect(page.locator('.st-hbars li', { hasText: /Saw their result/ })).toContainText('1');
  const names: Record<string, string> = { elfboy: 'Elf Boy', elfgirl: 'Elf Girl', santa: 'Santa', reindeer: 'Reindeer', gingerbread: 'Gingerbread', snowman: 'Snowman', yeti: 'Yeti' };
  await expect(page.locator('.st-hbars li', { hasText: names[character!] })).toContainText('1');

  await page.getByRole('button', { name: 'Back to kiosk' }).click();
  await expect(page.locator('.screen-welcome')).toBeVisible();
});

test('a quick tap on the Welcome corner starts like anywhere else', async ({ page }) => {
  await page.goto('/');
  await page.locator('.staff-hold').click();
  await expect(page.locator('.screen-name')).toBeVisible();
});

test('the iPad uploads its counts, and /stats elsewhere shows them', async ({ page, browser }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .pill')).toBeEnabled({ timeout: 10_000 });
  await page.locator('.screen-camera .pill').click();
  await page.locator('.screen-confirm .pill').click({ timeout: 8_000 });
  await expect(page.locator('.screen-reveal')).toBeVisible({ timeout: 8_000 });

  // The kiosk uploads on load (and every few minutes); reload to trigger it now.
  const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/usage') && r.request().method() === 'POST' && r.ok());
  await page.goto('/');
  await uploaded;
  const id = await page.evaluate(() => localStorage.getItem('stf.kioskId'));

  const laptop = await browser.newPage(); // no local counts: online copy only
  const body = await (await laptop.request.get('/api/usage')).json();
  expect(body.kiosks[id!].days).toBeTruthy();
  await laptop.goto('/stats');
  await expect(laptop.locator('.st-sub')).toContainText('iPad');
  await expect(laptop.locator('.st-table tbody tr').first()).toBeVisible();
  await expect(laptop.getByRole('button', { name: 'Back to kiosk' })).toHaveCount(0);
  await laptop.close();
});
