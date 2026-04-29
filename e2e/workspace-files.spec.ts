import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const fileName = 'ui-workspace-visible.txt';
const relativePath = `generated/${fileName}`;
const content = 'workspace UI download verified\n';

function workspaceHostPath(): string {
  if (process.env.AGENT_WORKSPACE_HOST_PATH?.trim()) {
    return resolve(process.env.AGENT_WORKSPACE_HOST_PATH);
  }
  if (process.env.AGENT_PLATFORM_HOME?.trim()) {
    return resolve(process.env.AGENT_PLATFORM_HOME, 'workspaces', 'default');
  }
  return resolve('.agent-platform', 'workspaces', 'default');
}

test('workspace page shows generated files and downloads them through the BFF', async ({
  page,
}) => {
  const generatedDir = join(workspaceHostPath(), 'generated');
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(join(generatedDir, fileName), content, 'utf8');

  await page.goto('/settings/workspace');

  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();
  await expect(page.getByText(relativePath)).toBeVisible();

  const row = page.locator('tr', { hasText: fileName });
  await expect(row).toContainText('Generated');
  await expect(row).toContainText('31 B');

  const downloadPromise = page.waitForEvent('download');
  await row.getByRole('link', { name: 'Download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(fileName);
});
