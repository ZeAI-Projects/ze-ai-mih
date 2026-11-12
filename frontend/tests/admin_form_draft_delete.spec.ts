import { test, expect } from '@playwright/test';

test('admin form layout keeps Sections and Questions together at narrow desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 862, height: 700 });
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
      return route.fulfill({ json: { role: 'SUPER_ADMIN', permissions: ['FORM_VIEW', 'FORM_EDIT'] } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/admin/form');
  await expect(page.getByRole('heading', { name: 'Questions & Sections' })).toBeVisible();
  await expect(page.locator('.miih-form-unified-index')).toBeVisible();
  const sidebar = page.locator('.miih-admin-sidebar');
  const menu = page.getByRole('button', { name: /Menu/ });
  await expect(menu).toBeVisible();
  await expect(sidebar).toHaveCSS('transform', /matrix\(1, 0, 0, 1, -/);
  const main = page.locator('.miih-admin-main');
  await expect.poll(() => main.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await menu.click();
  await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect(sidebar.locator('.miih-admin-brand')).toBeVisible();
  await expect(sidebar.locator('.miih-sidebar-bottom')).toBeVisible();
});

test('draft editor can remove an individual option and question', async ({ page }) => {
  const question = {
    id: 'question-id',
    field_key: 'challenge_category',
    question_label: 'Which challenge category?',
    description: '',
    placeholder: '',
    input_type: 'SINGLE_SELECT',
    answer_scope: 'TEAM',
    is_required: true,
    is_active: true,
    display_order: 0,
    options: [{ option_value: 'ai', option_label: 'Artificial Intelligence', display_order: 0, is_active: true }],
    validation_rules: { min_length: 2 },
    visibility_rules: { only_if_pitch_interest: true },
  };
  const draft = {
    id: 'version-id',
    status: 'DRAFT',
    sections: [{ id: 'section-id', section_key: 'team', title: 'Team details', display_order: 0, questions: [question] }],
  };
  const mutations: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('miih.admin.session', JSON.stringify({ access_token: 'ui-test-only' }));
    localStorage.setItem('miih.admin.theme', 'light');
  });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path.endsWith('/admin/me')) {
      return route.fulfill({ json: { id: 'ui-test', full_name: 'UI Test', email: 'test@example.invalid', role: 'SUPER_ADMIN', approval_status: 'APPROVED' } });
    }
    if (path.endsWith('/admin/permissions')) {
      return route.fulfill({ json: { role: 'SUPER_ADMIN', permissions: ['FORM_VIEW', 'FORM_EDIT'] } });
    }
    if (path.endsWith('/admin/editions')) {
      return route.fulfill({ json: [{ id: 'edition-id', edition_code: 'MIIH_UPCOMING', title: 'Hackathon' }] });
    }
    if (path.endsWith('/admin/forms/editions/edition-id/versions')) {
      return route.fulfill({ json: [{ id: 'version-id', status: 'DRAFT', version_number: 1, name: 'Editable draft' }] });
    }
    if (path.endsWith('/admin/forms/versions/version-id')) {
      return route.fulfill({ json: draft });
    }
    if (path.endsWith('/admin/forms/sections/section-id/questions') && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      mutations.push({ method, path, body });
      const createdQuestion = {
        ...question,
        id: 'image-question',
        field_key: String(body.field_key),
        question_label: String(body.question_label),
        description: String(body.description || ''),
        input_type: String(body.input_type),
        answer_scope: String(body.answer_scope),
        is_required: body.is_required === true,
        options: [],
      };
      draft.sections[0].questions.push(createdQuestion);
      return route.fulfill({ json: createdQuestion });
    }
    if (path.endsWith('/admin/forms/questions/question-id') && method === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      mutations.push({ method, path, body });
      Object.assign(question, body);
      return route.fulfill({ json: { id: question.id, field_key: question.field_key, question_label: question.question_label, is_required: question.is_required, is_active: question.is_active } });
    }
    if (path.endsWith('/admin/forms/questions/question-id/options') && method === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      mutations.push({ method, path, body });
      Object.assign(question.options[0], body);
      return route.fulfill({ json: question.options[0] });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/admin/form');
  await expect(page.getByRole('heading', { name: 'Questions & Sections' })).toBeVisible();
  await expect(page.locator('.miih-form-unified-index')).toHaveCSS('overflow-y', 'auto');
  const questionRow = page.getByRole('button', { name: /Which challenge category\?/i });
  await expect(questionRow).toBeVisible();
  await questionRow.scrollIntoViewIfNeeded();
  const main = page.locator('.miih-admin-main');
  const beforeOpenScroll = await main.evaluate(element => element.scrollTop);
  await questionRow.click();
  const editor = page.getByRole('dialog', { name: 'Edit question' });
  await expect(editor).toBeVisible();
  const editorBounds = await editor.boundingBox();
  const viewport = page.viewportSize();
  expect(editorBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(editorBounds!.y).toBeGreaterThanOrEqual(0);
  expect(editorBounds!.y + editorBounds!.height).toBeLessThanOrEqual(viewport!.height);
  await expect(main).toHaveJSProperty('scrollTop', beforeOpenScroll);
  await expect(editor).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  const questionText = editor.getByLabel('Question text');
  await questionText.fill('Temporary unsaved question');
  await editor.getByRole('button', { name: 'Cancel' }).click();
  const discardDialog = page.getByRole('dialog', { name: 'Unsaved question changes' });
  await expect(discardDialog).toBeVisible();
  await discardDialog.locator('form').getByRole('button', { name: 'Cancel' }).click();
  await expect(editor).toBeVisible();
  await questionText.fill('Which challenge category?');
  await expect(page.getByText('Advanced rules (optional)')).toHaveCount(0);

  await editor.getByRole('button', { name: 'Delete choice: Artificial Intelligence' }).click();
  const optionDialog = page.getByRole('dialog', { name: 'Delete option' });
  await expect(optionDialog).toContainText('Artificial Intelligence');
  await optionDialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.miih-admin-option')).toContainText('Removed');
  expect(mutations[0]).toMatchObject({ method: 'PUT', body: { option_value: 'ai', is_active: false } });

  await editor.getByLabel('Answer format').selectOption('IMAGE');
  await editor.getByLabel('Display position').fill('7');
  await expect(editor.getByText('Participants can upload a JPG, PNG or WebP image.')).toBeVisible();
  await editor.getByRole('button', { name: 'Save question' }).click();
  await expect.poll(() => mutations.some(mutation => mutation.method === 'PATCH' && mutation.body.input_type === 'IMAGE')).toBe(true);
  await expect(editor).toHaveCount(0);
  const savedQuestion = mutations.find(mutation => mutation.method === 'PATCH');
  expect(savedQuestion?.body.display_order).toBe(7);
  expect(savedQuestion?.body).not.toHaveProperty('validation_rules');
  expect(savedQuestion?.body).not.toHaveProperty('visibility_rules');

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('button', { name: /Which challenge category\?/i }).click();
  const darkEditor = page.getByRole('dialog', { name: 'Edit question' });
  await expect(darkEditor).toHaveCSS('background-color', 'rgb(17, 18, 35)');
  await darkEditor.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();

  await page.getByRole('button', { name: /Which challenge category\?/i }).click();
  await page.getByRole('dialog', { name: 'Edit question' }).getByRole('button', { name: 'Delete question' }).click();
  const questionDialog = page.getByRole('dialog', { name: 'Delete question' });
  await questionDialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('button', { name: /Which challenge category\?/i })).toContainText('Hidden');
  expect(mutations.at(-1)).toMatchObject({ method: 'PATCH', body: { is_active: false } });

  await page.getByRole('button', { name: 'Add question to Team details' }).click();
  const addDialog = page.getByRole('dialog', { name: 'Add a registration question' });
  await addDialog.getByLabel('What should participants be asked?').fill('Upload your project image');
  await addDialog.getByLabel('Help text shown under the question (optional)').fill('Add a clear preview image.');
  await addDialog.getByLabel('How should they answer?').selectOption({ label: 'Image upload' });
  await addDialog.getByLabel('Who should answer?').selectOption({ label: 'Each team member' });
  await addDialog.getByLabel('Is an answer required?').selectOption('Optional');
  await addDialog.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: /Upload your project image/i })).toBeVisible();
  expect(mutations.at(-1)).toMatchObject({
    method: 'POST',
    body: { field_key: 'upload_your_project_image', input_type: 'IMAGE', answer_scope: 'MEMBER', is_required: false },
  });

  await page.getByRole('button', { name: 'Publish form' }).click();
  await page.getByRole('dialog', { name: 'Publish form' }).locator('form').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('status')).toContainText('Form version published.');
});
