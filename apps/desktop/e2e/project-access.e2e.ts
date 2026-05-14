import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ApiEnvelope<T> {
  data: T;
}

interface ProjectRecord {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
}

interface SessionRecord {
  id: string;
  mode: string;
  projectId: string | null;
}

interface RecentDesktopProjects {
  projects: ProjectRecord[];
}

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');

test.describe('Electron Project access', () => {
  test('opens a local Project and binds chat/slash commands to the same Project session', async () => {
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-e2e', String(Date.now()));
    const runtimeDir = join(tempRoot, 'runtime');
    const firstProjectName = 'electron-e2e-project-one';
    const secondProjectName = 'electron-e2e-project-two';
    const firstProjectDir = join(tempRoot, 'projects', firstProjectName);
    const secondProjectDir = join(tempRoot, 'projects', secondProjectName);
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const backendPort = await getOpenPort();
    const rendererPort = await getOpenPort();
    let app: ElectronApplication | undefined;

    mkdirSync(join(firstProjectDir, 'docs'), { recursive: true });
    mkdirSync(join(secondProjectDir, 'docs'), { recursive: true });
    writeFileSync(join(firstProjectDir, 'README.md'), '# Electron E2E Project One\n');
    writeFileSync(
      join(firstProjectDir, 'docs', 'guide.md'),
      '# Guide\n\nhello from first electron project\n',
    );
    writeFileSync(join(secondProjectDir, 'README.md'), '# Electron E2E Project Two\n');
    writeFileSync(
      join(secondProjectDir, 'docs', 'guide.md'),
      '# Guide\n\nhello from second electron project\n',
    );
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
          AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([
            firstProjectDir,
            secondProjectDir,
          ]),
          CI: process.env.CI,
        },
      });

      const page = await app.firstWindow();
      await openProjectChat(page);
      await page.getByRole('button', { name: 'Open Project' }).click();
      const projectChatHeader = page.locator('[data-workspace-surface="project-chat"]');

      await expect(projectChatHeader.getByText(firstProjectName)).toBeVisible();
      await expect(projectChatHeader.getByText('Project / Chat')).toBeVisible();
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page).not.toHaveURL(/\/ide/);
      await expect(page.getByRole('button', { name: 'Open Folder' })).toHaveCount(0);
      await expect(page.getByText('Restore folder')).toHaveCount(0);
      await expect(page.getByText('/workspace')).toHaveCount(0);
      await expect(page.getByText(firstProjectDir)).toHaveCount(0);

      const project = await findRecentProject(backendPort, firstProjectName);
      expect(project.metadata.source).toBe('desktop');
      expect(project.metadata.folderName).toBe(firstProjectName);
      const session = await findProjectSession(backendPort, project.id);
      expect(session.mode).toBe('project');
      await expect(page.getByRole('link', { name: 'Open IDE' })).toHaveAttribute(
        'href',
        `/ide?projectId=${encodeURIComponent(project.id)}&sessionId=${encodeURIComponent(session.id)}`,
      );

      await sendChatMessage(page, '/help', 'Ask about this Project...');
      await expect(
        page.getByText(
          'Available slash commands:\n/help - Show available slash commands.\n/init - Set up Project instructions for the selected Project.',
        ),
      ).toBeVisible();
      await sendChatMessage(page, '/help init', 'Ask about this Project...');
      await expect(page.getByText('Scope: project').last()).toBeVisible();
      await expect(page.getByText('May change Project state.').last()).toBeVisible();

      const recentProjects = page.locator('section[aria-label="Recent Projects"]');
      await expect(recentProjects).toHaveCount(1);
      await expect(
        recentProjects.getByRole('link', { name: new RegExp(firstProjectName) }),
      ).toBeVisible();
      await expect(recentProjects.getByText('Ready to reopen')).toBeVisible();
      await expect(recentProjects.getByText(firstProjectDir)).toHaveCount(0);

      await page.getByRole('button', { name: 'Workspaces' }).click();
      await expect(page.getByRole('button', { name: 'Open Project' })).toBeVisible();
      await page.getByRole('button', { name: 'Open Project' }).click();
      await expect(projectChatHeader.getByText(secondProjectName)).toBeVisible();
      await expect(projectChatHeader.getByText('Project / Chat')).toBeVisible();
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page).not.toHaveURL(/\/ide/);
      const secondProject = await findRecentProject(backendPort, secondProjectName);
      expect(secondProject.metadata.source).toBe('desktop');
      expect(secondProject.metadata.folderName).toBe(secondProjectName);
      await expect(
        recentProjects.getByRole('link', { name: new RegExp(firstProjectName) }),
      ).toBeVisible();
      await expect(
        recentProjects.getByRole('link', { name: new RegExp(secondProjectName) }),
      ).toBeVisible();
      await expect(recentProjects.getByText(firstProjectDir)).toHaveCount(0);
      await expect(recentProjects.getByText(secondProjectDir)).toHaveCount(0);

      await recentProjects.getByRole('link', { name: new RegExp(firstProjectName) }).click();
      await expect(page).toHaveURL(new RegExp(`projectId=${encodeURIComponent(project.id)}`));
      await expect(projectChatHeader.getByText(firstProjectName)).toBeVisible();
      await expect(projectChatHeader.getByText('Project / Chat')).toBeVisible();
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page).not.toHaveURL(/\/ide/);
      await expect(page.getByText(firstProjectDir)).toHaveCount(0);
      await expect(page.getByText(secondProjectDir)).toHaveCount(0);
      const reopenedIdeHref = await page
        .getByRole('link', { name: 'Open IDE' })
        .getAttribute('href');
      expect(reopenedIdeHref).toContain(`/ide?projectId=${encodeURIComponent(project.id)}`);
      const reopenedSessionId = sessionIdFromHref(reopenedIdeHref);

      await sendChatMessage(page, '/init', 'Ask about this Project...');
      await expect(
        page.getByText('I prepared a Project instructions draft for AGENTS.md.'),
      ).toBeVisible();
      await expect(page.getByText('Review Project instructions')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reject draft' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve instructions' })).toBeVisible();

      await page.getByRole('link', { name: 'Open IDE' }).click();
      await page.waitForURL(/\/ide/);
      const binding = page.getByLabel('Project binding');
      await expect(binding.getByText(firstProjectName).first()).toBeVisible();
      await expect(page.getByText('Project activity')).toBeVisible();
      await expect(page.getByText('Branch not connected')).toHaveCount(0);
      await expect(page.getByText('Git branch unavailable')).toHaveCount(0);
      await expect(page.getByText('Remote checks unavailable')).toHaveCount(0);
      await expect(page.getByText('guide.md')).toBeVisible();
      await expect(page.getByText(firstProjectDir)).toHaveCount(0);
      await page.getByText('guide.md').click();
      await expect(page.getByText('hello from first electron project')).toBeVisible();
      await expect(page.getByText('docs/guide.md')).toBeVisible();
      await expect(page.getByText(firstProjectDir)).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Project .* IDE/ })).toHaveAttribute(
        'href',
        `/?projectId=${encodeURIComponent(project.id)}&sessionId=${encodeURIComponent(reopenedSessionId)}`,
      );
      await page.getByRole('link', { name: /Project .* IDE/ }).click();
      await expect(page).not.toHaveURL(/\/ide/);
      await expect(projectChatHeader.getByText('Project / Chat')).toBeVisible();
      await expect(projectChatHeader.getByText(firstProjectName)).toBeVisible();
      await page.getByRole('link', { name: 'Open IDE' }).click();
      await page.waitForURL(/\/ide/);
      await expect(
        page.getByLabel('Project binding').getByText(firstProjectName).first(),
      ).toBeVisible();

      await sendChatMessage(page, '/help init', 'Ask about your code...');
      await expect(page.getByText('Usage: /init').last()).toBeVisible();

      await expect(binding.getByText('Project setup in progress')).toBeVisible();
      await expect(binding.getByRole('button', { name: 'Approve draft' })).toBeVisible();
      await binding.getByRole('button', { name: 'Approve draft' }).click();
      await expect(binding.getByText('Project ready')).toBeVisible();
      await expect(binding.getByText('Project instructions are approved')).toBeVisible();

      const agentsPath = join(firstProjectDir, 'AGENTS.md');
      await expect.poll(() => existsSync(agentsPath)).toBe(true);
      expect(readFileSync(agentsPath, 'utf8')).toContain('# Agent Instructions');
      expect(existsSync(join(tempRoot, 'AGENTS.md'))).toBe(false);

      const refreshedSession = await fetchJson<ApiEnvelope<SessionRecord>>(
        `http://127.0.0.1:${backendPort}/v1/sessions/${reopenedSessionId}`,
      );
      expect(refreshedSession.data.projectId).toBe(project.id);
    } finally {
      await app?.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

async function openProjectChat(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}

async function sendChatMessage(page: Page, message: string, placeholder: string): Promise<void> {
  const input = page.getByPlaceholder(placeholder);
  await input.fill(message);
  await input.press('Enter');
  await expect(page.getByText(message, { exact: true })).toBeVisible();
}

async function findRecentProject(port: number, name: string): Promise<ProjectRecord> {
  const response = await fetchJson<ApiEnvelope<RecentDesktopProjects>>(
    `http://127.0.0.1:${port}/v1/projects/desktop/recent`,
  );
  const project = response.data.projects.find((candidate) => candidate.name === name);
  expect(project).toBeDefined();
  return project as ProjectRecord;
}

async function findProjectSession(port: number, projectId: string): Promise<SessionRecord> {
  const response = await fetchJson<ApiEnvelope<SessionRecord[]>>(
    `http://127.0.0.1:${port}/v1/sessions`,
  );
  const session = response.data.find((candidate) => candidate.projectId === projectId);
  expect(session).toBeDefined();
  return session as SessionRecord;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  expect(response.ok).toBeTruthy();
  return (await response.json()) as T;
}

function sessionIdFromHref(href: string | null): string {
  expect(href).toBeTruthy();
  const url = new URL(href ?? '', 'http://127.0.0.1');
  const sessionId = url.searchParams.get('sessionId');
  expect(sessionId).toBeTruthy();
  return sessionId as string;
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
