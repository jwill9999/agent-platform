import { expect, test, type Locator } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

test.use({ trace: 'on' });
const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';

async function confirm(panel: Locator, title: string) {
  const review = panel.getByRole('region', { name: title, exact: true });
  await expect(review.getByRole('status')).toHaveText('Status: prepared');
  await review.getByRole('button', { name: 'Confirm Git operation', exact: true }).click();
  await expect(review.getByRole('status')).toHaveText('Status: succeeded');
}

test('Docker Project reviews local Git delivery, rejects stale index and remembers a hidden panel', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  let rateLimitRemaining = Number.POSITIVE_INFINITY;
  let rateLimitResetAt = 0;
  page.on('response', (response) => {
    if (!response.url().includes('/api/v1/')) return;
    const header = response.headers()['ratelimit'];
    const remaining = header?.match(/remaining=(\d+)/)?.[1];
    const reset = header?.match(/reset=(\d+)/)?.[1];
    if (remaining !== undefined && reset !== undefined) {
      rateLimitRemaining = Number(remaining);
      rateLimitResetAt = Date.now() + Number(reset) * 1000;
    }
  });
  // Never discover or modify an arbitrary local user's running stack.
  const container =
    process.env.GIT_DELIVERY_API_CONTAINER ??
    (process.env.CI
      ? execFileSync('docker', ['compose', 'ps', '-q', 'api'], { encoding: 'utf8' }).trim()
      : '');
  expect(container, 'Select the isolated GIT_DELIVERY_API_CONTAINER for local runs').not.toBe('');
  const name = `git-delivery-${randomUUID()}`;
  const directory = `/tmp/${name}`;
  const exec = (args: string[]) =>
    execFileSync('docker', ['exec', container, ...args], {
      encoding: 'utf8',
      timeout: 15_000,
    });
  const git = (...args: string[]) => exec(['git', '-C', directory, ...args]).trim();
  const write = (path: string, content: string) =>
    exec([
      'node',
      '-e',
      'const fs=require("node:fs"),p=require("node:path");fs.mkdirSync(p.dirname(process.argv[1]),{recursive:true});fs.writeFileSync(process.argv[1],process.argv[2]);',
      `${directory}/${path}`,
      content,
    ]);
  let projectId: string | undefined;
  let agentId: string | undefined;
  let modelConfigId: string | undefined;
  let sessionId: string | undefined;
  let primaryError: unknown;
  try {
    exec(['git', 'init', '-b', 'feature/delivery-test', directory]);
    git('config', 'user.name', 'Delivery browser fixture');
    git('config', 'user.email', 'delivery@example.invalid');
    write('README.md', '# Delivery fixture\n');
    write('unrelated.txt', 'original unrelated\n');
    git('add', '--', 'README.md', 'unrelated.txt');
    git('commit', '-m', 'fixture initial');
    const createdModel = await request.post(`${apiURL}/v1/model-configs`, {
      data: {
        name,
        provider: 'ollama',
        model: `${name}-local-only`,
      },
    });
    expect(createdModel.ok()).toBe(true);
    modelConfigId = (await createdModel.json()).data.id;
    const createdAgent = await request.post(`${apiURL}/v1/agents`, {
      data: {
        name,
        modelConfigId,
        systemPrompt: 'Disposable Git UI fixture. No model calls are needed.',
        allowedSkillIds: [],
        allowedToolIds: [],
        allowedMcpServerIds: [],
        pluginAllowlist: [],
        executionLimits: { maxSteps: 2, maxParallelTasks: 1, timeoutMs: 30000 },
      },
    });
    expect(createdAgent.ok()).toBe(true);
    agentId = (await createdAgent.json()).data.id;
    const registered = await request.post(`${apiURL}/v1/projects/desktop/register`, {
      headers: { 'x-agent-platform-desktop-bridge': '1' },
      data: { name, path: directory },
    });
    expect(registered.ok()).toBe(true);
    projectId = (await registered.json()).data.project.id;
    const createdSession = await request.post(`${apiURL}/v1/sessions`, {
      data: { agentId, mode: 'project', projectId },
    });
    expect(createdSession.ok()).toBe(true);
    sessionId = (await createdSession.json()).data.id;
    await page.goto(`/?projectId=${projectId}&sessionId=${sessionId}`);
    const input = page.getByPlaceholder('Ask about this Project...');
    await expect(input).toBeEnabled();
    await input.fill('/init');
    const send = page.getByRole('button', { name: 'Send message', exact: true });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.getByRole('button', { name: 'Approve instructions' })).toBeVisible();
    await page.getByRole('button', { name: 'Approve instructions' }).click();
    await expect(page.getByText('Project instructions approved').last()).toBeVisible();
    git('add', '--', 'AGENTS.md');
    git('commit', '-m', 'fixture approved instructions');
    const initialHead = git('rev-parse', 'HEAD');
    write('README.md', '# Delivery fixture\nReviewed change\n');
    write('unrelated.txt', 'unrelated work must survive\n');
    await page.getByRole('tab', { name: 'Git & GitHub' }).click();
    const panel = page.getByRole('complementary', { name: 'Git and GitHub' });
    const refresh = () => panel.getByRole('button', { name: 'Refresh Git state' }).click();
    const selectReadme = async () => {
      await panel.getByRole('button', { name: /^Changes/ }).click();
      await panel.getByRole('button', { name: /README\.md/ }).click();
    };
    await refresh();
    await selectReadme();
    await panel.getByRole('button', { name: 'Stage file', exact: true }).click();
    const stageReview = panel.getByRole('region', { name: 'Stage selected files', exact: true });
    await expect(stageReview.getByRole('list', { name: 'Reviewed files' })).toHaveText('README.md');
    expect(git('diff', '--cached', '--name-only')).toBe('');
    await stageReview.getByRole('button', { name: 'Cancel Git operation' }).click();
    await expect(stageReview.getByRole('status')).toHaveText('Status: cancelled');
    expect(git('diff', '--cached', '--name-only')).toBe('');
    await panel.getByRole('button', { name: 'Stage file', exact: true }).click();
    await confirm(panel, 'Stage selected files');
    expect(git('diff', '--cached', '--name-only')).toBe('README.md');
    await panel.getByRole('button', { name: /^Commit/ }).click();
    await panel
      .getByRole('list', { name: 'Complete staged index' })
      .getByRole('button', { name: 'Review unstage' })
      .click();
    await confirm(panel, 'Unstage selected files');
    expect(git('diff', '--cached', '--name-only')).toBe('');
    await selectReadme();
    await panel.getByRole('button', { name: 'Stage file', exact: true }).click();
    await confirm(panel, 'Stage selected files');
    write('.agent-platform/retained.txt', 'owned hidden fixture\n');
    git('add', '--', 'unrelated.txt', '.agent-platform/retained.txt');
    await refresh();
    await panel.getByRole('button', { name: /^Commit/ }).click();
    const fullIndex = panel.getByRole('list', { name: 'Complete staged index' });
    await expect(fullIndex).toContainText('.agent-platform/retained.txt');
    await expect(fullIndex).toContainText('unrelated.txt');
    await fullIndex
      .getByRole('listitem')
      .filter({ hasText: 'unrelated.txt' })
      .getByRole('button', { name: 'Review unstage' })
      .click();
    await confirm(panel, 'Unstage selected files');
    // This dense fixture performs many human review flows within seconds. Respect the real
    // server's advertised request budget before the next phase instead of changing its policy.
    if (rateLimitRemaining < 80) {
      const resetWaitMs = Math.max(0, rateLimitResetAt - Date.now()) + 100;
      expect(resetWaitMs).toBeLessThanOrEqual(61_000);
      await testInfo.attach('request-budget-pacing', {
        body: JSON.stringify({ remaining: rateLimitRemaining, resetWaitMs }),
        contentType: 'application/json',
      });
      await delay(resetWaitMs);
    }
    await panel.getByPlaceholder('Commit message').fill('test: reviewed local delivery');
    await panel.getByRole('button', { name: 'Review commit', exact: true }).click();
    const commitReview = panel.getByRole('region', { name: 'Commit reviewed files', exact: true });
    await expect(commitReview.getByRole('list', { name: 'Reviewed files' })).toHaveText(
      '.agent-platform/retained.txtREADME.md',
    );
    write('external.txt', 'external index change\n');
    git('add', '--', 'external.txt');
    await commitReview.getByRole('button', { name: 'Confirm Git operation' }).click();
    await expect(commitReview.getByRole('status')).toHaveText('Status: stale');
    expect(git('rev-parse', 'HEAD')).toBe(initialHead);
    await refresh();
    await fullIndex
      .getByRole('listitem')
      .filter({ hasText: 'external.txt' })
      .getByRole('button', { name: 'Review unstage' })
      .click();
    await confirm(panel, 'Unstage selected files');
    await panel.getByRole('button', { name: 'Review commit', exact: true }).click();
    await confirm(panel, 'Commit reviewed files');
    const committedHead = git('rev-parse', 'HEAD');
    expect(committedHead).not.toBe(initialHead);
    expect(git('show', '--format=', '--name-only', 'HEAD').split('\n').sort()).toEqual([
      '.agent-platform/retained.txt',
      'README.md',
    ]);
    expect(exec(['cat', `${directory}/unrelated.txt`])).toBe('unrelated work must survive\n');
    expect(git('diff', '--cached', '--name-only')).toBe('');
    // A renamed row must review both paths, otherwise its source deletion remains staged.
    git('mv', '--', 'README.md', 'renamed-readme.md');
    await refresh();
    await panel.getByRole('button', { name: /^Changes/ }).click();
    await panel.getByRole('button', { name: /renamed-readme\.md/ }).click();
    await panel.getByRole('button', { name: 'Unstage file', exact: true }).click();
    const renameReview = panel.getByRole('region', { name: 'Unstage selected files', exact: true });
    await expect(renameReview.getByRole('list', { name: 'Reviewed files' })).toHaveText(
      'README.mdrenamed-readme.md',
    );
    await confirm(panel, 'Unstage selected files');
    expect(git('diff', '--cached', '--name-status')).toBe('');
    expect(exec(['cat', `${directory}/renamed-readme.md`])).toContain('Reviewed change');
    expect(git('rev-parse', 'HEAD')).toBe(committedHead);

    // Existing status deliberately filters hidden files: the complete index must still expose Commit.
    write('.agent-platform/hidden-only.txt', 'hidden-only staged fixture\n');
    git('add', '--', '.agent-platform/hidden-only.txt');
    const filteredStatus = await page.request.get(`/api/v1/projects/${projectId}/git/status`);
    expect(filteredStatus.ok()).toBe(true);
    expect((await filteredStatus.json()).data.workingTree.staged).toBe(0);
    await refresh();
    await expect(panel.getByRole('button', { name: /^Commit/ })).toBeVisible();
    await panel.getByRole('button', { name: /^Commit/ }).click();
    await expect(fullIndex).toContainText('.agent-platform/hidden-only.txt');
    await expect(panel.getByPlaceholder('Commit message')).toBeEnabled();
    await panel.getByPlaceholder('Commit message').fill('review hidden-only index');
    await panel.getByRole('button', { name: 'Review commit', exact: true }).click();
    await expect(commitReview.getByRole('list', { name: 'Reviewed files' })).toHaveText(
      '.agent-platform/hidden-only.txt',
    );
    await commitReview.getByRole('button', { name: 'Cancel Git operation' }).click();
    await expect(commitReview.getByRole('status')).toHaveText('Status: cancelled');
    expect(git('rev-parse', 'HEAD')).toBe(committedHead);
    expect(git('diff', '--cached', '--name-only')).toBe('.agent-platform/hidden-only.txt');
    await fullIndex.getByRole('button', { name: 'Review unstage' }).click();
    await confirm(panel, 'Unstage selected files');
    expect(git('diff', '--cached', '--name-only')).toBe('');
    await page.getByRole('button', { name: 'Hide activity and Git panel' }).click();
    await expect(panel).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Show activity and Git panel' })).toBeVisible();
    await expect(panel).toHaveCount(0);
    await page.getByRole('button', { name: 'Show activity and Git panel' }).click();
    await page.getByRole('tab', { name: 'Git & GitHub' }).click();
    await expect(panel).toBeVisible();
    expect(git('rev-parse', 'HEAD')).toBe(committedHead);
    expect(git('diff', '--cached', '--name-only')).toBe('');
    await testInfo.attach('local-git-result', {
      body: JSON.stringify(
        {
          initialHead,
          committedHead,
          committedFiles: ['.agent-platform/retained.txt', 'README.md'],
          cancelledPreparationHadNoEffect: true,
          staleCommitHadNoEffect: true,
          unrelatedWorkPreserved: true,
          hideShowReloadHadNoGitEffect: true,
          renamedRowUnstagedBothPaths: true,
          hiddenOnlyIndexCommitReviewReachable: true,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
  } catch (error) {
    primaryError = error;
  }
  {
    // A timed-out test disposes Playwright's request context. Cleanup owns independent bounded requests.
    const cleanupErrors: unknown[] = [];
    for (const [resource, id] of [
      ['sessions', sessionId],
      ['projects', projectId],
      ['agents', agentId],
      ['model-configs', modelConfigId],
    ]) {
      if (!id) continue;
      try {
        const response = await fetch(`${apiURL}/v1/${resource}/${id}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok)
          throw new Error(`Owned ${resource} cleanup failed: HTTP${response.status}`);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      exec(['rm', '-rf', '--', directory]);
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (primaryError && cleanupErrors.length)
      throw new AggregateError(
        [primaryError, ...cleanupErrors],
        `Git delivery journey and cleanup failed:\n${[primaryError, ...cleanupErrors].map((error) => (error instanceof Error ? error.message : String(error))).join('\n')}`,
      );
    if (primaryError) throw primaryError;
    if (cleanupErrors.length)
      throw new AggregateError(
        cleanupErrors,
        `Owned Git delivery cleanup failed:\n${cleanupErrors.map((error) => (error instanceof Error ? error.message : String(error))).join('\n')}`,
      );
  }
});
