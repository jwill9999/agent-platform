import { expect, test } from '@playwright/test';
import {
  _electron as electron,
  type ElectronApplication,
  type FilePayload,
  type Page,
} from 'playwright';
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
  agentId: string;
  mode: string;
  projectId: string | null;
  updatedAtMs: number;
}

interface RecentDesktopProjects {
  projects: ProjectRecord[];
}

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = '/usr/bin/git';
const DEFAULT_AGENT_ID = '00000000-0000-4000-8000-000000000001';
const E2E_MODEL_RESPONSE = 'E2E model response received';
const E2E_SECRETS_MASTER_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

test.describe('Electron Project access', () => {
  test('opens a local Project and binds chat/slash commands to the same Project session', async () => {
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-e2e', String(Date.now()));
    const runtimeDir = join(tempRoot, 'runtime');
    const newProjectParentDir = join(tempRoot, 'new-projects');
    const newProjectName = 'fresh-e2e-project';
    const firstProjectName = 'agent-platform';
    const secondProjectName = 'second-e2e-project';
    const firstProjectDir = join(tempRoot, 'client-a', firstProjectName);
    const secondProjectDir = join(tempRoot, 'client-b', secondProjectName);
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const backendPort = await getOpenPort();
    const rendererPort = await getOpenPort();
    let app: ElectronApplication | undefined;

    mkdirSync(join(firstProjectDir, 'docs'), { recursive: true });
    mkdirSync(join(secondProjectDir, 'docs'), { recursive: true });
    mkdirSync(newProjectParentDir, { recursive: true });
    writeFileSync(join(firstProjectDir, 'README.md'), '# Electron E2E Project One\n');
    writeFileSync(
      join(firstProjectDir, 'docs', 'guide.md'),
      '# Guide\n\nhello from first electron project\n',
    );
    execFileSync(GIT_BINARY, ['init', '-b', 'main'], { cwd: firstProjectDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['config', 'user.email', 'e2e@example.com'], {
      cwd: firstProjectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['config', 'user.name', 'Electron E2E'], {
      cwd: firstProjectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['add', 'README.md', 'docs/guide.md'], {
      cwd: firstProjectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], {
      cwd: firstProjectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['branch', 'feature/e2e-branch'], {
      cwd: firstProjectDir,
      stdio: 'ignore',
    });
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
          AGENT_PLATFORM_DESKTOP_TEST_PROJECT_PARENT_DIR: newProjectParentDir,
          AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([
            firstProjectDir,
            secondProjectDir,
          ]),
          AGENT_PLATFORM_DESKTOP_TEST_OPEN_IDE: '1',
          AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: E2E_MODEL_RESPONSE,
          SECRETS_MASTER_KEY: E2E_SECRETS_MASTER_KEY,
          CI: process.env.CI,
        },
      });

      const page = await app.firstWindow();
      await openProjectChat(page);

      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog', { name: 'New Project' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Import from Chat/ })).toBeDisabled();
      await page.getByRole('button', { name: /Start from scratch/ }).click();
      await page.getByLabel('Project name').fill(newProjectName);
      await page.getByRole('button', { name: 'Create Project' }).click();
      await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
      await expect(page.getByRole('heading', { name: newProjectName })).toBeVisible();
      expect(existsSync(join(newProjectParentDir, newProjectName))).toBe(true);
      const createdProject = await findRecentProject(backendPort, newProjectName);
      expect(createdProject.metadata.source).toBe('desktop');
      await page.getByRole('combobox', { name: 'Active agent' }).click();
      await page.getByRole('option', { name: 'Personal assistant' }).click();
      await page.getByRole('combobox', { name: 'Active agent' }).click();
      await page.getByRole('option', { name: 'Coding' }).click();
      await page.getByRole('button', { name: 'Workspaces' }).click();
      await expect(page.getByRole('button', { name: 'Open Chat' })).toBeVisible();

      await page.getByRole('button', { name: 'Open Chat' }).click();
      await expect(page.getByPlaceholder('Send a message... (drop files to attach)')).toBeVisible();
      await expect(page.locator('nav a[href="/?mode=chat"]')).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(page.locator('nav a[href="/"]').first()).not.toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(page.getByRole('combobox', { name: 'Active agent' })).toContainText(
        'Personal assistant',
      );
      await expect
        .poll(async () => {
          const sessions = await fetchSessions(backendPort);
          return sessions
            .filter((session) => session.mode === 'chat' && !session.projectId)
            .sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0]?.agentId;
        })
        .toBe(DEFAULT_AGENT_ID);
      await attachFilesToComposer(page, [
        {
          name: 'personal-chat-screenshot.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l7qVZAAAAABJRU5ErkJggg==',
            'base64',
          ),
        },
        {
          name: 'personal-chat-notes.md',
          mimeType: 'text/markdown',
          buffer: Buffer.from('# Personal chat notes\n'),
        },
      ]);
      await expect(page.getByText('personal-chat-screenshot.png')).toBeVisible();
      await expect(page.getByText('personal-chat-notes.md')).toBeVisible();
      await expect(page.getByText('not an allowed text format')).toHaveCount(0);
      await sendChatMessage(page, 'personal chat model response smoke', 'Send a message...');
      await expect(page.getByText(E2E_MODEL_RESPONSE).last()).toBeVisible({ timeout: 15_000 });

      await page.getByRole('link', { name: /Workspaces/ }).click();
      await expect(page.getByRole('button', { name: 'Open Project' })).toBeVisible();
      await expect(page.getByText('personal-chat-screenshot.png')).toHaveCount(0);
      await expect(page.getByText('personal-chat-notes.md')).toHaveCount(0);

      await page.getByRole('button', { name: 'Open Project' }).click();
      const projectChatHeader = page.locator('[data-workspace-surface="project-chat"]');

      await expect(projectChatHeader.getByText(firstProjectName, { exact: true })).toBeVisible();
      await expect(projectChatHeader.getByText(/Files(?:,| and) [Cc]hat/)).toBeVisible();
      await expect(projectChatHeader.getByText('Project / Chat')).toBeVisible();
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page).not.toHaveURL(/\/ide/);
      await expect(page.getByRole('button', { name: 'Open Folder' })).toHaveCount(0);
      await expect(page.getByText('Restore folder')).toHaveCount(0);
      await expect(page.getByText('/workspace')).toHaveCount(0);
      await expect(page.getByText(firstProjectDir)).toHaveCount(0);
      await expect(page.getByRole('combobox', { name: 'Active branch' })).toContainText('main');
      await page.getByRole('combobox', { name: 'Active branch' }).click();
      await page.getByRole('option', { name: 'feature/e2e-branch' }).click();
      await expect(page.getByRole('combobox', { name: 'Active branch' })).toContainText(
        'feature/e2e-branch',
      );
      await expect(
        page.getByRole('combobox', {
          name: /Branch switching is disabled because this Project has uncommitted changes/,
        }),
      ).toHaveCount(0);

      await page.getByRole('button', { name: /Terminal/ }).click();
      const projectTerminal = page.getByRole('region', { name: 'Project terminal' });
      const composer = page.getByRole('textbox', { name: /Ask about this Project/ });
      await expect(projectTerminal).toBeVisible();
      await expect(projectTerminal.getByRole('combobox', { name: 'Terminal font' })).toBeVisible();
      await expect(projectTerminal.getByText('open', { exact: true })).toHaveCount(0);
      const terminalBox = await projectTerminal.boundingBox();
      const composerBox = await composer.boundingBox();
      expect(terminalBox?.y).toBeGreaterThan((composerBox?.y ?? 0) + (composerBox?.height ?? 0));
      await expect(projectTerminal).toContainText(firstProjectDir, { timeout: 10_000 });
      writeFileSync(join(firstProjectDir, 'scratch.txt'), 'scratch\n');
      await expect(
        page.getByRole('combobox', {
          name: /Branch switching is disabled because this Project has uncommitted changes/,
        }),
      ).toBeDisabled({ timeout: 10_000 });
      const gitPanel = page.getByRole('complementary', { name: 'Git and GitHub' });
      await expect(gitPanel).toBeVisible();
      await expect(gitPanel.getByText('Git & GitHub')).toBeVisible();
      await expect(gitPanel.getByText('agent-platform')).toBeVisible();
      await expect(gitPanel.getByText('feature/e2e-branch')).toBeVisible();
      await expect(gitPanel.getByText('1 change', { exact: true })).toBeVisible();
      await expect(gitPanel.getByRole('button', { name: /Changes/ })).toBeVisible();
      await expect(gitPanel.getByRole('button', { name: 'PRs' })).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'Checks' })).toHaveCount(0);
      await gitPanel.getByRole('button', { name: /Changes/ }).click();
      await expect(gitPanel.getByRole('button', { name: 'Stage all' })).toBeVisible();
      await gitPanel.getByRole('button', { name: 'Overview' }).click();
      await projectTerminal
        .getByTitle('New terminal')
        .evaluate((element: HTMLElement) => element.click());
      await expect(
        projectTerminal.getByRole('button', { name: 'Terminal 2', exact: true }),
      ).toBeVisible();
      await projectTerminal
        .getByRole('button', { name: 'Terminal 1', exact: true })
        .evaluate((element: HTMLElement) => element.click());
      const activeTerminalPane = projectTerminal.locator('[data-terminal-active="true"]');
      await expect(activeTerminalPane).toContainText('client-a/agent-platform');
      await projectTerminal.getByRole('button', { name: 'Hide terminal' }).click();
      await expect(projectTerminal).toBeHidden();
      await page.getByRole('button', { name: /Terminal/ }).click();
      await expect(projectTerminal).toContainText(firstProjectDir);
      await projectTerminal.getByRole('button', { name: 'Close terminal', exact: true }).click();
      await expect(projectTerminal).toBeHidden();

      await attachFilesToComposer(page, [
        {
          name: 'project-chat-screenshot.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from(
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z',
            'base64',
          ),
        },
        {
          name: 'project-chat-notes.md',
          mimeType: 'text/markdown',
          buffer: Buffer.from('# Project chat notes\n'),
        },
      ]);
      await expect(page.getByText('project-chat-screenshot.jpg')).toBeVisible();
      await expect(page.getByText('project-chat-notes.md')).toBeVisible();
      await expect(page.getByText('not an allowed text format')).toHaveCount(0);
      await sendChatMessage(page, 'attachment smoke test', 'Ask about this Project...');
      await expect(page.getByText(E2E_MODEL_RESPONSE).last()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('project-chat-screenshot.jpg')).toHaveCount(0);
      await expect(page.getByText('project-chat-notes.md')).toHaveCount(0);

      const project = await findRecentProject(backendPort, firstProjectName);
      expect(project.metadata.source).toBe('desktop');
      expect(project.metadata.folderName).toBe(firstProjectName);
      expect(requiredFolderPathLabel(project)).toContain(firstProjectName);
      expect(project.metadata.activeBranch).toBe('feature/e2e-branch');
      const session = await findProjectSession(backendPort, project.id);
      expect(session.mode).toBe('project');
      await expect(page.getByRole('button', { name: 'Open in IDE' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open IDE' })).toHaveCount(0);

      await sendChatMessage(page, '/help', 'Ask about this Project...');
      await expect(page.getByText('Available slash commands:').last()).toBeVisible();
      await expect(page.getByText('Show available slash commands.').last()).toBeVisible();
      await expect(
        page.getByText('Set up Project instructions for the selected Project.').last(),
      ).toBeVisible();
      await expect(page.getByText('Usage: /help [command]').last()).toBeVisible();
      await expect(page.getByText('Usage: /init').last()).toBeVisible();
      await sendChatMessage(page, '/help init', 'Ask about this Project...');
      await expect(page.getByText('Scope: Selected Project').last()).toBeVisible();
      await expect(page.getByText('May update Project setup.').last()).toBeVisible();

      const recentProjects = page.locator('section[aria-label="Recent Projects"]');
      await expect(recentProjects).toHaveCount(1);
      await expect(
        recentProjects.getByRole('link').filter({ hasText: firstProjectName }),
      ).toBeVisible();
      await expect(
        recentProjects
          .getByRole('link')
          .filter({ hasText: firstProjectName })
          .getByText('Ready to reopen'),
      ).toBeVisible();
      await expect(recentProjects.getByText(firstProjectDir)).toHaveCount(0);

      await page.getByRole('link', { name: /Chat/ }).click();
      await expect(page.locator('[data-workspace-surface="chat"]')).toBeVisible();
      await expect(page.getByPlaceholder('Send a message... (drop files to attach)')).toBeVisible();
      await expect(page.locator('section[aria-label="Recent Projects"]')).toHaveCount(0);
      await expect(page.getByText('Sensors')).toHaveCount(0);
      await expect(page.getByText('Project activity')).toHaveCount(0);
      await expect(page.getByPlaceholder('Ask about this Project...')).toHaveCount(0);
      await expect(page.getByText('project-chat-screenshot.jpg')).toHaveCount(0);
      await expect(page.getByText('project-chat-notes.md')).toHaveCount(0);

      await page.getByRole('link', { name: /Workspaces/ }).click();
      await expect(page.getByRole('button', { name: 'Open Project' })).toBeVisible();
      await page.getByRole('button', { name: 'Open Project' }).click();
      await expect(projectChatHeader.getByText(secondProjectName, { exact: true })).toBeVisible();
      await expect(projectChatHeader.getByText(/Files(?:,| and) [Cc]hat/)).toBeVisible();
      await expect(projectChatHeader.getByText('Project / Chat')).toBeVisible();
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page).not.toHaveURL(/\/ide/);
      const secondProject = await findRecentProjectExcluding(
        backendPort,
        secondProjectName,
        project.id,
      );
      expect(secondProject.metadata.source).toBe('desktop');
      expect(secondProject.metadata.folderName).toBe(secondProjectName);
      const secondProjectPathLabel = requiredFolderPathLabel(secondProject);
      expect(secondProjectPathLabel).toContain('second-e2e-project');
      await expect(recentProjectLink(recentProjects, project.id)).toBeVisible();
      await expect(recentProjects.getByText(firstProjectDir)).toHaveCount(0);
      await expect(recentProjects.getByText(secondProjectDir)).toHaveCount(0);

      const rendererOrigin = new URL(page.url()).origin;
      await page.goto(
        `${rendererOrigin}/?projectId=${encodeURIComponent(project.id)}&sessionId=${encodeURIComponent(session.id)}`,
      );
      await expect(page.getByText('Opening Project chat...')).toHaveCount(0, { timeout: 15_000 });
      await expect(projectChatHeader.getByText(firstProjectName, { exact: true })).toBeVisible();
      await expect(projectChatHeader.getByText(/Files(?:,| and) [Cc]hat/)).toBeVisible();
      await expect(projectChatHeader.getByText('Project / Chat')).toBeVisible();
      await expect(page.getByText('/help init', { exact: true }).last()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText('Scope: Selected Project').last()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page).not.toHaveURL(/\/ide/);
      await expect(page.getByText(firstProjectDir)).toHaveCount(0);
      await expect(page.getByText(secondProjectDir)).toHaveCount(0);
      await page.getByRole('button', { name: 'Open in IDE' }).click();
      await expect(page).not.toHaveURL(/\/ide/);
      await expect(page.getByText(/Open in IDE is available/)).toHaveCount(0);
      await expect(page.getByText(/Project folder is unavailable/)).toHaveCount(0);
      await expect(page.getByText(/Failed to open the Project folder/)).toHaveCount(0);

      await sendChatMessage(page, '/init', 'Ask about this Project...');
      await expect(
        page.getByText('I prepared a Project instructions draft for AGENTS.md.'),
      ).toBeVisible();
      await expect(page.getByText('Review Project instructions')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reject draft' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve instructions' })).toBeVisible();

      await page.getByRole('button', { name: 'Open in IDE' }).click();
      await expect(page).not.toHaveURL(/\/ide/);
      await expect(page.getByText(/Open in IDE is available/)).toHaveCount(0);
      await expect(page.getByText(/Project folder is unavailable/)).toHaveCount(0);
      await expect(page.getByText(/Failed to open the Project folder/)).toHaveCount(0);

      await sendChatMessage(page, '/help init', 'Ask about this Project...');
      await expect(page.getByText('Usage: /init').last()).toBeVisible();
      await expect(page.getByText('Scope: Selected Project').last()).toBeVisible();

      await expect(page.getByRole('button', { name: 'Approve instructions' })).toBeVisible();
      await page.getByRole('button', { name: 'Approve instructions' }).click();
      await expect(page.getByText('Project instructions approved')).toBeVisible();

      const agentsPath = join(firstProjectDir, 'AGENTS.md');
      await expect.poll(() => existsSync(agentsPath)).toBe(true);
      expect(readFileSync(agentsPath, 'utf8')).toContain('# Agent Instructions');
      expect(existsSync(join(tempRoot, 'AGENTS.md'))).toBe(false);

      const refreshedSession = await fetchJson<ApiEnvelope<SessionRecord>>(
        `http://127.0.0.1:${backendPort}/v1/sessions/${session.id}`,
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
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible();
}

