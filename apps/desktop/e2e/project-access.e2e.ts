import { expect, test } from '@playwright/test';
import {
  _electron as electron,
  type ElectronApplication,
  type FilePayload,
  type Locator,
  type Page,
} from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getOpenPort, seedDesktopDatabase } from './support/runtime.js';

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
const IDE_URL_PATTERN = new RegExp(String.raw`/ide`);
const VISUAL_REGRESSION_OPTIONS = {
  animations: 'disabled',
  caret: 'hide',
  maxDiffPixelRatio: 0.01,
  scale: 'css',
  threshold: 0.3,
} as const;

test.describe('Electron Project access', () => {
  test('opens a local Project and binds chat/slash commands to the same Project session', async () => {
    test.info().snapshotSuffix = '';
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
    seedDesktopDatabase(sqlitePath, { secretsMasterKey: E2E_SECRETS_MASTER_KEY });

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
      await expectSimplifiedWorkspaceEntry(page);

      await page.getByRole('button', { name: 'New project' }).click();
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
      await selectActiveAgent(page, 'Personal assistant');
      await selectActiveAgent(page, 'Coding');
      await page.getByRole('button', { name: 'Workspaces' }).click();
      await expect(page.getByRole('button', { name: /^Chat\b/ })).toBeVisible();

      await page.getByRole('button', { name: /^Chat\b/ }).click();
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

      await openWorkspaceChooserFromSidebar(page);
      await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
      await expect(page.getByText('personal-chat-screenshot.png')).toHaveCount(0);
      await expect(page.getByText('personal-chat-notes.md')).toHaveCount(0);

      await clickOpenFolder(page);
      const projectChatHeader = page.locator('[data-workspace-surface="project-chat"]');

      await expect(projectChatHeader.getByText(firstProjectName, { exact: true })).toBeVisible();
      await expect(projectChatHeader.getByText(/Files(?:,| and) [Cc]hat/)).toBeVisible();
      await expectProjectLocationBreadcrumb(projectChatHeader);
      const projectControls = projectChatHeader.getByRole('group', { name: 'Project controls' });
      await expect(projectControls.getByLabel(/Project command status:/)).toBeVisible();
      await expect(projectControls).toHaveScreenshot(
        `project-chat-controls-${process.platform}.png`,
        VISUAL_REGRESSION_OPTIONS,
      );
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page).not.toHaveURL(IDE_URL_PATTERN);
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
      const terminalLocation = projectTerminal.getByLabel('Terminal location');
      const terminalControls = projectTerminal.getByRole('group', { name: 'Terminal controls' });
      const composer = page.getByRole('textbox', { name: /Ask about this Project/ });
      await expect(projectTerminal).toBeVisible();
      await expect(projectTerminal.getByRole('combobox', { name: 'Terminal font' })).toBeVisible();
      await expect(projectTerminal.getByText('open', { exact: true })).toHaveCount(0);
      const terminalBox = await projectTerminal.boundingBox();
      const composerBox = await composer.boundingBox();
      expect(terminalBox?.y).toBeGreaterThan((composerBox?.y ?? 0) + (composerBox?.height ?? 0));
      await expect(terminalLocation).toContainText('Project root', { timeout: 10_000 });
      await expect(terminalLocation).not.toContainText(firstProjectDir);
      await expect(projectTerminal.getByLabel('Terminal status: Running')).toBeVisible();
      await expect(terminalControls).toHaveScreenshot(
        `project-terminal-controls-${process.platform}.png`,
        VISUAL_REGRESSION_OPTIONS,
      );
      const gitPanel = page.getByRole('complementary', { name: 'Git and GitHub' });
      await expect(gitPanel).toBeVisible();
      writeFileSync(join(firstProjectDir, 'scratch.txt'), 'scratch\n');
      await gitPanel.getByRole('button', { name: 'Refresh Git state' }).click();
      await expect(gitPanel.getByText('1 change', { exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        page.getByRole('combobox', {
          name: /Branch switching is disabled because this Project has uncommitted changes/,
        }),
      ).toBeDisabled({ timeout: 10_000 });
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
      await expect(terminalLocation).toContainText('Project root');
      await expect(terminalLocation).not.toContainText(firstProjectDir);
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
      await expect(page.getByRole('button', { name: 'Open local IDE' })).toBeVisible();
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

      await projectChatHeader.getByRole('button', { name: 'Workspaces' }).click();
      await expect(page.getByRole('heading', { name: 'Choose a workspace' })).toBeVisible();
      await page
        .locator('section[aria-label="Recent Projects"]')
        .getByRole('link')
        .filter({ hasText: firstProjectName })
        .click();
      await expect(projectChatHeader.getByText(firstProjectName, { exact: true })).toBeVisible();
      await expectProjectLocationBreadcrumb(projectChatHeader);

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

      await openWorkspaceChooserFromSidebar(page);
      await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
      await clickOpenFolder(page);
      await expect(projectChatHeader.getByText(secondProjectName, { exact: true })).toBeVisible();
      await expect(projectChatHeader.getByText(/Files(?:,| and) [Cc]hat/)).toBeVisible();
      await expectProjectLocationBreadcrumb(projectChatHeader);
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page).not.toHaveURL(IDE_URL_PATTERN);
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
      await expect(page.getByRole('heading', { name: firstProjectName })).toBeVisible();
      await expect(projectChatHeader.getByText(/Files(?:,| and) [Cc]hat/)).toBeVisible();
      await expectProjectLocationBreadcrumb(projectChatHeader);
      await expect(page.getByText('/help init', { exact: true }).last()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText('Scope: Selected Project').last()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
      await expect(page).not.toHaveURL(IDE_URL_PATTERN);
      await expect(page.getByText(firstProjectDir)).toHaveCount(0);
      await expect(page.getByText(secondProjectDir)).toHaveCount(0);
      await page.getByRole('button', { name: 'Open local IDE' }).click();
      await expect(page).not.toHaveURL(IDE_URL_PATTERN);
      await expect(page.getByText(/Open local IDE is available/)).toHaveCount(0);
      await expect(page.getByText(/Project folder is unavailable/)).toHaveCount(0);
      await expect(page.getByText(/Failed to open the Project folder/)).toHaveCount(0);

      await sendChatMessage(page, '/init', 'Ask about this Project...');
      await expect(
        page.getByText('I prepared a Project instructions draft for AGENTS.md.'),
      ).toBeVisible();
      await expect(page.getByText('Review Project instructions')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reject draft' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve instructions' })).toBeVisible();

      await page.getByRole('button', { name: 'Open local IDE' }).click();
      await expect(page).not.toHaveURL(IDE_URL_PATTERN);
      await expect(page.getByText(/Open local IDE is available/)).toHaveCount(0);
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

async function openWorkspaceChooserFromSidebar(page: Page): Promise<void> {
  const chooserHeading = page.getByRole('heading', { name: 'Choose a workspace' });
  const openFolder = page.getByRole('button', { name: 'Open folder' });
  await page.getByRole('link', { name: /^Workspaces\b/ }).click();

  try {
    await expect(chooserHeading).toBeVisible();
    await expect(openFolder).toBeVisible();
  } catch {
    const projectWorkspacesButton = page
      .locator('[data-workspace-surface="project-chat"]')
      .getByRole('button', { name: 'Workspaces' });
    await expect(projectWorkspacesButton).toBeVisible();
    await projectWorkspacesButton.click();
    await expect(chooserHeading).toBeVisible({ timeout: 15_000 });
    await expect(openFolder).toBeVisible({ timeout: 15_000 });
  }
}

async function clickOpenFolder(page: Page): Promise<void> {
  const openFolder = page.getByRole('button', { name: 'Open folder' });

  // The home screen can be re-rendered while recent projects and the desktop
  // bridge finish settling. Reacquire the button after a detached-element
  // failure instead of clicking a locator from the previous render.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await expect(openFolder).toBeVisible();
      await expect(openFolder).toBeEnabled();
      await openFolder.click();
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(100);
    }
  }
}

async function expectProjectLocationBreadcrumb(projectChatHeader: Locator): Promise<void> {
  const breadcrumb = projectChatHeader.getByRole('navigation', { name: 'Project location' });
  await expect(breadcrumb.getByRole('button', { name: 'Workspaces' })).toBeVisible();
  await expect(breadcrumb.getByText('Project', { exact: true })).toBeVisible();
  await expect(breadcrumb.getByText('Chat', { exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
}

async function expectSimplifiedWorkspaceEntry(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Choose a workspace' })).toBeVisible();
  await expect(page.getByText('Start a general chat or open a coding project.')).toBeVisible();

  await expect(page.getByRole('button', { name: /^Chat\b/ })).toBeVisible();
  await expect(page.getByText('General assistant')).toBeVisible();
  await expect(
    page.getByText('Talk with the assistant and use general tools without opening a project.'),
  ).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Coding Project' })).toBeVisible();
  await expect(
    page.getByText(
      'Work with a folder or repository, including Git, branches, terminal, and IDE handoff.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'New project' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
  await expect(page.getByText('Folder or repository', { exact: true })).toBeVisible();

  for (const deferredWorkspace of [
    'Automation',
    'Scheduled tasks',
    'Email workflows',
    'Research',
  ]) {
    await expect(page.getByRole('heading', { name: deferredWorkspace })).toHaveCount(0);
  }
}

async function selectActiveAgent(page: Page, name: string): Promise<void> {
  const agentSelector = page.getByRole('combobox', { name: 'Active agent' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await agentSelector.click();
    const option = page.getByRole('option', { name }).first();
    await expect(option).toBeVisible();
    try {
      await option.click({ force: true, timeout: 5_000 });
      await expect(agentSelector).toContainText(name);
      return;
    } catch (error) {
      await page.keyboard.press('Escape').catch(() => undefined);
      if (attempt === 2) throw error;
    }
  }
}

async function sendChatMessage(page: Page, message: string, placeholder: string): Promise<void> {
  const input = page.getByPlaceholder(placeholder);
  await input.fill(message);
  await input.press('Enter');
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible();
}

async function attachFilesToComposer(page: Page, files: FilePayload[]): Promise<void> {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Attach files' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(files);
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
