import { expect, test, type Page } from '@playwright/test';

/** Collects the usage events a page sends to /api/events. */
function watchEvents(page: Page) {
  const sent: { type: string; session: string; character?: string }[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/events') && r.method() === 'POST') sent.push(...(r.postDataJSON().events ?? []));
  });
  return sent;
}

test('a guest journey and a QR scan are counted, and /stats shows them', async ({ page, browser }) => {
  const sent = watchEvents(page);
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .pill')).toBeEnabled({ timeout: 10_000 });
  await page.locator('.screen-camera .pill').click();
  await page.locator('.screen-confirm .pill').click({ timeout: 8_000 });
  await expect(page.locator('.screen-reveal')).toBeVisible({ timeout: 8_000 });
  const href = new URL((await page.locator('.screen-reveal .collect-qr img').getAttribute('data-href'))!);
  const session = href.searchParams.get('s')!;

  await expect
    .poll(() => sent.filter((e) => e.session === session).map((e) => e.type))
    .toEqual(['start', 'camera', 'confirm', 'matching', 'reveal']);
  expect(sent.find((e) => e.type === 'reveal')?.character).toBe(href.searchParams.get('c'));

  // The guest scans the QR on their phone.
  const phone = await browser.newPage();
  const phoneSent = watchEvents(phone);
  await phone.goto(href.pathname + href.search);
  await expect.poll(() => phoneSent.map((e) => `${e.type}:${e.session}`)).toContain(`qr:${session}`);
  await phone.close();

  const stats = await (await page.request.get('/api/stats')).json();
  const counted = stats.days.reduce((a: number, d: { counts: Record<string, number> }) => a + (d.counts.qr ?? 0), 0);
  expect(counted).toBeGreaterThan(0);

  await page.goto('/stats');
  await expect(page.locator('.st h1')).toHaveText('Kiosk usage');
  await expect(page.locator('.st-table tbody tr').first()).toBeVisible();
});
