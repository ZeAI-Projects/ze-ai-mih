import { test, expect } from '@playwright/test';

for (const width of [390, 768, 1440, 1920]) {
  test(`system theme and responsive public/admin surfaces at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1080 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.challenge-domains [aria-pressed="true"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /toggle theme|dark mode|light mode/i })).toHaveCount(0);
    await expect(page.locator('.boarding-pass')).toContainText('Grand Winner — ₹1,00,000');
    await expect(page.locator('.boarding-pass')).toContainText('Ticket for 3');
    await expect(page.locator('.boarding-pass')).not.toContainText(/Decorative|winning members/i);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator('body')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(17, 18, 35)' : 'rgb(255, 255, 255)');
      for (const section of ['home', 'replay', 'challenges', 'rewards', 'about', 'gallery', 'register']) {
        await page.locator(`#${section}`).scrollIntoViewIfNeeded();
        if (section === 'about') await expect(page.locator('.founder-story')).toBeAttached();
        if (section === 'gallery') await expect(page.locator('.gallery-page')).toBeAttached();
        if (section === 'register') await expect(page.locator('.registration-panel')).toBeAttached();
        await page.locator(`#${section}`).scrollIntoViewIfNeeded();
        if (section === 'gallery') await expect(page.locator('.gallery-page')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(17, 18, 35)' : 'rgb(255, 255, 255)');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`${theme}-${section}.png`) });
      }
    }
    await page.goto('/admin/login');
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator('.miih-auth-card')).toBeVisible();
      await expect(page.locator('.miih-auth-intro')).toHaveCSS('color', theme === 'dark' ? 'rgb(244, 239, 255)' : 'rgb(37, 33, 45)');
      await expect(page.locator('.miih-auth-card')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(17, 18, 35)' : 'rgb(255, 255, 255)');
      await page.screenshot({ path: info.outputPath(`${theme}-admin-login.png`) });
    }
  });
}
