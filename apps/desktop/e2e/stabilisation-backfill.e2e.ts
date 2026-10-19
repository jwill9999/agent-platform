import { expect, test, type TestInfo } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fixtureEnvironment } from './support/fixtureEnvironment.js';
import { getOpenPort } from './support/runtime.js';

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

type NavigationEvidence = {
  phase: string;
  passed: boolean;
  primaryFailure: boolean;
  traceActive: boolean;
  traces: string[];
  navigation: Record<string, unknown>[];
  requests: { method: string; status: number; kind: string }[];
  requestsTruncated: boolean;
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
    const info = test.info();
    const fixture = await createFixture();
    let app: ElectronApplication | undefined;
    const evidence: NavigationEvidence = {
      phase: 'initial',
      passed: false,
      primaryFailure: false,
      traceActive: false,
      traces: [],
      navigation: [],
      requests: [],
      requestsTruncated: false,
    };

    try {
      app = await launchFixture(fixture);
      await startNavigationTrace(app, evidence);
      let page = await app.firstWindow();
      observeScopeResponses(page, evidence);
      await expectUsableSurface(page, 'initial Workspaces');

      await openModelsSettings(page);
      await createModelConfig(page);
      await expectPersistedModelCard(page);
      await expectNoPrimaryUiLeakage(page, fixture);

      await page.getByRole('link', { name: /Workspaces/ }).click();
      await openProject(page);
      await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
      await expect(page.getByRole('heading', { name: fixture.projectName })).toBeVisible();
      await expectNoPrimaryUiLeakage(page, fixture);

      const project = await findRecentProject(fixture.backendPort, fixture.projectName);
      expect(project.metadata.source).toBe('desktop');
      await stopNavigationTrace(app, evidence, info);
      await app.close();
      await requireReleasedPorts(fixture);
      app = undefined;

      seedTitledSessions(fixture, project.id);

      evidence.phase = 'after-restart';
      app = await launchFixture(fixture);
      await startNavigationTrace(app, evidence);
      page = await app.firstWindow();
      observeScopeResponses(page, evidence);
      await openModelsSettings(page);
      await expectPersistedModelCard(page);
      await expectUsableSurface(page, 'Models settings after restart');

      const chatLink = page.getByRole('link', { name: /Chat/ });
      await chatLink.click();
      await expect(page.locator('[data-workspace-surface="chat"]')).toBeVisible();
      await expect(chatLink).toHaveAttribute('aria-current', 'page');
      await expectPersonalSessionsOnly(page, evidence);
      await recordNavigationScope(page, evidence, 'settings-to-personal');
      await openModelsSettings(page);

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
      await recordNavigationScope(page, evidence, 'project-after-restart');

      await page.getByRole('link', { name: /Chat/ }).click();
      await expect(page.locator('[data-workspace-surface="chat"]')).toBeVisible();
      await recordNavigationScope(page, evidence, 'personal-surface');
      await expectPersonalSessionsOnly(page, evidence);
      await recordNavigationScope(page, evidence, 'personal-settled');
      await expectNoPrimaryUiLeakage(page, fixture);

      await page.goBack();
      await expect(page.getByRole('heading', { name: fixture.projectName })).toBeVisible();
      await expectProjectSessionsOnly(page);
      await recordNavigationScope(page, evidence, 'project-history-back');
      await page.goForward();
      await expect(page.locator('[data-workspace-surface="chat"]')).toBeVisible();
      await expectPersonalSessionsOnly(page, evidence);
      await recordNavigationScope(page, evidence, 'personal-history-forward');

      rmSync(fixture.projectDir, { recursive: true, force: true });
      await page.getByRole('link', { name: /Workspaces/ }).click();
      await recentProjects.getByTitle('Refresh recent Projects').click();
      await expect(page.getByLabel(`${fixture.projectName} open again to reconnect`)).toBeVisible({
        timeout: 10_000,
      });
      await expect(recentProjects.getByText('Open again to reconnect')).toBeVisible();
      await expect(recentProjects.getByText(fixture.projectDir)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
      evidence.passed = true;
    } catch (error) {
      evidence.primaryFailure = true;
      throw error;
    } finally {
      await finishNavigationFixture(app, fixture, evidence, info);
    }
  });
});

