import { test, expect } from '@playwright/test';

for (const theme of ['dark', 'light'] as const) {
  test(`${theme} skyline is decoded at launch and follows live system changes`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/#replay');
    await page.getByRole('button', { name: /Launch flight/ }).click();
    const overlay = page.locator('.flight-overlay');
    const photo = overlay.locator('.flight-city img');
    const canvas = overlay.locator('canvas');
    await expect(overlay).toHaveAttribute('data-theme', theme);
    await expect(photo).toHaveAttribute('src', new RegExp(theme === 'dark' ? 'tower1.webp$' : 'tower2.png$'));
    expect(await photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(overlay.locator('.flight-city')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: info.outputPath('first-frame.png') });
    await expect(canvas).toHaveAttribute('data-running', 'true');
    await expect(canvas).toHaveAttribute('data-night-lights', String(theme === 'dark'));
    await expect.poll(async () => Number(await canvas.getAttribute('data-progress')), { timeout: 7000 }).toBeGreaterThan(.35);
    await page.screenshot({ path: info.outputPath('bank.png') });
    const before = Number(await canvas.getAttribute('data-progress'));
    const handle = await canvas.elementHandle();
    await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
    await expect(overlay).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
    expect(await photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await handle!.evaluate(el => el === document.querySelector('.flight-overlay canvas'))).toBe(true);
    expect(Number(await canvas.getAttribute('data-progress'))).toBeGreaterThanOrEqual(before);
    await expect.poll(async () => Number(await canvas.getAttribute('data-progress')), { timeout: 6000 }).toBeGreaterThan(.68);
    await expect(overlay.locator('.flight-city')).toHaveCSS('opacity', '1');
    expect(Number(await canvas.getAttribute('data-clearance'))).toBeGreaterThan(.1);
    await page.screenshot({ path: info.outputPath('switched-theme-flyover.png') });
    await expect(overlay).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator('.prize-unlocked')).toBeVisible();
    // A client-side route change exercises React cleanup (a page reload would not).
    await page.evaluate(() => {
      history.pushState(null, '', '/admin/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.locator('.flight-experience')).toHaveCount(0);
    await page.emulateMedia({ colorScheme: theme });
    expect(errors).toEqual([]);
  });
}

test('an undecoded theme replacement retains the previous city', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#replay');
  await page.getByRole('button', { name: /Launch flight/ }).click();
  const overlay = page.locator('.flight-overlay');
  await expect(overlay).toHaveAttribute('data-theme', 'light');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/tower1.webp', async route => { await gate; await route.continue(); });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(overlay.locator('img')).toHaveAttribute('src', /tower2.png$/);
  await expect(overlay.locator('.flight-city')).toHaveCSS('opacity', '1');
  release();
  await expect(overlay).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Skip flight' }).click();
  await expect(overlay).toHaveCount(0);
});