async function attachFilesToComposer(page: Page, files: FilePayload[]): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(files);
}

async function findRecentProject(port: number, name: string): Promise<ProjectRecord> {
  const response = await fetchJson<ApiEnvelope<RecentDesktopProjects>>(
    `http://127.0.0.1:${port}/v1/projects/desktop/recent`,
  );
  const project = response.data.projects.find((candidate) => candidate.name === name);
  expect(project).toBeDefined();
  return project as ProjectRecord;
}

async function findRecentProjectExcluding(port: number, name: string, excludedId: string) {
  const response = await fetchJson<ApiEnvelope<RecentDesktopProjects>>(
    `http://127.0.0.1:${port}/v1/projects/desktop/recent`,
  );
  const project = response.data.projects.find(
    (candidate) => candidate.name === name && candidate.id !== excludedId,
  );
  expect(project).toBeDefined();
  return project as ProjectRecord;
}

function requiredFolderPathLabel(project: ProjectRecord): string {
  const label = project.metadata.folderPathLabel;
  expect(typeof label).toBe('string');
  expect((label as string).trim()).toBeTruthy();
  return label as string;
}

function recentProjectLink(recentProjects: ReturnType<Page['locator']>, projectId: string) {
  return recentProjects.locator(`a[href*="${projectId}"]`);
}