async function startNavigationTrace(app: ElectronApplication, evidence: NavigationEvidence) {
  await app.context().tracing.start({ screenshots: true, snapshots: true });
  evidence.traceActive = true;
}

async function stopNavigationTrace(
  app: ElectronApplication,
  evidence: NavigationEvidence,
  info: TestInfo,
) {
  const name = `session-scope-${evidence.phase}-trace.zip`;
  const path = info.outputPath(name);
  await app.context().tracing.stop({ path });
  evidence.traceActive = false;
  evidence.traces.push(name);
  await info.attach(name, { path, contentType: 'application/zip' });
}

function observeScopeResponses(page: Page, evidence: NavigationEvidence) {
  // Observe only route/status metadata. The isolated fixture uses a synthetic key and never
  // sends a model request; do not attach response bodies or credentials to this receipt.
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    const kind = scopeResponseKind(path);
    if (!kind) return;
    if (evidence.requests.length === 64) {
      evidence.requestsTruncated = true;
      return;
    }
    evidence.requests.push({
      method: response.request().method(),
      status: response.status(),
      kind,
    });
  });
}

function scopeResponseKind(path: string): string | null {
  if (path === '/api/v1/sessions') return 'sessions';
  if (path === '/api/v1/sessions/project') return 'project-session-bind';
  if (path === '/api/v1/projects/desktop/recent') return 'recent-projects';
  return null;
}

async function recordNavigationScope(page: Page, evidence: NavigationEvidence, label: string) {
  const state = await page.evaluate(() => {
    const params = new URLSearchParams(location.search);
    const surface = document.querySelector('[data-workspace-surface]');
    return {
      pathname: location.pathname === '/' ? 'root' : 'other',
      mode: ['chat', 'project', 'workspaces'].includes(params.get('mode') ?? '')
        ? params.get('mode')
        : null,
      projectInUrl: params.has('projectId'),
      sessionInUrl: params.has('sessionId'),
      surface: ['home', 'chat', 'project-chat', 'ide'].includes(
        surface?.getAttribute('data-workspace-surface') ?? '',
      )
        ? surface?.getAttribute('data-workspace-surface')
        : null,
      scope: ['none', 'global-chat', 'project'].includes(
        surface?.getAttribute('data-workspace-scope') ?? '',
      )
        ? surface?.getAttribute('data-workspace-scope')
        : null,
      projectControls: document.querySelector('[aria-label="Project controls"]') !== null,
    };
  });
  evidence.navigation.push({ label, ...state });
}

async function finishNavigationFixture(
  app: ElectronApplication | undefined,
  fixture: Fixture,
  evidence: NavigationEvidence,
  info: TestInfo,
) {
  const traces = await Promise.allSettled(
    app && evidence.traceActive ? [stopNavigationTrace(app, evidence, info)] : [],
  );
  const cleanup = await Promise.allSettled([app?.close()]);
  const portsReleased = await requireReleasedPorts(fixture).then(
    () => true,
    () => false,
  );
  let evidenceFailed =
    [...traces, ...cleanup].some((result) => result.status === 'rejected') || !portsReleased;
  const receipt = {
    ...evidence,
    passed: evidence.passed && !evidenceFailed,
    traceResults: traces.map((result) => result.status),
    cleanup: cleanup.map((result) => result.status),
    portsReleased,
    fixtureRetained: evidence.primaryFailure || evidenceFailed,
    evidenceWriteFailed: false,
    evidenceAttachFailed: false,
    fixtureRemovalFailed: false,
  };
  evidenceFailed = !(await persistNavigationReceipt(info, receipt)) || evidenceFailed;
  if (!receipt.fixtureRetained) {
    try {
      rmSync(fixture.tempRoot, { recursive: true, force: true });
    } catch {
      receipt.fixtureRemovalFailed = true;
      receipt.fixtureRetained = true;
      receipt.passed = false;
      evidenceFailed = true;
      await persistNavigationReceipt(info, receipt);
    }
  }
  if (evidenceFailed && !evidence.primaryFailure)
    throw new Error('Session-scope evidence or owned app cleanup failed; fixture retained');
}

async function portReleased(port: number): Promise<boolean> {
  return new Promise((resolveReleased) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (released: boolean) => {
      socket.destroy();
      resolveReleased(released);
    };
    socket.once('connect', () => finish(false));
    socket.once('error', (error: NodeJS.ErrnoException) => finish(error.code === 'ECONNREFUSED'));
    socket.setTimeout(500, () => finish(false));
  });
}

