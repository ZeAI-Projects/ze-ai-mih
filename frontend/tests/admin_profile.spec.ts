import { test, expect } from '@playwright/test';

for (const width of [390, 768, 1440]) {
  test(`profile card and admin scroll shell stay organized at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => sessionStorage.setItem('miih.admin.session', JSON.stringify({ access_token: 'ui-test-only' })));
    let profileName = 'UI Test Admin';
    await page.route('**/api/v1/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/admin/me')) {
        return route.fulfill({ json: { id: 'ui-test', full_name: profileName, email: 'admin@example.invalid', role: 'SUPER_ADMIN', approval_status: 'APPROVED' } });
      }
      if (path.endsWith('/admin/permissions')) {
        return route.fulfill({ json: { role: 'SUPER_ADMIN', permissions: [] } });
      }
      if (path.endsWith('/auth/admin/profile') && request.method() === 'PATCH') {
        profileName = (request.postDataJSON() as {full_name:string}).full_name;
        return route.fulfill({ json: { success: true } });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/admin/profile');
    const overview = page.getByRole('region', { name: 'Profile overview' });
    await expect(overview).toContainText('UI Test Admin');
    await expect(overview).toContainText('admin@example.invalid');
    await expect(overview).toContainText('ZEAI – MADE IN INDIA');
    await expect(overview).toContainText('Super Admin');
    await expect(overview).toContainText('Active');
    await expect(overview.locator('.miih-profile-overview-avatar')).toHaveText('U');

    await expect(page.locator('.miih-profile-sections')).toHaveCount(0);
    await expect(overview.getByRole('button', { name: 'Sign out →' })).toBeVisible();
    const overviewBounds = await overview.boundingBox();
    expect(overviewBounds).not.toBeNull();
    expect(overviewBounds!.x).toBeGreaterThanOrEqual(0);
    expect(overviewBounds!.x + overviewBounds!.width).toBeLessThanOrEqual(width);
    expect(overviewBounds!.height).toBeGreaterThanOrEqual(320);

    const sidebar = page.locator('.miih-admin-sidebar');
    await expect(sidebar).toHaveCSS('overflow', 'hidden');
    const main = page.locator('.miih-admin-main');
    const topbar = page.locator('.miih-admin-topbar');
    await main.evaluate(element => { element.scrollTop = 180; });
    await expect.poll(() => topbar.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(0);
    await expect.poll(() => sidebar.evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(0);

    await overview.getByRole('button', { name: 'Edit profile' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit profile' });
    const name = editDialog.getByLabel('Full Name');
    const email = editDialog.getByLabel('Email Address');
    await expect(name).toHaveValue('UI Test Admin');
    await expect(email).toHaveValue('admin@example.invalid');
    await expect(email).toHaveAttribute('readonly', '');
    await name.fill('Updated Admin');
    await editDialog.getByRole('button', { name: 'Continue' }).click();
    await expect(overview).toContainText('Updated Admin');
    await expect(page.getByRole('status')).toContainText('Your profile changes were saved.');

    await overview.getByRole('button', { name: 'Sign out →' }).click();
    await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible();
  });
}

test('sidebar account stays visible while navigation scrolls inline', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 520 });
  await page.addInitScript(() => sessionStorage.setItem('miih.admin.session', JSON.stringify({ access_token: 'ui-test-only' })));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/admin/me')) {
      return route.fulfill({ json: { id: 'ui-test', full_name: 'UI Test Admin', email: 'admin@example.invalid', role: 'SUPER_ADMIN', approval_status: 'APPROVED' } });
    }
    if (path.endsWith('/admin/permissions')) {
      return route.fulfill({ json: { role: 'SUPER_ADMIN', permissions: [] } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/admin/profile');
  const sidebar = page.locator('.miih-admin-sidebar');
  const navigation = sidebar.getByRole('navigation', { name: 'Admin pages' });
  const account = sidebar.locator('.miih-sidebar-bottom');
  await expect(sidebar.locator('.miih-admin-brand')).toBeVisible();
  await expect(navigation).toHaveCSS('overflow-y', 'auto');
  await expect(account).toContainText('UI Test Admin');
  await expect(account.getByRole('button', { name: 'Sign out' })).toBeVisible();

  const before = await account.boundingBox();
  expect(await navigation.evaluate(element => element.scrollHeight)).toBeGreaterThan(
    await navigation.evaluate(element => element.clientHeight),
  );
  await navigation.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => navigation.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const after = await account.boundingBox();
  expect(after!.y).toBe(before!.y);
});
