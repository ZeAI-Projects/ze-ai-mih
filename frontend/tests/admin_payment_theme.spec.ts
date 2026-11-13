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

test('admin normalizes, edits, removes, saves and reloads threshold-only payment rules', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('miih.admin.session', JSON.stringify({ access_token: 'ui-test-only' }));
    localStorage.setItem('miih.admin.theme', 'light');
  });
  const legacyRules = [
    { min_members: 5, max_members: null, fee_amount: 5000, razorpay_payment_url: 'https://rzp.io/rzp/five' },
    { min_members: 1, max_members: 2, fee_amount: 1000, razorpay_payment_url: 'https://rzp.io/rzp/one' },
    { min_members: 3, max_members: 4, fee_amount: 3000, razorpay_payment_url: 'https://rzp.io/rzp/three' },
  ];
  let persisted: Record<string, unknown> | undefined;
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/payments/config')) {
      if (route.request().method() === 'POST') {
        persisted = { ...route.request().postDataJSON() as Record<string, unknown>, id: 'payment-config-id', is_active: false };
        return route.fulfill({ json: persisted });
      }
      return route.fulfill({ json: [persisted || {
        id: 'payment-config-id',
        button_label: 'Pay',
        fee_amount: 5000,
        razorpay_payment_url: 'https://rzp.io/rzp/five',
        team_size_pricing: legacyRules,
        is_active: false,
      }] });
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
  const paymentToggle = page.getByRole('button', { name: 'Show configuration' });
  await expect(paymentToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Members from')).toHaveCount(0);
  await paymentToggle.click();
  await expect(page.getByRole('button', { name: 'Hide configuration' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Team-size pricing rules')).toBeVisible();
  const ranges = page.locator('.miih-payment-pricing-rule');
  await expect(ranges).toHaveCount(3);
  const starts = page.getByLabel('Members from');
  const fees = page.getByLabel('Team fee (₹)');
  const urls = page.getByLabel('Razorpay Payment Page URL');
  await expect.poll(async () => await starts.evaluateAll(elements => elements.map(element => (element as HTMLInputElement).value))).toEqual(['1', '3', '5']);
  await expect.poll(async () => await fees.evaluateAll(elements => elements.map(element => (element as HTMLInputElement).value))).toEqual(['1000', '3000', '5000']);
  await expect.poll(async () => await urls.evaluateAll(elements => elements.map(element => (element as HTMLInputElement).value))).toEqual([
    'https://rzp.io/rzp/one',
    'https://rzp.io/rzp/three',
    'https://rzp.io/rzp/five',
  ]);
  await fees.nth(1).fill('3333');
  await page.getByRole('button', { name: 'Hide configuration' }).click();
  await expect(page.getByLabel('Members from')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show configuration' }).click();
  await expect(fees.nth(1)).toHaveValue('3333');
  await fees.nth(1).fill('3000');
  await starts.nth(1).fill('4');
  await fees.nth(1).fill('4200');
  await urls.nth(1).fill('https://rzp.io/rzp/four');
  await page.getByRole('button', { name: 'Add pricing rule' }).click();
  await expect.poll(async () => await starts.evaluateAll(elements => elements.map(element => (element as HTMLInputElement).value))).toEqual(['1', '4', '5', '6']);
  await ranges.nth(2).getByRole('button', { name: 'Remove rule' }).click();
  await expect.poll(async () => await starts.evaluateAll(elements => elements.map(element => (element as HTMLInputElement).value))).toEqual(['1', '4', '6']);
  const saveButton = page.getByRole('button', { name: 'Save payment configuration' });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.getByRole('dialog', { name: 'Confirm payment configuration' }).getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('status')).toContainText('Razorpay configuration saved.');
  expect(persisted?.team_size_pricing).toEqual([
    { min_members: 1, fee_amount: 1000, razorpay_payment_url: 'https://rzp.io/rzp/one' },
    { min_members: 4, fee_amount: 4200, razorpay_payment_url: 'https://rzp.io/rzp/four' },
    { min_members: 6, fee_amount: 5000, razorpay_payment_url: 'https://rzp.io/rzp/five' },
  ]);
  const savedRules=persisted?.team_size_pricing as Record<string,unknown>[];
  expect(savedRules.every(rule=>!Object.prototype.hasOwnProperty.call(rule,'max_members'))).toBe(true);

  await page.reload();
  await page.getByRole('button', { name: 'Show configuration' }).click();
  await expect(ranges).toHaveCount(3);
  await expect.poll(async () => await starts.evaluateAll(elements => elements.map(element => (element as HTMLInputElement).value))).toEqual(['1', '4', '6']);
  await expect.poll(async () => await fees.evaluateAll(elements => elements.map(element => (element as HTMLInputElement).value))).toEqual(['1000', '4200', '5000']);
  await expect.poll(async () => await urls.evaluateAll(elements => elements.map(element => (element as HTMLInputElement).value))).toEqual([
    'https://rzp.io/rzp/one',
    'https://rzp.io/rzp/four',
    'https://rzp.io/rzp/five',
  ]);
});

test('admin blocks duplicate thresholds, invalid amounts and non-Razorpay URLs', async ({ page }) => {
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
      return route.fulfill({ json: { role: 'SUPER_ADMIN', permissions: [] } });
    }
    if (path.endsWith('/payments/config')) {
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/admin/admins');
  await page.getByRole('button', { name: 'Show configuration' }).click();
  await expect(page.locator('.miih-payment-pricing-rule')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add pricing rule' }).click();
  const starts=page.getByLabel('Members from');
  const fees=page.getByLabel('Team fee (₹)');
  const urls=page.getByLabel('Razorpay Payment Page URL');
  const saveButton=page.getByRole('button', { name: 'Save payment configuration' });

  await starts.nth(1).fill('1');
  await expect(page.getByRole('alert')).toContainText('Members from values must be unique.');
  await expect(saveButton).toBeDisabled();
  await starts.nth(1).fill('2');

  await fees.nth(1).fill('0');
  await expect(page.getByRole('alert')).toContainText('Each pricing range needs a positive fee.');
  await expect(saveButton).toBeDisabled();
  await fees.nth(1).fill('2000');

  await urls.nth(1).fill('https://checkout.example/second-tier');
  await expect(page.getByRole('alert')).toContainText('valid HTTPS Razorpay payment URL');
  await expect(saveButton).toBeDisabled();
});
