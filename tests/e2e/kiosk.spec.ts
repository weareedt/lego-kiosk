import { expect, test, type Page } from '@playwright/test';

/** Fails the test on any console error or uncaught exception. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function typeName(page: Page, name: string) {
  for (const l of name) await page.locator('.screen-name .k', { hasText: new RegExp(`^${l}$`) }).click();
}

/** Welcome → Name → Camera → 3-2-1 → Confirm. */
async function toConfirm(page: Page, name = 'ANNA') {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await typeName(page, name);
  await expect(page.locator('.screen-name .field')).toContainText(name);
  await page.locator('.screen-name .pill').click();
  const shoot = page.locator('.screen-camera .pill');
  await expect(shoot).toBeEnabled({ timeout: 10_000 }); // camera live
  await expect(page.locator('.screen-camera .head.ok')).toBeVisible();
  await shoot.click();
  await expect(page.locator('.screen-countdown')).toBeVisible();
  await expect(page.locator('.screen-confirm')).toBeVisible({ timeout: 6_000 });
}

test('full guest journey: welcome to reveal to stamp card to auto reset', async ({ page }) => {
  const errors = watchErrors(page);
  await toConfirm(page);

  // Factory Pass shows the captured photo and name, and a face was found in it
  await expect(page.locator('.screen-confirm .ph img')).toHaveAttribute('src', /^data:image\/jpeg/);
  await expect(page.locator('.screen-confirm')).toHaveAttribute('data-face-found', 'true', { timeout: 10_000 });
  await expect(page.locator('.screen-confirm .noface')).toHaveCount(0);
  await expect(page.locator('.screen-confirm .pass')).toContainText('ANNA');

  await page.locator('.screen-confirm .pill').click();
  await expect(page.locator('.screen-matching')).toBeVisible();
  await expect(page.locator('.screen-reveal')).toBeVisible({ timeout: 8_000 });

  // Reveal: personalised, a character, and a QR pointing at the phone result page
  await expect(page.locator('.screen-reveal .pre')).toContainText('ANNA, your LEGO festive match is');
  const characterName = (await page.locator('.screen-reveal .np h1').textContent())!.trim();
  expect(characterName.length).toBeGreaterThan(0);
  const qr = page.locator('.screen-reveal .qr img');
  await expect(qr).toHaveAttribute('src', /^data:image\/png/);
  const href = await qr.getAttribute('data-href');
  expect(href).toMatch(/\/match\?s=[A-Z0-9]{6}&c=[a-z]+&n=ANNA&t=\d+$/);

  await page.locator('.screen-reveal .pill2').click();
  await expect(page.locator('.screen-stampcard')).toBeVisible();
  await expect(page.locator('.screen-stampcard .panel')).toContainText('Head to the counter, ANNA');
  await expect(page.locator('.screen-stampcard .tag-head')).toContainText(characterName.toUpperCase());

  // Auto reset after 20 s, everything cleared
  await expect(page.locator('.screen-welcome')).toBeVisible({ timeout: 23_000 });
  await page.locator('.screen-welcome').click();
  await expect(page.locator('.screen-name .field')).toContainText('0 / 12');

  expect(errors).toEqual([]);
});

test('retake goes back to the live camera', async ({ page }) => {
  await toConfirm(page);
  await page.locator('.screen-confirm').getByRole('button', { name: 'Retake' }).click();
  await expect(page.locator('.screen-camera .pill')).toBeEnabled();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'ok', { timeout: 10_000 });
});

