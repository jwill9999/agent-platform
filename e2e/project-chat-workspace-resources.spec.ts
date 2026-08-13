import { expect, test } from '@playwright/test';

test('Project Chat opens generated outputs and file changes without losing context', async ({
  page,
}) => {
  await page.route(
    '**/api/v1/projects/e2e-project/files/preview?path=generated%2Fchart.png',
    (route) =>
      route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l7qVZAAAAABJRU5ErkJggg==',
          'base64',
        ),
        contentType: 'image/png',
      }),
  );
  await page.route(
    '**/api/v1/projects/e2e-project/files/preview?path=generated%2Freport.pdf',
    (route) =>
      route.fulfill({
        body: Buffer.from('%PDF-1.4\n%%EOF\n'),
        contentType: 'application/pdf',
      }),
  );

  await page.goto('/e2e/workspace-resources');
  const context = page.getByTestId('project-context');
  await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
  await expect(context).toContainText('e2e-session');
  await expect(page.getByText('/workspace')).toHaveCount(0);
  await expect(page.getByText('/Users/')).toHaveCount(0);

  await page.getByRole('button', { name: 'Preview HTML: generated/app.html' }).click();
  await expect(page.getByTestId('workspace-resource-html-preview')).toHaveAttribute(
    'sandbox',
    'allow-forms allow-modals allow-popups allow-scripts',
  );
  await page.getByRole('button', { name: 'Close preview' }).click();

  await page.getByRole('button', { name: 'Preview Markdown: generated/notes.md' }).click();
  await expect(page.getByRole('heading', { name: 'Generated notes' })).toBeVisible();
  await page.getByRole('button', { name: 'Close preview' }).click();

  await page.getByRole('button', { name: 'View image: generated/chart.png' }).click();
  await expect(page.getByRole('img', { name: 'generated/chart.png' })).toBeVisible();
  await page.getByRole('button', { name: 'Close preview' }).click();

  await page.getByRole('button', { name: 'Preview PDF: generated/report.pdf' }).click();
  await expect(page.getByTitle('generated/report.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Close preview' }).click();

  await page.getByRole('button', { name: 'Open source: src/index.ts' }).click();
  await expect(page.getByText('export const projectExperience = true;')).toBeVisible();
  await page.getByRole('button', { name: 'Close preview' }).click();

  await page.getByRole('button', { name: 'Review changes: src/index.ts' }).click();
  await expect(page.getByTestId('workspace-resource-diff')).toContainText(
    '+export const value = true;',
  );
  await expect(context).toContainText('e2e-conversation');
  await expect(page.getByRole('button', { name: /Stage|Commit|Push/ })).toHaveCount(0);
});
