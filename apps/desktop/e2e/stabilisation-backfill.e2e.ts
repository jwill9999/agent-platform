import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

interface ApiEnvelope<T> {
  data: T;
}

interface ProjectRecord {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
}

interface RecentDesktopProjects {
  projects: ProjectRecord[];
}

type Fixture = {
  backendPort: number;
  projectDir: string;
  projectName: string;
  rendererPort: number;
  runtimeDir: string;
  sqlitePath: string;
  tempRoot: string;
};

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = '/usr/bin/git';
const masterKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

test.describe('Electron stabilisation automation backfill', () => {
  test('keeps first-loaded Workspaces responsive at compact and expanded desktop sizes', async () => {
    const fixture = await createFixture();
    let app: ElectronApplication | undefined;

    try {
      app = await launchFixture(fixture);
      const page = await app.firstWindow();

      await resizeWindowForFirstLoad(app, page, { width: 960, height: 640 });
      await expectResponsiveFirstLoad(page, 'compact first-load Workspaces');

      await resizeWindowForFirstLoad(app, page, { width: 1600, height: 1000 });
      await expectResponsiveFirstLoad(page, 'expanded first-load Workspaces');
    } finally {
      await app?.close();
      rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
  });

  test('persists settings and recent Project state across restart, scopes sessions, and handles unavailable Projects safely', async () => {
    const fixture = await createFixture();
    let app: ElectronApplication | undefined;

    try {
      app = await launchFixture(fixture);
      let page = await app.firstWindow();
      await expectUsableSurface(page, 'initial Workspaces');

      await openModelsSettings(page);
      await createModelConfig(page);
      await expect(page.getByText('E2E persisted OpenAI')).toBeVisible();
      await expect(page.getByText('gpt-4o-mini-e2e')).toBeVisible();
      await expect(page.getByText('Key stored')).toBeVisible();
      await expectNoPrimaryUiLeakage(page, fixture);

      await page.getByRole('link', { name: /Workspaces/ }).click();
      await openProject(page);
      await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
      await expect(page.getByRole('heading', { name: fixture.projectName })).toBeVisible();
      await expectNoPrimaryUiLeakage(page, fixture);

      const project = await findRecentProject(fixture.backendPort, fixture.projectName);
      expect(project.metadata.source).toBe('desktop');
      await app.close();
      app = undefined;

      seedTitledSessions(fixture.sqlitePath, project.id);

      app = await launchFixture(fixture);
      page = await app.firstWindow();
      await openModelsSettings(page);
      await expect(page.getByText('E2E persisted OpenAI')).toBeVisible();
      await expect(page.getByText('gpt-4o-mini-e2e')).toBeVisible();
      await expect(page.getByText('Key stored')).toBeVisible();
      await expectUsableSurface(page, 'Models settings after restart');

      await page.getByRole('link', { name: /Workspaces/ }).click();
      const recentProjects = page.locator('section[aria-label="Recent Projects"]');
      await expect(
        recentProjects.getByRole('link').filter({ hasText: fixture.projectName }),
      ).toBeVisible();
      await expect(recentProjects.getByText('Ready to reopen')).toBeVisible();
      await expect(recentProjects.getByText(fixture.projectDir)).toHaveCount(0);

      await recentProjects.getByRole('link').filter({ hasText: fixture.projectName }).click();
      await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
      await expect(page.getByRole('heading', { name: fixture.projectName })).toBeVisible();
      await expectProjectSessionsOnly(page);
      await expectUsableSurface(page, 'Project Chat after restart');

      await page.getByRole('link', { name: /Chat/ }).click();
      await expect(page.locator('[data-workspace-surface="chat"]')).toBeVisible();
      await expectPersonalSessionsOnly(page);
      await expectNoPrimaryUiLeakage(page, fixture);

      rmSync(fixture.projectDir, { recursive: true, force: true });
      await page.getByRole('link', { name: /Workspaces/ }).click();
      await recentProjects.getByTitle('Refresh recent Projects').click();
      await expect(page.getByLabel(`${fixture.projectName} open again to reconnect`)).toBeVisible({
        timeout: 10_000,
      });
      await expect(recentProjects.getByText('Open again to reconnect')).toBeVisible();
      await expect(recentProjects.getByText(fixture.projectDir)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
    } finally {
      await app?.close();
      rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
  });
});

async function createFixture(): Promise<Fixture> {
  const tempRoot = join(
    repoRoot,
    '.agent-platform',
    'electron-stabilisation-e2e',
    String(Date.now()),
  );
  const runtimeDir = join(tempRoot, 'runtime');
  const projectName = 'stabilisation-e2e-project';
  const projectDir = join(tempRoot, 'client', projectName);
  const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
  const backendPort = await getOpenPort();
  const rendererPort = await getOpenPort();

  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'README.md'), '# Stabilisation E2E Project\n');
  execFileSync(GIT_BINARY, ['init', '-b', 'main'], { cwd: projectDir, stdio: 'ignore' });
  execFileSync(GIT_BINARY, ['config', 'user.email', 'e2e@example.com'], {
    cwd: projectDir,
    stdio: 'ignore',
  });
  execFileSync(GIT_BINARY, ['config', 'user.name', 'Electron E2E'], {
    cwd: projectDir,
    stdio: 'ignore',
  });
  execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: projectDir, stdio: 'ignore' });
  execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: projectDir, stdio: 'ignore' });
  seedDesktopDatabase(sqlitePath);

  return {
    backendPort,
    projectDir,
    projectName,
    rendererPort,
    runtimeDir,
    sqlitePath,
    tempRoot,
  };
}

