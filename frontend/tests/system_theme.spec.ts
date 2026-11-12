import { test, expect } from '@playwright/test';

for (const width of [390, 768, 1440, 1920]) {
  test(`system theme and responsive public/admin surfaces at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1080 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.challenge-domains [aria-pressed="true"]')).toHaveCount(0);
    const themeToggle = page.getByRole('button', { name: /switch to dark mode/i });
    await expect(themeToggle).toBeVisible();
    await expect(themeToggle.locator('svg')).toBeVisible();
    await expect(themeToggle).toHaveText('');
    await expect(page.locator('html')).toHaveCSS('scrollbar-width', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
    const headerPositions = await page.evaluate(() => {
      const brand = document.querySelector('.site-header .brand')!.getBoundingClientRect();
      const controls = document.querySelector('.site-header .header-controls')!.getBoundingClientRect();
      return { brandRight: brand.right, controlsLeft: controls.left, controlsRight: controls.right, headerRight: document.querySelector('.site-header .header-inner')!.getBoundingClientRect().right };
    });
    expect(headerPositions.brandRight).toBeLessThan(headerPositions.controlsLeft);
    expect(Math.abs(headerPositions.headerRight - headerPositions.controlsRight)).toBeLessThan(2);
    await expect(page.locator('.boarding-pass')).toContainText('Grand Winner — ₹1,00,000');
    await expect(page.locator('.boarding-pass')).toContainText('Ticket for 3');
    await expect(page.locator('.boarding-pass')).not.toContainText(/Decorative|winning members/i);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
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
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.evaluate(() => localStorage.removeItem('miih.theme'));
    await page.evaluate(() => localStorage.removeItem('miih.admin.theme'));
    await page.emulateMedia({ colorScheme: 'light' });
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
