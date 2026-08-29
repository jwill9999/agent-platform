import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { workspaceResourceUri } from '@agent-platform/contracts';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = '/usr/bin/git';
const E2E_SECRETS_MASTER_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

test('Save As cancels safely and writes only the native-dialog destination', async () => {
  const tempRoot = join(
    repoRoot,
    '.agent-platform',
    'electron-resource-export-e2e',
    String(Date.now()),
  );
  const runtimeDir = join(tempRoot, 'runtime');
  const projectDir = join(tempRoot, 'client', 'resource-export-project');
  const generatedDir = join(projectDir, 'generated');
  const sourceFile = join(generatedDir, 'notes.md');
  const destinationFile = join(tempRoot, 'saved', 'notes-copy.md');
  const cancelledDestination = join(tempRoot, 'saved', 'cancelled.md');
  const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
  const backendPort = await getOpenPort();
  const rendererPort = await getOpenPort();
  let app: ElectronApplication | undefined;

  mkdirSync(generatedDir, { recursive: true });
  mkdirSync(dirname(destinationFile), { recursive: true });
  writeFileSync(sourceFile, '# Generated notes\n\nDesktop export remains scoped.\n');
  execFileSync(GIT_BINARY, ['init', '-b', 'main'], { cwd: projectDir, stdio: 'ignore' });
  seedDesktopDatabase(sqlitePath);

  try {
    app = await electron.launch({
      cwd: desktopDir,
      args: ['.'],
      env: {
        ...process.env,
        AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
        AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(backendPort),
        AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
        AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
        AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(rendererPort),
        AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtimeDir,
        AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(runtimeDir, 'tmp'),
        AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([projectDir]),
        AGENT_PLATFORM_DESKTOP_TEST_SAVE_RESOURCE_PATHS: JSON.stringify([null, destinationFile]),
        SECRETS_MASTER_KEY: E2E_SECRETS_MASTER_KEY,
        CI: process.env.CI,
      },
    });

    const page = await app.firstWindow();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Open folder' }).click();
    await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();

    const projectsResponse = await fetch(`http://127.0.0.1:${backendPort}/v1/projects`);
    const projects = (await projectsResponse.json()) as {
      data: Array<{ id: string; name: string }>;
    };
    const project = projects.data.find((candidate) => candidate.name === 'resource-export-project');
    expect(project).toBeDefined();
    const resourceUri = workspaceResourceUri({
      projectId: project?.id ?? 'missing-project',
      kind: 'file',
      target: 'generated/notes.md',
    });
    const exportedResourceResponse = await fetch(
      `http://127.0.0.1:${backendPort}/v1/projects/${encodeURIComponent(project?.id ?? 'missing-project')}/resources/export?${new URLSearchParams({ uri: resourceUri }).toString()}`,
    );
    expect(exportedResourceResponse.status).toBe(200);
    expect(await exportedResourceResponse.text()).toBe(readFileSync(sourceFile, 'utf8'));

    const fixtureUrl = new URL('/e2e/workspace-resources', page.url());
    fixtureUrl.searchParams.set('projectId', project?.id ?? 'missing-project');
    await page.goto(fixtureUrl.toString());
    await page.getByRole('button', { name: 'Preview Markdown: generated/notes.md' }).click();

    await page.getByRole('button', { name: 'Save As' }).click();
    expect(existsSync(cancelledDestination)).toBe(false);
    await expect(page.getByRole('heading', { name: 'Generated notes' })).toBeVisible();

    await page.getByRole('button', { name: 'Save As' }).click();
    await expect(page.getByRole('status')).toHaveText('notes-copy.md was saved.');
    expect(readFileSync(destinationFile, 'utf8')).toBe(readFileSync(sourceFile, 'utf8'));
    expect(readFileSync(sourceFile, 'utf8')).toContain('Desktop export remains scoped.');
    await expect(page.getByText('/workspace')).toHaveCount(0);
    await expect(page.getByText(projectDir)).toHaveCount(0);
  } finally {
    await app?.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

function seedDesktopDatabase(sqlitePath: string): void {
  execFileSync(process.execPath, [join(repoRoot, 'packages/db/dist/seed/run.js')], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SQLITE_PATH: sqlitePath,
      E2E_SEED: '1',
    },
    stdio: 'inherit',
  });
}

function getOpenPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) {
          resolvePort(address.port);
          return;
        }
        reject(new Error('Failed to allocate a local port.'));
      });
    });
  });
}
