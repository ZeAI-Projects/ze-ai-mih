import { test, expect } from '@playwright/test';

test('team payment and review actions match light and dark admin themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    sessionStorage.setItem('miih.admin.session', JSON.stringify({ access_token: 'ui-test-only' }));
    localStorage.setItem('miih.admin.theme', 'light');
  });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/admin/me')) {
      return route.fulfill({ json: { id: 'ui-test', full_name: 'UI Test Admin', email: 'admin@example.invalid', role: 'SUPER_ADMIN', approval_status: 'APPROVED' } });
    }
    if (path.endsWith('/admin/permissions')) {
      return route.fulfill({ json: { role: 'SUPER_ADMIN', permissions: ['TEAMS_VIEW', 'REGISTRATION_REVIEW'] } });
    }
    if (path === '/api/v1/admin/teams') {
      return route.fulfill({ json: [{ id: 'team-id', team_id: 'MIH-001', registration_code: 'REG-001', team_name: 'Test Team', domain_name: 'AI', edition: '2027', member_count: 2, status: 'SUBMITTED', submitted_at: '2026-11-11T00:00:00Z' }] });
    }
    if (path.endsWith('/admin/teams/team-id')) {
      return route.fulfill({ json: { id: 'team-id', team_name: 'Test Team', registration_code: 'REG-001', status: 'SUBMITTED', members: [], answers: [] } });
    }
    if (path.endsWith('/admin/teams/team-id/payments')) {
      return route.fulfill({ json: [{ id: 'payment-id', transaction_id: 'TXN-001', claimed_amount: 3000, status: 'PENDING', proof_file_id: null }] });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/admin/teams');
  await page.getByRole('button', { name: 'View ↗' }).click();
  const drawer = page.locator('.miih-admin-drawer');
  const verify = drawer.getByRole('button', { name: 'Verify payment' });
  const rejectProof = drawer.getByRole('button', { name: 'Reject proof' });
  const rejectTeam = drawer.getByRole('button', { name: 'Reject team' });
  await expect(verify).toBeVisible();
  await expect(rejectProof).toBeVisible();
  await expect(rejectTeam).toBeVisible();

  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') {
      await drawer.getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      await page.getByRole('button', { name: 'View ↗' }).click();
    }
    await expect(page.locator('.miih-admin')).toHaveAttribute('data-admin-theme', theme);
    await expect(verify).toHaveCSS('background-image', 'linear-gradient(115deg, rgb(116, 64, 215), rgb(149, 84, 239))');
    await expect(rejectProof).toHaveCSS('background-color', theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(17, 18, 35)');
    await expect(rejectTeam).toHaveCSS('color', theme === 'light' ? 'rgb(163, 40, 73)' : 'rgb(255, 153, 175)');
  }
});
