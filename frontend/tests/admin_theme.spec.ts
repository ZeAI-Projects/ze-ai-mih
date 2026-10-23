import { test, expect } from '@playwright/test';

// Isolated UI fixtures: no live credentials, writes, or application records.
test('admin routes render in both themes with isolated empty API responses', async ({ page }, info) => {
  test.setTimeout(60_000); // Eighteen route visits and screenshots in this audit.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => sessionStorage.setItem('miih.admin.session', JSON.stringify({ access_token: 'ui-test-only' })));
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    const payload = path.endsWith('/admin/me') ? { id: 'ui-test', full_name: 'UI Test', email: 'test@example.invalid', role: 'SUPER_ADMIN', approval_status: 'APPROVED' }
      : path.endsWith('/admin/permissions') ? { role: 'SUPER_ADMIN', permissions: [] }
      : path.endsWith('/admin/dashboard') ? {}
      : path.endsWith('/admin/statistics') ? { by_domain: [], by_status: [], by_day: [] }
      : [];
    return route.fulfill({ json: payload });
  });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const route of ['dashboard', 'teams', 'participants', 'statistics', 'settings', 'form', 'admins', 'studio', 'profile']) {
      await page.goto(`/admin/${route}`);
      await expect(page.locator('.miih-admin-content')).toBeVisible();
      await expect(page.locator('.miih-admin')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(32, 28, 53)' : 'rgb(249, 246, 255)');
      await page.screenshot({ path: info.outputPath(`${theme}-${route}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
