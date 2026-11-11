import { test, expect } from '@playwright/test';

test('header Register scrolls to the section, other register actions open the modal and validation preserves form data', async ({ page }) => {
  const edition = {
    id: 'edition-1',
    edition_code: 'MIIH_UPCOMING',
    title: 'Made in India Hackathon',
    status: 'OPEN',
    min_team_size: 1,
    max_team_size: 2,
  };
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/public/editions')) return route.fulfill({ json: [edition] });
    if (path.endsWith('/public/editions/MIIH_UPCOMING/content') || path.endsWith('/public/site-content/REGISTER')) {
      return route.fulfill({ json: [] });
    }
    if (path.endsWith('/public/problem-statement-tracks') || path.endsWith('/public/challenge-domains')) {
      return route.fulfill({ json: [] });
    }
    if (path.endsWith('/public/problem-statements')) return route.fulfill({ json: { items: [], total: 0 } });
    if (path.endsWith('/public/editions/MIIH_UPCOMING/registration-config')) {
      return route.fulfill({ json: {
        edition,
        domains: [{ id: 'domain-1', domain_name: 'AI' }],
        form: { id: 'form-1', version_number: 1, name: 'Registration' },
        sections: [{
          id: 'section-1',
          section_key: 'TEAM',
          title: 'Team questions',
          display_order: 1,
          questions: [
            {
              id: 'question-removed',
              field_key: 'travel_to_chennai',
              question_label: 'Will you be travelling to Chennai for the Final Arena?',
              input_type: 'BOOLEAN',
              answer_scope: 'TEAM',
              is_required: true,
              is_active: true,
              display_order: 1,
              options: [],
            },
            {
              id: 'question-required',
              field_key: 'solution_description',
              question_label: 'Describe your solution',
              input_type: 'TEXTAREA',
              answer_scope: 'TEAM',
              is_required: true,
              is_active: true,
              display_order: 2,
              options: [],
            },
            {
              id: '4a9eaac2-8ab3-4f6c-a91a-3ca08b6de23d',
              field_key: 'travelling_to_bengaluru',
              question_label: 'Will you travel to Bengaluru?',
              input_type: 'BOOLEAN',
              answer_scope: 'TEAM',
              is_required: false,
              is_active: true,
              display_order: 3,
              options: [],
            },
          ],
        }],
        payment: { button_label: 'Pay', payment_url: 'https://pay.example/checkout', payment_enabled: true, payment_required: true },
        registration_enabled: true,
      } });
    }
    if (path.endsWith('/registrations/MIIH_UPCOMING/start')) {
      return route.fulfill({ json: { id: 'draft-1', edit_token: 'token-1' } });
    }
    if (path.endsWith('/registrations/draft-1/upload')) {
      return route.fulfill({ json: { id: '2d6a11b9-370b-4b1f-9234-680a568f3197' } });
    }
    if (path.endsWith('/registrations/draft-1/validation')) {
      return route.fulfill({ json: {
        can_submit: false,
        errors: ['travelling_to_bengaluru:4a9eaac2-8ab3-4f6c-a91a-3ca08b6de23d'],
      } });
    }
    return route.fulfill({ json: {} });
  });

  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/#register$/);
  await expect(page.locator('#register')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: /Unlock your 2027 journey/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Register your team.' });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText('Will you be travelling to Chennai for the Final Arena?');
  const pageUrl = page.url();

  await dialog.getByRole('button', { name: 'Save & continue →' }).click();
  await expect(dialog.locator('[data-validation-key="team-name"]').getByRole('alert')).toHaveText('Enter a team name with at least two characters.');
  await dialog.locator('[data-validation-key="team-name"] input').fill('ZeAI Team');
  await dialog.getByRole('button', { name: 'Save & continue →' }).click();
  await expect(dialog.locator('[data-validation-key="team-domain"]').getByRole('alert')).toHaveText('Select a domain for your team.');
  await expect(dialog.locator('[data-validation-key="team-name"] input')).toHaveValue('ZeAI Team');
  expect(page.url()).toBe(pageUrl);

  await dialog.locator('[data-validation-key="team-domain"] select').selectOption('domain-1');
  await dialog.locator('[data-validation-key="member-0-full_name"] input').fill('Test Leader');
  await dialog.locator('[data-validation-key="member-0-email"] input').fill('leader@example.com');
  await dialog.locator('[data-validation-key="member-0-mobile"] input').fill('9876543210');
  await dialog.getByRole('button', { name: /Add Member 2/ }).click();
  await dialog.locator('[data-validation-key="member-1-full_name"] input').fill('Test Member');
  await dialog.locator('[data-validation-key="member-1-email"] input').fill('member@example.com');
  await dialog.locator('[data-validation-key="member-1-mobile"] input').fill('+91 98765-43210');
  await dialog.getByRole('radio', { name: 'No' }).check();
  await dialog.getByRole('button', { name: 'Save & continue →' }).click();
  await expect(dialog.locator('[data-validation-key="member-1-mobile"]').getByRole('alert')).toHaveText('Each team member must have a different mobile number.');
  await dialog.locator('[data-validation-key="member-1-mobile"] input').fill('9123456780');
  await dialog.getByRole('button', { name: 'Save & continue →' }).click();
  await expect(dialog.getByRole('heading', { name: 'Registration questions' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save & continue →' }).click();
  await expect(dialog.locator('[data-validation-key^="question-question-required"]').getByRole('alert')).toBeVisible();
  await expect(dialog.locator('[data-validation-key^="question-question-required"] textarea')).toHaveAttribute('aria-invalid', 'true');

  await dialog.locator('[data-validation-key^="question-question-required"] textarea').fill('A team collaboration platform.');
  await dialog.getByRole('button', { name: 'Save & continue →' }).click();
  await dialog.getByRole('button', { name: 'I have paid — enter payment details →' }).click();
  await dialog.locator('#miih-transaction-id').fill('txn-12345');
  await dialog.getByLabel('Choose payment screenshot').setInputFiles({
    name: 'proof.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=', 'base64'),
  });
  await dialog.getByRole('button', { name: 'Save transaction ID & screenshot' }).click();
  await expect(dialog.getByText(/Payment evidence saved/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Submit team registration →' }).click();
  await expect(dialog.getByRole('heading', { name: 'Registration questions' })).toBeVisible();
  const travelQuestion = dialog.locator('[data-question="travelling_to_bengaluru"]');
  await expect(travelQuestion).toHaveAttribute('data-invalid', 'true');
  await expect(travelQuestion.getByRole('alert')).toContainText('The registration service requires this answer.');
  expect(page.url()).toBe(pageUrl);
});
