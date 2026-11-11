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
    await page.goto('/admin/dashboard');
    await page.evaluate(publicTheme => {
      localStorage.removeItem('miih.admin.theme');
      localStorage.setItem('miih.theme', publicTheme);
    }, theme === 'dark' ? 'light' : 'dark');
    for (const route of ['dashboard', 'teams', 'participants', 'statistics', 'settings', 'form', 'admins', 'studio', 'profile']) {
      await page.goto(`/admin/${route}`);
      await expect(page.locator('.miih-admin-content')).toBeVisible();
      await expect(page.locator('.miih-admin')).toHaveAttribute('data-admin-theme', theme);
      await expect(page.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` }))
        .toHaveAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
      await expect(page.locator(`.miih-admin-theme-toggle [data-theme-icon="${theme === 'dark' ? 'sun' : 'moon'}"]`)).toBeAttached();
      if (route === 'dashboard') {
        await expect(page.locator('.miih-stat-grid')).toContainText('Registered Teams');
        await expect(page.locator('.miih-stat-grid')).toContainText('Total Participants');
        await expect(page.locator('.miih-stat-grid')).toContainText('Verified Revenue');
        await expect(page.locator('.miih-stat-grid')).not.toContainText('Pending Team Approvals');
        await expect(page.getByRole('heading', { name: 'Teams awaiting approval' })).toBeVisible();
        const workOverview = page.locator('.miih-admin-panel').filter({ has: page.getByRole('heading', { name: 'Workspace overview' }) });
        await expect(workOverview).toContainText('Set up the event');
        await expect(workOverview).toContainText('Prepare the registration form');
        await expect(workOverview).toContainText('Check readiness and open registration');
        await expect(workOverview).toContainText('Review submissions and payments');
      }
      if (route === 'settings') {
        await expect(page.getByRole('heading', { name: 'Event information' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Dates and registration window' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Team size' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Information for participants' })).toBeVisible();
      }
      await expect(page.locator('.miih-admin')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(32, 28, 53)' : 'rgb(249, 246, 255)');
      await page.screenshot({ path: info.outputPath(`${theme}-${route}.png`) });
    }
  }
  await page.goto('/admin/dashboard');
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('miih:admin-dialog', {
      detail: { title: 'Theme dialog check', fields: [], resolve: () => undefined },
    }));
  });
  const themedDialog = page.locator('.miih-app-dialog');
  await expect(themedDialog).toBeVisible();
  await expect(page.locator('.miih-app-dialog-overlay')).toHaveAttribute('data-admin-theme', 'dark');
  await expect(themedDialog).toHaveCSS('background-color', 'rgb(17, 18, 35)');
  await themedDialog.getByRole('button', { name: 'Cancel and close' }).click();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('.miih-admin')).toHaveAttribute('data-admin-theme', 'light');
  await expect(page.locator('.miih-admin-theme-toggle [data-theme-icon="moon"]')).toBeVisible();
  await page.goto('/admin/teams');
  await expect(page.locator('.miih-admin')).toHaveAttribute('data-admin-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('miih.theme'))).toBe('light');
  expect(await page.evaluate(() => localStorage.getItem('miih.admin.theme'))).toBe('light');
  await page.goto('/admin/dashboard');
  const dashboardPrint = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Export dashboard PDF' }).click();
  const dashboardPdf = await dashboardPrint;
  await expect(dashboardPdf).toHaveTitle('Dashboard summary');
  await expect(dashboardPdf.locator('#miih-dashboard-export')).toContainText('Registered Teams');
  await dashboardPdf.close();

  await page.goto('/admin/statistics');
  const statisticsPrint = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Export statistics PDF' }).click();
  const statisticsPdf = await statisticsPrint;
  await expect(statisticsPdf).toHaveTitle('Statistics report');
  await expect(statisticsPdf.locator('#miih-statistics-export')).toContainText('Teams by Domain');
  await statisticsPdf.close();
  expect(errors).toEqual([]);
});
