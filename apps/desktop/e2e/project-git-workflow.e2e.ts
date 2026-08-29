import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getOpenPort, seedDesktopDatabase } from './support/runtime.js';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = '/usr/bin/git';

test.describe('Electron Project Git workflow panel', () => {
  test('reveals only useful Git workflow steps as local changes move toward commit', async () => {
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-git-e2e', String(Date.now()));
    const runtimeDir = join(tempRoot, 'runtime');
    const projectDir = join(tempRoot, 'client', 'workflow-project');
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const backendPort = await getOpenPort();
    const rendererPort = await getOpenPort();
    let app: ElectronApplication | undefined;

    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'README.md'), '# Workflow Project\n');
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
          CI: process.env.CI,
        },
      });

      const page = await app.firstWindow();
      await openProject(page);

      await page.getByRole('tab', { name: 'Git & GitHub' }).click();
      const gitPanel = page.getByRole('complementary', { name: 'Git and GitHub' });
      await expect(gitPanel.getByRole('button', { name: 'Overview' })).toBeVisible();
      await expect(gitPanel.getByRole('button', { name: 'Changes' })).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'PRs' })).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'Checks' })).toHaveCount(0);

      writeFileSync(join(projectDir, 'README.md'), '# Workflow Project\n\nChanged in Git E2E\n');
      writeFileSync(join(projectDir, 'scratch.txt'), 'created during Git workflow e2e\n');
      await gitPanel.getByRole('button', { name: 'Refresh Git state' }).click();

      await expect(gitPanel.getByRole('button', { name: /Changes/ })).toBeVisible({
        timeout: 10_000,
      });
      await expect(gitPanel.getByRole('button', { name: 'Commit' })).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'PRs' })).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'Checks' })).toHaveCount(0);

      await gitPanel.getByRole('button', { name: /Changes/ }).click();
      await gitPanel.getByRole('button', { name: /README\.md/ }).click();
      const diffPreview = gitPanel.getByTestId('project-git-diff-preview');
      await expect(diffPreview).toBeVisible({ timeout: 10_000 });
      await expect(diffPreview.locator('[data-diff-line-kind="hunk"]')).toContainText('@@');
      await expect(
        diffPreview
          .locator('[data-diff-line-kind="added"]')
          .filter({ hasText: 'Changed in Git E2E' }),
      ).toBeVisible();
      await gitPanel.getByRole('button', { name: 'Stage all' }).click();
      await expect(gitPanel.getByRole('button', { name: 'Continue to commit' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(gitPanel.getByRole('button', { name: /Commit/ })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: 'Continue to commit' }).click();
      await expect(gitPanel.getByText('Commit staged changes')).toBeVisible();
      await gitPanel.getByPlaceholder('Commit message').fill('test: add workflow scratch file');
      await gitPanel.getByRole('button', { name: 'Commit', exact: true }).click();

      await expect(gitPanel.getByRole('button', { name: 'Commit' })).toHaveCount(0, {
        timeout: 10_000,
      });
      await expect(gitPanel.getByRole('button', { name: 'Publish' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        gitPanel.getByText(/^Committed .*test: add workflow scratch file$/).first(),
      ).toBeVisible();
      await expect(gitPanel.getByText('No repository connected')).toBeVisible();
      await expect(gitPanel.getByRole('button', { name: 'Create Repository' })).toBeVisible();
      await expect(
        gitPanel.getByRole('button', { name: 'Connect Existing Repository' }),
      ).toBeVisible();
      await expect(gitPanel.getByText('Pushed')).toHaveCount(0);
      await expect(gitPanel.getByRole('button', { name: 'Publish branch' })).toHaveCount(0);

      writeFileSync(join(projectDir, 'server.log'), 'generated runtime log\n');
      await gitPanel.getByRole('button', { name: 'Refresh Git state' }).click();
      await expect(gitPanel.getByRole('button', { name: /Changes/ })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: /Changes/ }).click();
      await gitPanel.getByRole('button', { name: /server\.log/ }).click();
      await expect(gitPanel.getByRole('button', { name: 'Stash file' })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: 'Stash file' }).click();
      await expect(gitPanel.getByText('server.log')).toHaveCount(0, { timeout: 10_000 });
      await expect(gitPanel.getByRole('button', { name: /Changes/ })).toHaveCount(0, {
        timeout: 10_000,
      });
    } finally {
      await app?.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('pulls divergent remote changes into the full-screen merge resolver', async () => {
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-git-e2e', String(Date.now()));
    const runtimeDir = join(tempRoot, 'runtime');
    const remoteDir = join(tempRoot, 'remote.git');
    const seedDir = join(tempRoot, 'seed');
    const projectDir = join(tempRoot, 'client', 'conflict-project');
    const collaboratorDir = join(tempRoot, 'collaborator');
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const backendPort = await getOpenPort();
    const rendererPort = await getOpenPort();
    let app: ElectronApplication | undefined;

    mkdirSync(tempRoot, { recursive: true });
    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });

    mkdirSync(seedDir, { recursive: true });
    execFileSync(GIT_BINARY, ['init', '-b', 'main'], { cwd: seedDir, stdio: 'ignore' });
    configureGitUser(seedDir);
    writeFileSync(join(seedDir, 'README.md'), 'Shared line\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: seedDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: seedDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: seedDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'main'], { cwd: seedDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['symbolic-ref', 'HEAD', 'refs/heads/main'], {
      cwd: remoteDir,
      stdio: 'ignore',
    });

    execFileSync(GIT_BINARY, ['clone', remoteDir, projectDir], { stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['clone', remoteDir, collaboratorDir], { stdio: 'ignore' });
    configureGitUser(projectDir);
    configureGitUser(collaboratorDir);

    writeFileSync(join(collaboratorDir, 'README.md'), 'Incoming remote line\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: collaboratorDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'remote: update readme'], {
      cwd: collaboratorDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push'], { cwd: collaboratorDir, stdio: 'ignore' });

    writeFileSync(join(projectDir, 'README.md'), 'Current local line\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'local: update readme'], {
      cwd: projectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['fetch', 'origin'], { cwd: projectDir, stdio: 'ignore' });
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
          CI: process.env.CI,
        },
      });

      const page = await app.firstWindow();
      await openProject(page);

      await page.getByRole('tab', { name: 'Git & GitHub' }).click();
      const gitPanel = page.getByRole('complementary', { name: 'Git and GitHub' });
      await gitPanel.getByRole('button', { name: 'Refresh Git state' }).click();
      await expect(gitPanel.getByRole('button', { name: /Pull/ })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: /Pull/ }).click();
      await expect(gitPanel.getByText('Pull remote changes').first()).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: 'Pull remote changes' }).click();

      await expect(page.getByRole('heading', { name: 'Resolve Merge Conflicts' })).toBeVisible({
        timeout: 15_000,
      });
      const conflictResolver = page.getByRole('dialog', { name: 'Merge conflict resolver' });
      await expect(page.getByRole('button', { name: /README\.md/ })).toBeVisible();
      await expect(conflictResolver.getByRole('button', { name: 'Open local IDE' })).toBeVisible();
      await expect(page.getByText('Current local line', { exact: true })).toBeVisible();
      await expect(page.getByText('Incoming remote line', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Accept both' }).click();
      await expect(page.getByRole('heading', { name: 'Merge Conflicts Resolved' })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole('button', { name: 'Commit merge' }).click();

      await expect(page.getByRole('heading', { name: 'Merge Conflicts Resolved' })).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect(gitPanel.getByText('Push local commits')).toBeVisible();
      await expect(
        gitPanel
          .locator('section')
          .filter({ hasText: 'Push local commits' })
          .getByRole('button', { name: 'Push' }),
      ).toBeVisible({
        timeout: 10_000,
      });
      await expect(gitPanel.getByText('2 local commits are ready to push.')).toBeVisible();
    } finally {
      await app?.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('creates a pull request for a published feature branch from the PR tab', async () => {
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-git-e2e', String(Date.now()));
    const runtimeDir = join(tempRoot, 'runtime');
    const remoteDir = join(tempRoot, 'remote.git');
    const projectDir = join(tempRoot, 'client', 'pr-project');
    const ghStatePath = join(tempRoot, 'fake-gh-state.json');
    const ghBinary = join(tempRoot, 'fake-gh.js');
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const backendPort = await getOpenPort();
    const rendererPort = await getOpenPort();
    let app: ElectronApplication | undefined;

    mkdirSync(tempRoot, { recursive: true });
    execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
    mkdirSync(projectDir, { recursive: true });
    execFileSync(GIT_BINARY, ['init', '-b', 'main'], { cwd: projectDir, stdio: 'ignore' });
    configureGitUser(projectDir);
    writeFileSync(join(projectDir, 'README.md'), '# PR Project\n');
    execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['remote', 'add', 'origin', remoteDir], {
      cwd: projectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'main'], {
      cwd: projectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['checkout', '-b', 'task/e2e-pr'], {
      cwd: projectDir,
      stdio: 'ignore',
    });
    writeFileSync(join(projectDir, 'feature.txt'), 'feature work\n');
    execFileSync(GIT_BINARY, ['add', 'feature.txt'], { cwd: projectDir, stdio: 'ignore' });
    execFileSync(GIT_BINARY, ['commit', '-m', 'feat: add feature work'], {
      cwd: projectDir,
      stdio: 'ignore',
    });
    execFileSync(GIT_BINARY, ['push', '-u', 'origin', 'task/e2e-pr'], {
      cwd: projectDir,
      stdio: 'ignore',
    });
    execFileSync(
      GIT_BINARY,
      ['remote', 'set-url', 'origin', 'git@github.com:user/pr-project.git'],
      {
        cwd: projectDir,
        stdio: 'ignore',
      },
    );
    writeFakeGitHubCli(ghBinary, ghStatePath);
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
          AGENT_PLATFORM_GH_BINARY: ghBinary,
          CI: process.env.CI,
        },
      });

      const page = await app.firstWindow();
      await openProject(page);

      await page.getByRole('tab', { name: 'Git & GitHub' }).click();
      const gitPanel = page.getByRole('complementary', { name: 'Git and GitHub' });
      await gitPanel.getByRole('button', { name: 'Refresh Git state' }).click();
      await expect(gitPanel.getByRole('button', { name: 'PRs' })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: 'PRs' }).click();
      await expect(gitPanel.getByText('Create a pull request')).toBeVisible({
        timeout: 10_000,
      });
      await expect(gitPanel.getByRole('link', { name: /Open GitHub/ })).toBeVisible();

      await gitPanel.getByRole('button', { name: 'Create pull request' }).click();

      await expect(gitPanel.getByText('Created PR #17')).toBeVisible({ timeout: 10_000 });
      await expect(gitPanel.getByText('#17', { exact: true })).toBeVisible();
      await expect(gitPanel.getByRole('link', { name: /Open on GitHub/ })).toBeVisible();
      await expect(gitPanel.getByRole('button', { name: /Checks/ })).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await app?.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

function configureGitUser(cwd: string): void {
  execFileSync(GIT_BINARY, ['config', 'user.email', 'e2e@example.com'], {
    cwd,
    stdio: 'ignore',
  });
  execFileSync(GIT_BINARY, ['config', 'user.name', 'Electron E2E'], {
    cwd,
    stdio: 'ignore',
  });
}

async function openProject(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Open folder' }).click();
  await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
}

function writeFakeGitHubCli(path: string, statePath: string): void {
  writeFileSync(
    path,
    `#!/bin/sh
STATE=${JSON.stringify(statePath)}
PR='{"number":17,"title":"feat: add feature work","state":"OPEN","url":"https://github.com/user/pr-project/pull/17","headRefName":"task/e2e-pr","baseRefName":"main","author":{"login":"e2e-user"},"isDraft":false,"reviewDecision":"REVIEW_REQUIRED","mergeable":"MERGEABLE","createdAt":"2026-05-22T10:00:00Z","updatedAt":"2026-05-22T10:00:00Z","statusCheckRollup":[{"databaseId":1,"name":"CI","workflowName":"CI","status":"COMPLETED","conclusion":"SUCCESS"}]}'
if [ "$1" = "--version" ]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo "Logged in to github.com"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  if [ -f "$STATE" ]; then
    echo "[$PR]"
  else
    echo "[]"
  fi
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "create" ]; then
  echo "created" > "$STATE"
  echo "$PR"
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "view" ]; then
  echo '{"number":17,"url":"https://github.com/user/pr-project/pull/17","statusCheckRollup":[{"databaseId":1,"name":"CI","workflowName":"CI","status":"COMPLETED","conclusion":"SUCCESS"}]}'
  exit 0
fi
echo "unexpected gh invocation: $*" >&2
exit 1
`,
  );
  chmodSync(path, 0o755);
}