async function findProjectSession(port: number, projectId: string): Promise<SessionRecord> {
  const response = await fetchJson<ApiEnvelope<SessionRecord[]>>(
    `http://127.0.0.1:${port}/v1/sessions`,
  );
  const session = response.data.find((candidate) => candidate.projectId === projectId);
  expect(session).toBeDefined();
  return session as SessionRecord;
}

async function fetchSessions(port: number): Promise<SessionRecord[]> {
  const response = await fetchJson<ApiEnvelope<SessionRecord[]>>(
    `http://127.0.0.1:${port}/v1/sessions`,
  );
  return response.data;
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
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
        import {
          closeDatabase,
          createModelConfig,
          openDatabase,
          parseMasterKeyFromBase64,
        } from './packages/db/dist/index.js';

        const { db, sqlite } = openDatabase(process.env.SQLITE_PATH);
        try {
          createModelConfig(
            db,
            {
              name: 'E2E model',
              provider: 'openai',
              model: 'gpt-e2e',
              apiKey: 'e2e-api-key',
            },
            parseMasterKeyFromBase64(process.env.SECRETS_MASTER_KEY),
            1,
          );
        } finally {
          closeDatabase(sqlite);
        }
      `,
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        SQLITE_PATH: sqlitePath,
        SECRETS_MASTER_KEY: E2E_SECRETS_MASTER_KEY,
      },
      stdio: 'inherit',
    },
  );
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
