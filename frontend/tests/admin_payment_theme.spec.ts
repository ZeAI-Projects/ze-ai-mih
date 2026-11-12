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

test('admin can edit contiguous payment ranges with separate amounts and Razorpay links', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('miih.admin.session', JSON.stringify({ access_token: 'ui-test-only' }));
    localStorage.setItem('miih.admin.theme', 'light');
  });
  const savedConfigs: Record<string, unknown>[] = [];
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/payments/config')) {
      if (route.request().method() === 'POST') {
        const savedConfig = route.request().postDataJSON() as Record<string, unknown>;
        savedConfigs.push(savedConfig);
        return route.fulfill({ json: { ...savedConfig, id: 'payment-config-id', is_active: false } });
      }
      const savedConfig = savedConfigs.at(-1);
      return route.fulfill({ json: savedConfig ? [{ ...savedConfig, id: 'payment-config-id', is_active: false }] : [] });
    }
    if (path.endsWith('/admin/me')) {
      return route.fulfill({ json: { id: 'ui-test', full_name: 'UI Test Admin', email: 'admin@example.invalid', role: 'SUPER_ADMIN', approval_status: 'APPROVED' } });
    }
    if (path.endsWith('/admin/permissions')) {
      return route.fulfill({ json: { role: 'SUPER_ADMIN', permissions: [] } });
    }
    if (path.endsWith('/admin/editions')) {
      return route.fulfill({ json: [{ id: 'edition-id', edition_code: 'MIIH_UPCOMING', title: 'Hackathon' }] });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/admin/admins');
  await expect(page.getByText('Team-size pricing rules')).toBeVisible();
  const ranges = page.locator('.miih-payment-pricing-rule');
  await expect(ranges).toHaveCount(3);
  const starts = page.getByLabel('Members from');
  const ends = page.getByLabel('Members through (blank means and above)');
  const fees = page.getByLabel('Team fee (₹)');
  const urls = page.getByLabel('Razorpay Payment Page URL');
  await expect(starts.nth(0)).toHaveValue('1');
  await expect(starts.nth(1)).toHaveValue('2');
  await expect(starts.nth(2)).toHaveValue('3');
  await expect(fees.nth(0)).toHaveValue('1000');
  await expect(fees.nth(1)).toHaveValue('2000');
  await expect(fees.nth(2)).toHaveValue('3000');
  await expect(urls.nth(0)).toHaveValue('https://rzp.io/rzp/pG1DOFl');
  await expect(urls.nth(1)).toHaveValue('https://rzp.io/rzp/MVb6HKp');
  await expect(urls.nth(2)).toHaveValue('https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view');

  await page.getByRole('button', { name: 'Add team-size range' }).click();
  const paymentRefresh = page.waitForResponse(response => response.url().includes('/payments/config') && response.request().method() === 'GET');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await paymentRefresh;
  await expect(ranges).toHaveCount(4);
  await expect(ends.nth(2)).toHaveValue('3');
  await expect(starts.nth(3)).toHaveValue('4');
  await expect(ends.nth(3)).toHaveValue('');
  await expect(fees.nth(3)).toHaveValue('3000');
  await expect(urls.nth(3)).toHaveValue('https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view');
  const saveButton = page.getByRole('button', { name: 'Save payment configuration' });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.getByRole('dialog', { name: 'Confirm payment configuration' }).getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('status')).toContainText('Razorpay configuration saved.');
  expect(savedConfigs.at(-1)?.team_size_pricing).toEqual([
    { min_members: 1, max_members: 1, fee_amount: 1000, razorpay_payment_url: 'https://rzp.io/rzp/pG1DOFl' },
    { min_members: 2, max_members: 2, fee_amount: 2000, razorpay_payment_url: 'https://rzp.io/rzp/MVb6HKp' },
    { min_members: 3, max_members: 3, fee_amount: 3000, razorpay_payment_url: 'https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view' },
    { min_members: 4, max_members: null, fee_amount: 3000, razorpay_payment_url: 'https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view' },
  ]);
});

test('four-member editions use exact ranges and keep unsaved edits after a refresh', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('miih.admin.session', JSON.stringify({ access_token: 'ui-test-only' }));
    localStorage.setItem('miih.admin.theme', 'light');
  });
  const savedConfigs: Record<string, unknown>[] = [];
  const existingRules = [
    { min_members: 1, max_members: 1, fee_amount: 1000, razorpay_payment_url: 'https://rzp.io/rzp/pG1DOFl' },
    { min_members: 2, max_members: 2, fee_amount: 2000, razorpay_payment_url: 'https://rzp.io/rzp/MVb6HKp' },
    { min_members: 3, max_members: null, fee_amount: 3000, razorpay_payment_url: 'https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view' },
  ];
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/admin/me')) {
      return route.fulfill({ json: { id: 'ui-test', full_name: 'UI Test Admin', email: 'admin@example.invalid', role: 'SUPER_ADMIN', approval_status: 'APPROVED' } });
    }
    if (path.endsWith('/admin/permissions')) {
      return route.fulfill({ json: { role: 'SUPER_ADMIN', permissions: [] } });
    }
    if (path.endsWith('/admin/editions')) {
      return route.fulfill({ json: [{ id: 'edition-id', edition_code: 'MIIH_UPCOMING', title: 'Hackathon', max_team_size: 4 }] });
    }
    if (path.endsWith('/payments/config')) {
      if (route.request().method() === 'POST') {
        const saved = route.request().postDataJSON() as Record<string, unknown>;
        savedConfigs.push(saved);
        return route.fulfill({ json: { ...saved, id: 'payment-config-id', is_active: false } });
      }
      const current = savedConfigs.at(-1) || {
        button_label: 'Pay now',
        fee_amount: 3000,
        razorpay_payment_url: 'https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view',
        team_size_pricing: existingRules,
        is_active: false,
      };
      return route.fulfill({ json: [{ ...current, id: 'payment-config-id' }] });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/admin/admins');
  const ranges = page.locator('.miih-payment-pricing-rule');
  await expect(ranges).toHaveCount(4);
  const ends = page.getByLabel('Members through (blank means and above)');
  const fees = page.getByLabel('Team fee (₹)');
  await expect(ends.nth(2)).toHaveValue('3');
  await expect(ends.nth(3)).toHaveValue('4');
  await expect(page.getByRole('button', { name: 'Add team-size range' })).toBeDisabled();

  await fees.nth(3).fill('4200');
  const paymentRefresh = page.waitForResponse(response => response.url().includes('/payments/config') && response.request().method() === 'GET');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await paymentRefresh;
  await expect(fees.nth(3)).toHaveValue('4200');

  const formValidity = await page.locator('#payment form').evaluate(form => ({
    valid: (form as HTMLFormElement).checkValidity(),
    invalid: Array.from(form.querySelectorAll<HTMLInputElement>(':invalid')).map(input => ({
      value: input.value,
      type: input.type,
      label: input.labels?.[0]?.textContent,
    })),
  }));
  expect(formValidity).toEqual({ valid: true, invalid: [] });
  await page.getByRole('button', { name: 'Save payment configuration' }).click();
  await page.getByRole('dialog', { name: 'Confirm payment configuration' }).getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('status')).toContainText('Razorpay configuration saved.');
  expect(savedConfigs.at(-1)?.team_size_pricing).toEqual([
    ...existingRules.slice(0, 2),
    { ...existingRules[2], max_members: 3 },
    { ...existingRules[2], min_members: 4, max_members: 4, fee_amount: 4200 },
  ]);
});
