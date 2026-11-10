import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['iPhone 13'], browserName: 'chromium' });

test('phone result page shows the character, name and match code', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/match?s=AB12CD&c=elfgirl&n=ANNA&t=1796000000');
  await expect(page.locator('.rp-pre')).toHaveText('ANNA, your LEGO festive match is…');
  await expect(page.locator('.rp-name')).toHaveText('Elf Girl');
  await expect(page.locator('.rp-title')).toHaveText('The Merry Maker');
  await expect(page.locator('.rp-char')).toHaveAttribute('src', '/assets/characters/elfgirl.png');
  await expect(page.locator('.rp-code')).toHaveText('AB12CD');
  await expect(page.locator('.rp-redeem')).toContainText('redemption counter');
  // all images load
  for (const img of await page.locator('img').all()) {
    expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  }
  // fits the phone: no sideways scroll
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('every character renders on the result page', async ({ page }) => {
  for (const c of ['elfboy', 'elfgirl', 'santa', 'reindeer', 'gingerbread', 'snowman', 'yeti']) {
    await page.goto(`/match?s=AB12CD&c=${c}`);
    await expect(page.locator('.rp-pre')).toHaveText('Your LEGO festive match is…');
    expect(await page.locator('.rp-char').evaluate((i: HTMLImageElement) => i.decode().then(() => i.naturalWidth))).toBeGreaterThan(0);
  }
});

test('a broken link shows a friendly message', async ({ page }) => {
  await page.goto('/match?s=AB12CD&c=grinch');
  await expect(page.locator('.rp-redeem')).toContainText('MATCH NOT FOUND');
});

test('QR from the kiosk opens the same character on the phone', async ({ browser }) => {
  const kioskCtx = await browser.newContext({ viewport: { width: 744, height: 1133 }, permissions: ['camera'] });
  const kiosk = await kioskCtx.newPage();
  await kiosk.goto('/');
  await kiosk.locator('.screen-welcome').click();
  for (const l of 'MIA') await kiosk.locator('.screen-name .k', { hasText: new RegExp(`^${l}$`) }).click();
  await kiosk.locator('.screen-name .pill').click();
  await expect(kiosk.locator('.screen-camera .pill')).toBeEnabled({ timeout: 10_000 });
  await kiosk.locator('.screen-camera .pill').click();
  await kiosk.locator('.screen-confirm .pill').click({ timeout: 8_000 });
  await expect(kiosk.locator('.screen-reveal')).toBeVisible({ timeout: 8_000 });
  const name = (await kiosk.locator('.screen-reveal .np h1').textContent())!.trim();
  const href = (await kiosk.locator('.screen-reveal .qr img').getAttribute('data-href'))!;
  await kioskCtx.close();

  const phoneCtx = await browser.newContext({ ...devices['iPhone 13'] });
  const phone = await phoneCtx.newPage();
  await phone.goto(href);
  await expect(phone.locator('.rp-name')).toHaveText(name);
  await expect(phone.locator('.rp-pre')).toContainText('MIA');
  await expect(phone.locator('.rp-code')).toHaveText(new URL(href).searchParams.get('s')!);
  await phoneCtx.close();
});
