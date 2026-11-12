import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['iPhone 13'], browserName: 'chromium' });

const CARDS = {
  elfboy: 'Elf Boy',
  elfgirl: 'Elf Girl',
  santa: 'Santa',
  reindeer: 'Reindeer',
  gingerbread: 'Gingerbread',
  snowman: 'Snowman',
  yeti: 'Yeti',
} as const;

test('phone result page shows the client card, the name, Save and the crew reminder', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/match?s=AB12CD&c=elfgirl&n=ANNA&t=1796000000');
  await expect(page.locator('.rp-pre')).toHaveText('ANNA, you’re the Elf Girl!');
  await expect(page.locator('.rp-card')).toHaveAttribute('src', '/assets/cards/elfgirl.jpg');
  await expect(page.getByRole('button', { name: 'Save my card' })).toBeVisible();
  await expect(page.locator('.rp-note')).toHaveText(/Show this screen to our crew\s*to get a character card!/);
  for (const img of await page.locator('img').all()) {
    expect(await img.evaluate((i: HTMLImageElement) => i.decode().then(() => i.naturalWidth))).toBeGreaterThan(0);
  }
  // the card is shown untouched, at its 4:5 design ratio
  const box = (await page.locator('.rp-card').boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(0.8, 2);
  expect(errors).toEqual([]);
});

test('every character has its card', async ({ page }) => {
  for (const [id, name] of Object.entries(CARDS)) {
    await page.goto(`/match?s=AB12CD&c=${id}`);
    await expect(page.locator('.rp-pre')).toHaveText(id === 'santa' ? 'You’re Santa!' : `You’re the ${name}!`);
    await expect(page.locator('.rp-card')).toHaveAttribute('src', `/assets/cards/${id}.jpg`);
    const size = await page.locator('.rp-card').evaluate((i: HTMLImageElement) => i.decode().then(() => [i.naturalWidth, i.naturalHeight]));
    expect(size).toEqual([1080, 1350]);
  }
});

test('Save my card downloads the original card file', async ({ browser }) => {
  // Desktop browser: no file sharing, so it falls back to a download.
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto('/match?s=AB12CD&c=yeti&n=MIA');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save my card' }).click()]);
  expect(download.suggestedFilename()).toBe('LEGO-Santas-Toy-Factory-Yeti-MIA.jpg');
  const path = await download.path();
  const { statSync, readFileSync } = await import('node:fs');
  const original = readFileSync(new URL('../../public/assets/cards/yeti.jpg', import.meta.url));
  expect(statSync(path).size).toBe(original.length); // byte-for-byte the client's file
  await ctx.close();
});

test('a broken link shows a friendly message', async ({ page }) => {
  await page.goto('/match?s=AB12CD&c=grinch');
  await expect(page.locator('.rp-msg')).toContainText('Match not found');
});

test('QR from the kiosk opens the same character card on the phone', async ({ browser }) => {
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
  const href = (await kiosk.locator('.screen-reveal .collect-qr img').getAttribute('data-href'))!;
  await kioskCtx.close();

  const phoneCtx = await browser.newContext({ ...devices['iPhone 13'] });
  const phone = await phoneCtx.newPage();
  await phone.goto(href);
  await expect(phone.locator('.rp-pre')).toContainText('MIA');
  await expect(phone.locator('.rp-pre')).toContainText(name);
  await expect(phone.locator('.rp-card')).toHaveAttribute('src', new RegExp(`/assets/cards/${new URL(href).searchParams.get('c')}\\.jpg$`));
  await phoneCtx.close();
});

for (const device of ['iPhone SE', 'iPhone 12 Mini', 'iPhone 15 Pro Max', 'Pixel 5', 'Galaxy S9+']) {
  test(`fits without scrolling on ${device}`, async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices[device] });
    const page = await ctx.newPage();
    await page.goto('/match?s=AB12CD&c=gingerbread&n=FESTIVEFRIEND&t=1796000000');
    await expect(page.locator('.rp-note')).toBeVisible();
    await page.waitForTimeout(1200); // let the entrance animations finish
    const fit = await page.evaluate(() => ({
      noScroll: document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth,
      allOnScreen: document.querySelector('.rp-note')!.getBoundingClientRect().bottom <= innerHeight && document.querySelector('.rp-pre')!.getBoundingClientRect().top >= 0,
      cardWidth: (document.querySelector('.rp-card') as HTMLElement).offsetWidth,
    }));
    expect(fit.noScroll).toBe(true);
    expect(fit.allOnScreen).toBe(true);
    expect(fit.cardWidth).toBeGreaterThan(250);
    await ctx.close();
  });
}
