import { test, expect } from '@playwright/test';

for (const width of [390, 768, 1440, 1920]) {
  test(`public navigation, branding, FAQ and card states at ${width}px`, async ({ page }, info) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1080 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    // Empty published catalogue, not fabricated challenge records.
    await page.route('**/api/v1/public/problem-statement-tracks', r => r.fulfill({ json: [] }));
    await page.route('**/api/v1/public/challenge-domains', r => r.fulfill({ json: [] }));
    await page.route('**/api/v1/public/problem-statements?*', r => r.fulfill({ json: { items: [], total: 0 } }));
    await page.goto('/');
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator('.zeai-crop').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect.poll(() => page.locator('.site-header .zeai-crop img').evaluate((im: HTMLImageElement) => im.currentSrc.includes('logo-footer'))).toBe(theme === 'dark');
      for (const section of ['about', 'gallery', 'register']) {
        const menu = page.getByRole('button', { name: 'Open navigation' });
        if (await menu.isVisible()) await menu.click();
        await page.locator(`#primary-nav a[href="/#${section}"]`).click();
        await expect(page).toHaveURL(new RegExp(`#${section}$`));
        await expect.poll(() => page.evaluate(id => {
          const target = document.getElementById(id)!;
          return Math.round(target.getBoundingClientRect().top - document.querySelector('.site-header')!.getBoundingClientRect().bottom);
        }, section)).toBeGreaterThanOrEqual(16);
        await expect.poll(() => page.locator(`#${section}`).evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(180);
      }
      await page.locator('.site-header .brand').click();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await page.screenshot({ path: info.outputPath(`${theme}-header-hero.png`) });
      await page.locator('#replay').scrollIntoViewIfNeeded();
      await expect(page.locator('.season-next-pool')).toContainText('₹20,00,000');
      await expect(page.locator('.boarding-pass')).toContainText('Ticket for 3');
      await expect(page.locator('.flight-experience.flight-ready .flight-city img')).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${theme}-reward-card.png`) });
      const all = page.locator('.challenge-domains button').first();
      await all.scrollIntoViewIfNeeded();
      if (theme === 'light') await expect(all).toHaveAttribute('aria-pressed', 'false');
      await all.hover();
      await expect(all).not.toHaveCSS('box-shadow', 'none');
      await all.click();
      await expect(all).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.challenge-empty')).toContainText('CHALLENGES UNLOCKING SOON');
      await page.screenshot({ path: info.outputPath(`${theme}-domains.png`) });
      await page.locator('#faq').scrollIntoViewIfNeeded();
      const faq = page.locator('#faq details').first();
      await faq.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(faq).toHaveAttribute('open', '');
      await expect(faq.locator('p')).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${theme}-faq.png`) });
      await page.keyboard.press('Enter');
      await expect(faq).not.toHaveAttribute('open', '');
      await page.locator('.site-footer').scrollIntoViewIfNeeded();
      await expect.poll(() => page.locator('.footer-logo img').evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth > 0)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${theme}-footer.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test('repeated anchors and logo navigation retain smooth scrolling', async ({ page }) => {
  await page.goto('/#register');
  await expect(page.locator('.registration-panel')).toBeAttached();
  await page.locator('#primary-nav a[href="/#register"]').click();
  await page.evaluate(() => window.scrollBy(0, 450));
  await page.locator('#primary-nav a[href="/#register"]').click();
  await expect.poll(() => page.locator('#register').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(180);
  await page.locator('.site-header .brand').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.goto('/#faq');
  await expect(page.locator('#participation-faq-title')).toBeAttached();
  await expect.poll(() => page.locator('#faq').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(180);
  expect(await page.locator('#participation-faq-title').evaluate(el => el.getBoundingClientRect().top - document.querySelector('.site-header')!.getBoundingClientRect().bottom)).toBeGreaterThan(16);
});