function launchFixture(fixture: Fixture): Promise<ElectronApplication> {
  return electron.launch({
    cwd: desktopDir,
    args: ['.'],
    env: {
      ...process.env,
      AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
      AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(fixture.backendPort),
      AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
      AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
      AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(fixture.rendererPort),
      AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: fixture.runtimeDir,
      AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(fixture.runtimeDir, 'tmp'),
      AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([fixture.projectDir]),
      SECRETS_MASTER_KEY: masterKey,
      CI: process.env.CI,
    },
  });
}

async function resizeWindowForFirstLoad(
  app: ElectronApplication,
  page: Page,
  size: { width: number; height: number },
): Promise<void> {
  const windowHandle = await app.browserWindow(page);
  await windowHandle.evaluate((window, nextSize) => {
    window.setSize(nextSize.width, nextSize.height);
  }, size);
  await page.waitForTimeout(250);
}

async function openModelsSettings(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByLabel('Open settings menu')).toBeVisible();
  await page.getByLabel('Open settings menu').click();
  await page.getByRole('menuitem', { name: 'Models' }).click();
  await expect(page.getByRole('heading', { name: 'Models & API Keys' })).toBeVisible();
}

async function createModelConfig(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add Model' }).first().click();
  await expect(page.getByRole('heading', { name: 'Add Model Config' })).toBeVisible();
  await page.getByLabel('Name').fill('E2E persisted OpenAI');
  await page.getByLabel('Model').fill('gpt-4o-mini-e2e');
  await page.getByLabel('API Key').fill('sk-e2e-persisted-key');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Models & API Keys' })).toBeVisible({
    timeout: 10_000,
  });
}

async function openProject(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open folder' }).click();
  await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
}

async function expectProjectSessionsOnly(page: Page): Promise<void> {
  await page.getByLabel('Open sessions menu').click();
  await expect(page.getByText('stabilisation-e2e-project sessions')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Project scoped regression/ })).toBeVisible();
  await expect(page.getByText('Personal scoped regression')).toHaveCount(0);
  await page.keyboard.press('Escape');
}

async function expectPersonalSessionsOnly(page: Page): Promise<void> {
  await page.getByLabel('Open sessions menu').click();
  await expect(page.getByText('Personal chat sessions')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Personal scoped regression/ })).toBeVisible();
  await expect(page.getByText('Project scoped regression')).toHaveCount(0);
  await page.keyboard.press('Escape');
}

async function expectNoPrimaryUiLeakage(page: Page, fixture: Fixture): Promise<void> {
  const bodyText = (await page.locator('body').textContent()) ?? '';
  for (const forbidden of [
    fixture.projectDir,
    fixture.runtimeDir,
    fixture.sqlitePath,
    '/workspace',
    'backendProjectRoot',
    'in_progress',
    'needs_review',
  ]) {
    expect(bodyText).not.toContain(forbidden);
  }
}

async function expectUsableSurface(page: Page, label: string): Promise<void> {
  const main = page.locator('main, [data-workspace-surface]').first();
  await expect(main, `${label} is visible`).toBeVisible();
  const box = await main.boundingBox();
  if (!box) {
    throw new Error(`${label} has no measurable bounding box.`);
  }
  expect(box.width, `${label} has usable width`).toBeGreaterThan(500);
  expect(box.height, `${label} has usable height`).toBeGreaterThan(400);
}

async function expectResponsiveFirstLoad(page: Page, label: string): Promise<void> {
  await expect(page.getByRole('link', { name: /Workspaces/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Chat/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
  await expect(page.getByLabel('Open settings menu')).toBeVisible();
  await expectUsableSurface(page, label);

  const viewport = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    clientHeight: document.documentElement.clientHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.clientWidth, `${label} viewport width`).toBeGreaterThanOrEqual(900);
  expect(viewport.clientHeight, `${label} viewport height`).toBeGreaterThanOrEqual(600);
  expect(
    Math.max(viewport.scrollWidth, viewport.bodyScrollWidth),
    `${label} avoids page-level horizontal overflow`,
  ).toBeLessThanOrEqual(viewport.clientWidth + 4);
}

function seedTitledSessions(sqlitePath: string, projectId: string): void {
  const dbIndexUrl = pathToFileURL(join(repoRoot, 'packages/db/dist/index.js')).href;
  const script = `
    const {
      closeDatabase,
      createSession,
      DEFAULT_AGENT_ID,
      openDatabase,
      updateSessionTitle,
    } = await import(${JSON.stringify(dbIndexUrl)});
    const { db, sqlite } = openDatabase(process.env.SQLITE_PATH);
    try {
      const projectSession = createSession(db, {
        agentId: DEFAULT_AGENT_ID,
        mode: 'project',
        projectId: ${JSON.stringify(projectId)},
      });
      updateSessionTitle(db, projectSession.id, 'Project scoped regression');
      const personalSession = createSession(db, {
        agentId: DEFAULT_AGENT_ID,
        mode: 'chat',
      });
      updateSessionTitle(db, personalSession.id, 'Personal scoped regression');
    } finally {
      closeDatabase(sqlite);
    }
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SQLITE_PATH: sqlitePath,
    },
    stdio: 'inherit',
  });
}

async function findRecentProject(port: number, name: string): Promise<ProjectRecord> {
  const response = await fetchJson<ApiEnvelope<RecentDesktopProjects>>(
    `http://127.0.0.1:${port}/v1/projects/desktop/recent`,
  );
  const project = response.data.projects.find((candidate) => candidate.name === name);
  if (!project) {
    throw new Error(`Recent Project ${name} was not returned by the desktop API.`);
  }
  return project;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  expect(response.ok).toBeTruthy();
  return (await response.json()) as T;
}

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