async function requireReleasedPorts(fixture: Fixture): Promise<void> {
  await expect
    .poll(async () =>
      (await Promise.all([fixture.backendPort, fixture.rendererPort].map(portReleased))).every(
        Boolean,
      ),
    )
    .toBe(true);
}

async function persistNavigationReceipt(
  info: TestInfo,
  receipt: NavigationEvidence & {
    fixtureRetained: boolean;
    evidenceWriteFailed: boolean;
    evidenceAttachFailed: boolean;
  },
): Promise<boolean> {
  const path = info.outputPath('session-scope-navigation-receipt.json');
  const persist = () => writeFileSync(path, JSON.stringify(receipt, null, 2));
  try {
    persist();
  } catch {
    receipt.evidenceWriteFailed = true;
  }
  if (receipt.evidenceWriteFailed) {
    receipt.passed = false;
    receipt.fixtureRetained = true;
  }
  try {
    await info.attach('session-scope-navigation-receipt', {
      body: Buffer.from(JSON.stringify(receipt)),
      contentType: 'application/json',
    });
  } catch {
    receipt.evidenceAttachFailed = true;
  }
  const failed = receipt.evidenceWriteFailed || receipt.evidenceAttachFailed;
  if (failed) {
    receipt.passed = false;
    receipt.fixtureRetained = true;
    try {
      persist();
    } catch {
      // Retain the fixture and the original assertion failure, if any.
    }
  }
  return !failed;
}

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
  for (const name of ['home', 'tmp']) mkdirSync(join(tempRoot, name), { recursive: true });
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
  execFileSync(process.execPath, [join(repoRoot, 'packages/db/dist/seed/run.js')], {
    cwd: repoRoot,
    env: {
      ...fixtureEnvironment(tempRoot, process.execPath, process.env),
      SQLITE_PATH: sqlitePath,
      E2E_SEED: '1',
      SECRETS_MASTER_KEY: masterKey,
    },
    stdio: 'inherit',
  });

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
      ...fixtureEnvironment(fixture.tempRoot, process.execPath, process.env),
      AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
      AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(fixture.backendPort),
      AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
      AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
      AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(fixture.rendererPort),
      AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: fixture.runtimeDir,
      AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(fixture.runtimeDir, 'tmp'),
      AGENT_PLATFORM_DESKTOP_LOG_DIR: join(fixture.runtimeDir, 'logs'),
      AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([fixture.projectDir]),
      SECRETS_MASTER_KEY: masterKey,
      ...(process.env.CI === undefined ? {} : { CI: process.env.CI }),
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

async function expectPersistedModelCard(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { name: 'E2E persisted OpenAI', exact: true });
  const card = heading.locator('..');
  await expect(card).toHaveCount(1);
  await expect(heading).toBeVisible();
  await expect(card.getByText('gpt-4o-mini-e2e', { exact: true })).toBeVisible();
  await expect(card.getByText('🔑 Key stored', { exact: true })).toBeVisible();
}

async function createModelConfig(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add Model' }).first().click();
  await expect(page.getByRole('heading', { name: 'Add Model Config' })).toBeVisible();
  await page.getByLabel('Name').fill('E2E persisted OpenAI');
  await page.getByLabel('Model', { exact: true }).fill('gpt-4o-mini-e2e');
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
  await expect(page.getByText('stabilisation-e2e-project sessions', { exact: true })).toHaveCount(
    0,
  );
}

async function expectPersonalSessionsOnly(page: Page, evidence: NavigationEvidence): Promise<void> {
  await page.getByLabel('Open sessions menu').click();
  await recordNavigationScope(page, evidence, 'personal-menu-open');
  await expect(page.getByText('Personal chat sessions')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Personal scoped regression/ })).toBeVisible();
  await expect(page.getByText('Project scoped regression')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Personal chat sessions', { exact: true })).toHaveCount(0);
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

function seedTitledSessions(fixture: Fixture, projectId: string): void {
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
      ...fixtureEnvironment(fixture.tempRoot, process.execPath, process.env),
      SQLITE_PATH: fixture.sqlitePath,
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