test('if the camera stream dies, Retake restarts it and the next photo works', async ({ page }) => {
  await toConfirm(page);
  // Simulate the camera dropping out (another app grabs it, iOS suspends it…)
  await page.evaluate(() => {
    const v = document.querySelector('video') as HTMLVideoElement | null;
    (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
  });
  await page.locator('.screen-confirm').getByRole('button', { name: 'Retake' }).click();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'ok', { timeout: 15_000 });
  const live = await page.evaluate(() =>
    ((document.querySelector('.screen-camera video') as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0].readyState,
  );
  expect(live).toBe('live');
  await page.locator('.screen-camera .pill').click();
  await expect(page.locator('.screen-confirm')).toHaveAttribute('data-face-found', 'true', { timeout: 10_000 });
  await expect(page.locator('.screen-confirm .ph img')).toHaveAttribute('src', /^data:image\/jpeg/);
});

test('a camera that dies mid-countdown gives a friendly message, then Retake recovers', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .pill')).toBeEnabled({ timeout: 10_000 });
  await page.locator('.screen-camera .pill').click();
  await expect(page.locator('.screen-countdown')).toBeVisible();
  await page.evaluate(() => {
    const v = document.querySelector('video') as HTMLVideoElement | null;
    (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
  });
  const confirm = page.locator('.screen-confirm');
  await expect(confirm).toHaveAttribute('data-face-found', 'false', { timeout: 8_000 });
  await expect(confirm.locator('.noface')).toBeVisible();
  await expect(confirm.locator('.ph img')).toHaveCount(0); // no black photo
  await confirm.getByRole('button', { name: 'Retake' }).click();
  await expect(page.locator('.screen-camera .win')).toHaveAttribute('data-face', 'ok', { timeout: 15_000 });
});

test('skip uses "Festive Friend" and the QR leaves the name out', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .pill')).toBeEnabled({ timeout: 10_000 });
  await page.locator('.screen-camera .pill').click();
  await page.locator('.screen-confirm .pill').click({ timeout: 8_000 });
  await expect(page.locator('.screen-reveal .pre')).toContainText('Festive Friend', { timeout: 8_000 });
  expect(await page.locator('.screen-reveal .qr img').getAttribute('data-href')).not.toContain('&n=');
});

test('Continue is disabled until a name is typed; back returns to welcome', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await expect(page.locator('.screen-name .pill')).toBeDisabled();
  await typeName(page, 'A');
  await expect(page.locator('.screen-name .pill')).toBeEnabled();
  await page.locator('.screen-name .k[aria-label="Delete"]').click();
  await expect(page.locator('.screen-name .pill')).toBeDisabled();
  await page.locator('.screen-name .back').click();
  await expect(page.locator('.screen-welcome')).toBeVisible();
});

test('on-screen keyboard: 12-letter limit, space, apostrophe, clear', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  const field = page.locator('.screen-name .field');
  await typeName(page, 'ABCDEFGHIJKLMN');
  await expect(field).toContainText('ABCDEFGHIJKL');
  await expect(field).toContainText('12 / 12');
  await page.locator('.screen-name .k', { hasText: 'CLEAR' }).click();
  await page.locator('.screen-name .k', { hasText: 'SPACE' }).click(); // leading space ignored
  await expect(field).toContainText('0 / 12');
  await typeName(page, 'JO');
  await page.locator('.screen-name .k', { hasText: '’' }).click();
  await expect(field).toContainText('JO’');
});

test('laptop keyboard types the name and Enter continues', async ({ page }) => {
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.keyboard.type("o'brien-x");
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(' jo');
  await expect(page.locator('.screen-name .field')).toContainText('O’BRIEN JO');
  await page.keyboard.press('Enter');
  await expect(page.locator('.screen-camera')).toBeVisible();
});

test('staff override ?force= gives the next guest that character', async ({ page }) => {
  await page.goto('/?force=yeti');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera .pill')).toBeEnabled({ timeout: 10_000 });
  await page.locator('.screen-camera .pill').click();
  await page.locator('.screen-confirm .pill').click({ timeout: 8_000 });
  await expect(page.locator('.screen-reveal .np h1')).toHaveText('Yeti', { timeout: 8_000 });
});

test('blocked camera: guest can still get a match', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
  });
  await page.goto('/');
  await page.locator('.screen-welcome').click();
  await page.locator('.screen-name .skip').click();
  await expect(page.locator('.screen-camera-error')).toContainText('Camera needs a hand');
  await page.locator('.screen-camera-error .pill').click();
  await expect(page.locator('.screen-reveal')).toBeVisible({ timeout: 8_000 });
});

test.describe('idle', () => {
  test('“Still building?” appears after 30 s on Name, then starts over', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.locator('.screen-welcome').click();
    await typeName(page, 'ANNA');
    await page.clock.runFor(31_000);
    await expect(page.locator('.idle')).toBeVisible();
    await page.clock.runFor(11_000);
    await expect(page.locator('.screen-welcome')).toBeVisible();
    await page.locator('.screen-welcome').click();
    await expect(page.locator('.screen-name .field')).toContainText('0 / 12'); // name wiped
  });

  test('“I’m still here” keeps the guest where they were', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.locator('.screen-welcome').click();
    await typeName(page, 'ANNA');
    await page.clock.runFor(31_000);
    await page.locator('.idle-stay').click();
    await expect(page.locator('.idle')).toHaveCount(0);
    await expect(page.locator('.screen-name .field')).toContainText('ANNA');
  });
});
