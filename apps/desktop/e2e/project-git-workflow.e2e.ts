import { expect, test, type TestInfo } from '@playwright/test';
import type { ElectronApplication, Page, Request, Response } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDesktopPorts, seedDesktopDatabase } from './support/runtime.js';
import {
  attemptStartupEvidenceAttachment,
  createStartupEvidence,
} from './support/startupEvidence.js';
import { createGhLedgerFixture } from '../../../e2e/support/git-delivery/gh-ledger.mjs';
import { createGitTransportFixture } from '../../../e2e/support/git-delivery/git-transport.mjs';
import { runRemotePanelJourney } from '../../../e2e/support/git-delivery/panel-remote-journey.js';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = '/usr/bin/git';

test.describe('Electron Project Git workflow panel', () => {
  test('reveals only useful Git workflow steps as local changes move toward commit', async ({
    playwright,
  }, testInfo) => {
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-git-e2e', String(Date.now()));
    const runtimeDir = join(tempRoot, 'runtime');
    const projectDir = join(tempRoot, 'client', 'workflow-project');
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const { backendPort, rendererPort } = await getDesktopPorts();
    const startup = createStartupEvidence(backendPort, rendererPort);
    const failures: unknown[] = [];
    let app: ElectronApplication | undefined;
    let observedPage: Page | undefined;

    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'README.md'), '# Workflow Project\n');
    execFileSync(GIT_BINARY, ['init', '-b', 'feature/local-delivery'], {
      cwd: projectDir,
      stdio: 'ignore',
    });
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
      app = await playwright._electron.launch({
        cwd: desktopDir,
        args: ['.', `--user-data-dir=${join(tempRoot, 'user-data')}`],
        env: {
          ...process.env,
          OLLAMA_BASE_URL: 'http://127.0.0.1:9/v1',
          AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
          AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(backendPort),
          AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
          AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
          AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(rendererPort),
          AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtimeDir,
          AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(runtimeDir, 'tmp'),
          AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([projectDir]),
          ...(process.env.CI === undefined ? {} : { CI: process.env.CI }),
        },
      });

      startup.observeProcess(app.process());
      const page = await app.firstWindow();
      observedPage = page;
      await waitForOwnedRendererLoad(page, rendererPort);
      // /init is handled locally, but the composer requires a selected model configuration.
      // An unreachable loopback Ollama target prevents accidental external provider calls.
      const configured = await page.request.post(
        `http://127.0.0.1:${backendPort}/v1/model-configs`,
        {
          data: { name: 'Local Git UI fixture', provider: 'ollama', model: 'git-ui-fixture' },
        },
      );
      expect(configured.ok()).toBe(true);
      await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
      await page.reload();
      await openProject(page);
      const input = page.getByPlaceholder('Ask about this Project...');
      await expect(input).toBeEnabled();
      // The composer can mount before its Project session is bound.
      await expect(
        page.getByText('Press Enter to send, Shift+Enter for new line', { exact: true }),
      ).toBeVisible();
      await input.fill('/init');
      const send = page.getByRole('button', { name: 'Send message', exact: true });
      await expect(send).toBeEnabled();
      await send.click();
      await page.getByRole('button', { name: 'Approve instructions' }).click();
      await expect(page.getByText('Project instructions approved').last()).toBeVisible();
      execFileSync(GIT_BINARY, ['add', '--', 'AGENTS.md'], { cwd: projectDir, stdio: 'ignore' });
      execFileSync(GIT_BINARY, ['commit', '-m', 'fixture: approved Project instructions'], {
        cwd: projectDir,
        stdio: 'ignore',
      });

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
      const stageReview = gitPanel.getByRole('region', {
        name: 'Stage selected files',
        exact: true,
      });
      await expect(stageReview.getByRole('status')).toHaveText('Status: prepared');
      expect(
        execFileSync(GIT_BINARY, ['diff', '--cached', '--name-only'], {
          cwd: projectDir,
          encoding: 'utf8',
        }).trim(),
      ).toBe('');
      await stageReview.getByRole('button', { name: 'Confirm Git operation' }).click();
      await expect(stageReview.getByRole('status')).toHaveText('Status: succeeded');
      await expect(gitPanel.getByRole('button', { name: 'Continue to commit' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(gitPanel.getByRole('button', { name: /Commit/ })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: 'Continue to commit' }).click();
      await expect(gitPanel.getByText('Commit staged changes')).toBeVisible();
      await gitPanel.getByPlaceholder('Commit message').fill('test: add workflow scratch file');
      const reviewedHead = execFileSync(GIT_BINARY, ['rev-parse', 'HEAD'], {
        cwd: projectDir,
        encoding: 'utf8',
      }).trim();
      await gitPanel.getByRole('button', { name: 'Review commit', exact: true }).click();
      const commitReview = gitPanel.getByRole('region', {
        name: 'Commit reviewed files',
        exact: true,
      });
      await expect(commitReview.getByRole('list', { name: 'Reviewed files' })).toHaveText(
        'README.mdscratch.txt',
      );
      expect(
        execFileSync(GIT_BINARY, ['rev-parse', 'HEAD'], {
          cwd: projectDir,
          encoding: 'utf8',
        }).trim(),
      ).toBe(reviewedHead);
      await commitReview.getByRole('button', { name: 'Confirm Git operation' }).click();
      await expect(commitReview.getByRole('status')).toHaveText('Status: succeeded');
      expect(
        execFileSync(GIT_BINARY, ['show', '--format=', '--name-only', 'HEAD'], {
          cwd: projectDir,
          encoding: 'utf8',
        })
          .trim()
          .split('\n'),
      ).toEqual(['README.md', 'scratch.txt']);

      await expect(gitPanel.getByRole('button', { name: 'Commit' })).toHaveCount(0, {
        timeout: 10_000,
      });
      await expect(gitPanel.getByRole('button', { name: 'Publish' })).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: 'Publish', exact: true }).click();
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
    } catch (error) {
      failures.push(error);
    }
    if (!(await attachStartupBeforeCleanup(testInfo, startup, observedPage))) {
      failures.push(new Error('Git panel startup evidence could not be attached.'));
    }
    await captureFailure(failures, async () => {
      await app?.close();
    });
    await captureFailure(failures, () => rmSync(tempRoot, { recursive: true, force: true }));
    throwFailures(failures);
  });

  test('pulls divergent remote changes into the full-screen merge resolver', async ({
    playwright,
  }, testInfo) => {
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-git-e2e', String(Date.now()));
    const runtimeDir = join(tempRoot, 'runtime');
    const remoteDir = join(tempRoot, 'remote.git');
    const seedDir = join(tempRoot, 'seed');
    const projectDir = join(tempRoot, 'client', 'conflict-project');
    const collaboratorDir = join(tempRoot, 'collaborator');
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const { backendPort, rendererPort } = await getDesktopPorts();
    const startup = createStartupEvidence(backendPort, rendererPort);
    const failures: unknown[] = [];
    let app: ElectronApplication | undefined;
    let observedPage: Page | undefined;
    let releaseProjectSession = () => {};
    const projectSessionGate = new Promise<void>((resolveGate) => {
      releaseProjectSession = resolveGate;
    });
    const bindingRoutes = new Set<Promise<void>>();
    let bindingIntercepted = false;
    let heldBindingStatus: number | undefined;

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
      app = await playwright._electron.launch({
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
          ...(process.env.CI === undefined ? {} : { CI: process.env.CI }),
        },
      });

      startup.observeProcess(app.process());
      const page = await app.firstWindow();
      observedPage = page;
      await waitForOwnedRendererLoad(page, rendererPort);
      await page.route(`http://127.0.0.1:${rendererPort}/api/v1/sessions/project`, (route) => {
        const binding = (async () => {
          if (route.request().method() !== 'POST' || bindingIntercepted) {
            await route.continue();
            return;
          }
          bindingIntercepted = true;
          const response = await route.fetch({ timeout: 10_000 });
          heldBindingStatus = response.status();
          await projectSessionGate;
          await route.fulfill({ response });
        })().catch(async (error) => {
          failures.push(error);
          await captureFailure(failures, () => route.abort());
        });
        bindingRoutes.add(binding);
        void binding.then(() => bindingRoutes.delete(binding));
        return binding;
      });
      await openProject(page);
      const canonicalSessionControl = page.getByRole('button', {
        name: 'Export diagnostic report',
        exact: true,
      });
      await expect(canonicalSessionControl).toHaveCount(0);

      await page.getByRole('tab', { name: 'Git & GitHub' }).click();
      const gitTab = page.getByRole('tab', { name: 'Git & GitHub' });
      const gitPanel = page.getByRole('complementary', { name: 'Git and GitHub' });
      await expect(gitTab).toHaveAttribute('aria-selected', 'true');
      await expect(gitPanel).toBeVisible();
      await expect.poll(() => heldBindingStatus).toBe(201);
      // The real binding response used to remount Chat and reset this selection to Activity.
      releaseProjectSession();
      await expect(canonicalSessionControl).toBeVisible();
      await expect(gitTab).toHaveAttribute('aria-selected', 'true');
      await expect(gitPanel).toBeVisible();
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
          .getByRole('button', { name: 'Push commits' }),
      ).toBeVisible({
        timeout: 10_000,
      });
      await gitPanel.getByRole('button', { name: 'Push commits', exact: true }).click();
      await expect(
        gitPanel.getByRole('button', { name: 'Review push', exact: true }),
      ).toBeVisible();
      await expect(gitPanel.getByText('2 local commits are ready to push.')).toBeVisible();
    } catch (error) {
      failures.push(error);
    }
    // Release a held response even when setup or an assertion fails, then settle its route
    // before the existing process cleanup. Route failures join, rather than replace, the cause.
    releaseProjectSession();
    await captureFailure(failures, async () => {
      await Promise.all(bindingRoutes);
    });
    if (!(await attachStartupBeforeCleanup(testInfo, startup, observedPage))) {
      failures.push(new Error('Git panel startup evidence could not be attached.'));
    }
    await captureFailure(failures, async () => {
      await app?.close();
    });
    await captureFailure(failures, () => rmSync(tempRoot, { recursive: true, force: true }));
    throwFailures(failures);
  });

  test('reviews publishing and reconciles a lost pull-request response', async ({
    playwright,
  }, testInfo) => {
    test.setTimeout(120_000);
    const tempRoot = join(repoRoot, '.agent-platform', 'electron-git-e2e', `remote-${Date.now()}`);
    const runtimeDir = join(tempRoot, 'runtime');
    const remoteDir = join(tempRoot, 'remote.git');
    const projectDir = join(tempRoot, 'client', 'pr-project');
    const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
    const branch = 'feature/reviewed-remote';
    const { backendPort, rendererPort } = await getDesktopPorts();
    const startup = createStartupEvidence(backendPort, rendererPort);
    let app: ElectronApplication | undefined;
    let observedPage: Page | undefined;
    const pendingReads = new Set<Request>();
    let processState: ReturnType<ElectronApplication['process']> | undefined;
    const lifecycle: Array<{
      event: string;
      at: number;
      path?: string;
      status?: number;
      pending: number;
    }> = [];
    const record = (event: string, request?: Request, status?: number) => {
      lifecycle.push({
        event,
        at: Date.now(),
        ...(request ? { path: new URL(request.url()).pathname } : {}),
        ...(status === undefined ? {} : { status }),
        pending: pendingReads.size,
      });
    };
    const onRequest = (request: Request) => {
      if (!/\/(?:git\/checks|github\/pull-requests)$/u.test(new URL(request.url()).pathname))
        return;
      pendingReads.add(request);
      record('request', request);
    };
    const onResponse = (response: Response) => {
      if (pendingReads.has(response.request()))
        record('response', response.request(), response.status());
    };
    const onFinished = (request: Request) => {
      if (!pendingReads.delete(request)) return;
      record('finished', request);
    };
    const onFailed = (request: Request) => {
      if (!pendingReads.delete(request)) return;
      record('failed', request);
    };
    const settleReads = async (page: Page, buttonName: string, phase: string) => {
      await expect(page.getByRole('button', { name: buttonName, exact: true })).toBeEnabled({
        timeout: 10_000,
      });
      await expect.poll(() => pendingReads.size, { timeout: 10_000 }).toBe(0);
      record(phase);
    };

    let ghFixture: Awaited<ReturnType<typeof createGhLedgerFixture>> | undefined;
    let transport: Awaited<ReturnType<typeof createGitTransportFixture>> | undefined;
    const failures: unknown[] = [];
    const git = (...args: string[]) =>
      execFileSync(GIT_BINARY, ['-C', projectDir, ...args], { encoding: 'utf8' }).trim();
    const remote = (...args: string[]) =>
      execFileSync(GIT_BINARY, ['--git-dir', remoteDir, ...args], { encoding: 'utf8' }).trim();
    try {
      mkdirSync(projectDir, { recursive: true });
      execFileSync(GIT_BINARY, ['init', '--bare', remoteDir], { stdio: 'ignore' });
      execFileSync(GIT_BINARY, ['init', '-b', 'staging', projectDir], { stdio: 'ignore' });
      configureGitUser(projectDir);
      writeFileSync(join(projectDir, 'README.md'), '# Remote delivery fixture\n');
      git('add', '--', 'README.md');
      git('commit', '-m', 'fixture base');
      transport = await createGitTransportFixture({ bareRoot: remoteDir });
      git('config', 'core.sshCommand', transport.sshCommand);
      git('config', 'ssh.variant', 'ssh');
      git('remote', 'add', 'origin', transport.remoteUrl);
      git('push', 'origin', 'HEAD:refs/heads/staging');
      git('switch', '-c', branch);
      ghFixture = await createGhLedgerFixture({ currentBranch: branch });
      seedDesktopDatabase(sqlitePath);
      app = await playwright._electron.launch({
        cwd: desktopDir,
        args: ['.', `--user-data-dir=${join(tempRoot, 'user-data')}`],
        env: {
          ...process.env,
          ...ghFixture.env,
          OLLAMA_BASE_URL: 'http://127.0.0.1:9/v1',
          AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
          AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(backendPort),
          AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
          AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
          AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(rendererPort),
          AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtimeDir,
          AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(runtimeDir, 'tmp'),
          AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([projectDir]),
          AGENT_PLATFORM_GH_BINARY: ghFixture.executable,
          ...(process.env.CI === undefined ? {} : { CI: process.env.CI }),
        },
      });
      processState = app.process();
      startup.observeProcess(processState);
      const page = await app.firstWindow();
      observedPage = page;
      await waitForOwnedRendererLoad(page, rendererPort);
      page.on('request', onRequest);
      page.on('response', onResponse);
      page.on('requestfinished', onFinished);
      page.on('requestfailed', onFailed);
      const configured = await page.request.post(
        `http://127.0.0.1:${backendPort}/v1/model-configs`,
        {
          data: {
            name: 'Remote Git panel fixture',
            provider: 'ollama',
            model: 'git-panel-no-model-call',
          },
        },
      );
      expect(configured.ok()).toBe(true);
      await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
      await page.reload();
      await openProject(page);
      const input = page.getByPlaceholder('Ask about this Project...');
      await expect(input).toBeEnabled();
      await expect(
        page.getByText('Press Enter to send, Shift+Enter for new line', { exact: true }),
      ).toBeVisible();
      await input.fill('/init');
      const send = page.getByRole('button', { name: 'Send message', exact: true });
      await expect(send).toBeEnabled();
      await send.click();
      await page.getByRole('button', { name: 'Approve instructions' }).click();
      await expect(page.getByText('Project instructions approved').last()).toBeVisible();
      git('add', '--', 'AGENTS.md');
      git('commit', '-m', 'fixture approved instructions');
      writeFileSync(join(projectDir, 'feature.txt'), 'reviewed feature\n');
      git('add', '--', 'feature.txt');
      git('commit', '-m', 'fixture feature');
      const github = ghFixture;
      const result = await runRemotePanelJourney(
        page,
        {
          git,
          remote,
          write: (path, value) => writeFileSync(join(projectDir, path), value),
          ledger: () => github.readLedger(),
          loseNextCreateResponse: () => github.setFailureModes({ loseCreateResponseOnce: true }),
        },
        branch,
      );
      await settleReads(page, 'Refresh Git state', 'remote-delivery-settled');
      await testInfo.attach('remote-delivery-result', {
        body: JSON.stringify(result, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('github-boundary-ledger', {
        body: JSON.stringify(await github.readLedger(), null, 2),
        contentType: 'application/json',
      });
    } catch (error) {
      failures.push(error);
    }
    observedPage?.off('request', onRequest);
    observedPage?.off('response', onResponse);
    observedPage?.off('requestfinished', onFinished);
    observedPage?.off('requestfailed', onFailed);
    if (!(await attachStartupBeforeCleanup(testInfo, startup, observedPage))) {
      failures.push(new Error('Git panel startup evidence could not be attached.'));
    }
    await captureFailure(failures, () =>
      testInfo.attach('fixture-startup-state', {
        body: Buffer.from(
          JSON.stringify(
            {
              backendPort,
              rendererPort,
              pageOrigin: observedPage ? new URL(observedPage.url()).origin : null,
              pageClosed: observedPage?.isClosed(),
              processId: processState?.pid,
              exitCode: processState?.exitCode,
              signalCode: processState?.signalCode,
            },
            null,
            2,
          ),
        ),
        contentType: 'application/json',
      }),
    );
    await captureFailure(failures, () =>
      testInfo.attach('github-pr-create-read-lifecycle', {
        body: Buffer.from(JSON.stringify(lifecycle, null, 2)),
        contentType: 'application/json',
      }),
    );
    await captureFailure(failures, () =>
      attachGitHubBoundaryEvidence(testInfo, ghFixture, 'before-cleanup', pendingReads.size),
    );
    try {
      await app?.close();
    } catch (error) {
      failures.push(error);
    }
    await captureFailure(failures, () =>
      attachGitHubBoundaryEvidence(testInfo, ghFixture, 'after-app-close', pendingReads.size),
    );
    try {
      await ghFixture?.close();
    } catch (error) {
      failures.push(error);
    }
    try {
      await transport?.close();
    } catch (error) {
      failures.push(error);
    }
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
    throwFailures(failures);
  });
});

async function attachGitHubBoundaryEvidence(
  testInfo: TestInfo,
  fixture: Awaited<ReturnType<typeof createGhLedgerFixture>> | undefined,
  phase: 'before-cleanup' | 'after-app-close',
  pendingReadCount: number,
): Promise<void> {
  if (!fixture) return;
  const [invocations, ledger] = await Promise.allSettled([
    fixture.readEvidence(),
    fixture.readLedger(),
  ]);
  const summary =
    ledger.status === 'fulfilled'
      ? {
          available: true,
          callCount: ledger.value.calls.length,
          createCalls: ledger.value.calls.filter(
            ({ args }: { args: string[] }) => args[0] === 'pr' && args[1] === 'create',
          ).length,
          successCalls: ledger.value.calls.filter(
            ({ outcome }: { outcome: string }) => outcome === 'success',
          ).length,
          errorCalls: ledger.value.calls.filter(
            ({ outcome }: { outcome: string }) => outcome === 'error',
          ).length,
          pullRequestCount: ledger.value.pullRequests.length,
          lostResponseConsumed: ledger.value.lostResponseConsumed === true,
        }
      : { available: false };
  await testInfo.attach(`github-boundary-${phase}`, {
    body: Buffer.from(
      JSON.stringify(
        {
          phase,
          // Request listeners were removed before cleanup; this is their last observed count.
          lastObservedPendingReadCount: pendingReadCount,
          invocations:
            invocations.status === 'fulfilled' ? invocations.value : { available: false },
          ledger: summary,
        },
        null,
        2,
      ),
    ),
    contentType: 'application/json',
  });
  const incompleteInvocations =
    invocations.status === 'fulfilled' &&
    (invocations.value.errors !== 0 || invocations.value.truncated);
  if (invocations.status === 'rejected' || ledger.status === 'rejected' || incompleteInvocations) {
    throw new Error('GitHub fixture boundary evidence could not be collected completely.');
  }
}

async function waitForOwnedRendererLoad(page: Page, rendererPort: number): Promise<void> {
  // firstWindow observes construction before main.ts finishes its initial loadURL.
  // A visible SSR control alone does not authorize interrupting that navigation.
  await page.waitForURL((url) => url.origin === `http://127.0.0.1:${rendererPort}`, {
    waitUntil: 'load',
    timeout: 30_000,
  });
}

async function captureFailure(
  failures: unknown[],
  operation: () => void | Promise<void>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    failures.push(error);
  }
}

function throwFailures(failures: unknown[]): void {
  if (failures.length) {
    throw new AggregateError(
      failures,
      failures.map((error) => (error instanceof Error ? error.message : String(error))).join('\n'),
    );
  }
}

async function attachStartupBeforeCleanup(
  testInfo: TestInfo,
  startup: ReturnType<typeof createStartupEvidence>,
  page: Page | undefined,
): Promise<boolean> {
  return await attemptStartupEvidenceAttachment(async () => {
    await testInfo.attach('fixture-startup-before-cleanup', {
      body: Buffer.from(
        JSON.stringify(
          {
            ...startup.snapshot(),
            pageOrigin: page ? new URL(page.url()).origin : null,
            pageClosed: page?.isClosed() ?? null,
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });
  });
}

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
