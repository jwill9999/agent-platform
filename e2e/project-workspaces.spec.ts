import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';
const suiteRunId = `${Date.now()}-${process.pid}`;

type ProjectRecord = {
  id: string;
  workspaceKey?: string;
  metadata: Record<string, unknown>;
};

function workspaceHostPath(): string {
  if (process.env.AGENT_WORKSPACE_HOST_PATH) {
    return resolve(process.env.AGENT_WORKSPACE_HOST_PATH);
  }
  if (process.env.AGENT_PLATFORM_HOME) {
    return resolve(process.env.AGENT_PLATFORM_HOME, 'workspaces', 'default');
  }
  return resolve('.agent-platform', 'workspaces', 'default');
}

function toContainerWorkspacePath(hostPath: string): string {
  const rel = relative(workspaceHostPath(), hostPath).split(sep).join('/');
  return rel ? `/workspace/${rel}` : '/workspace';
}

function resetFixtureDir(name: string): { hostPath: string; containerPath: string } {
  const hostPath = join(workspaceHostPath(), 'e2e-project-workspaces', `${suiteRunId}-${name}`);
  rmSync(hostPath, { recursive: true, force: true });
  mkdirSync(hostPath, { recursive: true });
  chmodSync(hostPath, 0o777);
  return { hostPath, containerPath: toContainerWorkspacePath(hostPath) };
}

function writeRepoFixture(root: string, options: { includeInstructions: boolean }) {
  mkdirSync(join(root, 'apps', 'web'), { recursive: true });
  mkdirSync(join(root, 'packages', 'api'), { recursive: true });
  chmodSync(join(root, 'apps'), 0o777);
  chmodSync(join(root, 'apps', 'web'), 0o777);
  chmodSync(join(root, 'packages'), 0o777);
  chmodSync(join(root, 'packages', 'api'), 0o777);
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'e2e-monorepo', private: true, workspaces: ['apps/*', 'packages/*'] }),
  );
  writeFileSync(join(root, 'README.md'), '# E2E Project\n');
  writeFileSync(join(root, 'apps', 'web', 'page.tsx'), 'export default function Page() {}\n');
  writeFileSync(join(root, 'packages', 'api', 'index.ts'), 'export const api = true;\n');
  if (options.includeInstructions) {
    writeFileSync(
      join(root, 'AGENTS.md'),
      [
        '# Agent Instructions',
        '',
        'Use Beads for task tracking and keep Project work read-only until instructions are approved.',
        'Run build, typecheck, lint, tests, and docs quality gates before closing a ticket.',
        'Open a pull request and wait for CI, SonarCloud, GitGuardian, and review comments.',
      ].join('\n'),
    );
    writeFileSync(
      join(root, 'apps', 'web', 'AGENTS.md'),
      'Use the root instructions and run web lint/tests before closing changes.\n',
    );
  }
}

async function openProject(page: Page, containerPath: string) {
  await page.goto('/ide');
  const binding = page.getByLabel('Project binding');
  await expect(binding).toBeVisible();
  await page.getByLabel('Project folder path').fill(containerPath);
  await binding.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(binding.getByText('Available', { exact: true })).toBeVisible();
  await expect(
    binding.getByText(`Folder: ${containerPath.split('/').pop() ?? 'workspace'}`),
  ).toBeVisible();
  return binding;
}

async function findProjectByRoot(
  request: APIRequestContext,
  containerPath: string,
): Promise<ProjectRecord> {
  const res = await request.get(`${apiURL}/v1/projects`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: ProjectRecord[] };
  const project = body.data.find((candidate) => {
    return (
      candidate.workspaceKey === containerPath ||
      candidate.metadata.backendProjectRoot === containerPath
    );
  });
  expect(project).toBeTruthy();
  return project!;
}

test.describe('Project workspace E2E', () => {
  test('opens a Project with sufficient AGENTS.md and auto-approves it', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = resetFixtureDir(`with-agents-${testInfo.workerIndex}`);
    writeRepoFixture(fixture.hostPath, { includeInstructions: true });

    const binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Instructions approved')).toBeVisible();
    await expect(binding.getByText('Code edits and write tools are available')).toBeVisible();
    await expect(binding.getByRole('button', { name: 'Approve' })).toHaveCount(0);

    const opened = await findProjectByRoot(request, fixture.containerPath);
    expect(opened.metadata.onboardingState).toBe('approved');
    expect(opened.metadata.onboardingApproval).toEqual(
      expect.objectContaining({
        source: 'auto_assessment',
        targetPath: 'AGENTS.md',
        contentHash: expect.any(String),
      }),
    );
    expect(opened.metadata.instructionFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'root',
          path: 'AGENTS.md',
          approvedAtMs: expect.any(Number),
        }),
        expect.objectContaining({
          scope: 'nested',
          path: 'apps/web/AGENTS.md',
          appliesToPath: 'apps/web',
        }),
      ]),
    );
  });

  test('reviews a drafted AGENTS.md before unlocking Project writes', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = resetFixtureDir(`missing-agents-${testInfo.workerIndex}`);
    writeRepoFixture(fixture.hostPath, { includeInstructions: false });

    const binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Instructions review in progress')).toBeVisible();
    await expect(
      binding.getByText(/Read-only inspection and planning remain available/),
    ).toBeVisible();
    await expect(binding.getByRole('button', { name: 'Approve' })).toHaveCount(0);

    const opened = await findProjectByRoot(request, fixture.containerPath);
    expect(opened.metadata.onboardingState).toBe('in_progress');
    expect(opened.metadata.instructionFiles).toEqual([]);

    await binding.getByRole('button', { name: 'Start' }).click();
    await expect(binding.getByText('Revision 1')).toBeVisible();
    await expect(binding.getByText('# Agent Instructions')).toBeVisible();
    await expect(page.getByLabel('Onboarding answer')).toBeVisible();

    const answer = 'This project supports code changes and documentation updates.';
    await page.getByLabel('Onboarding answer').fill(answer);
    await binding.getByRole('button', { name: 'Send answer' }).click();
    await expect(binding.getByText('Revision 2')).toBeVisible();
    await expect(binding.getByText(answer)).toBeVisible();
    await expect(binding.getByText('Code edits and write tools are available')).toHaveCount(0);

    const feedback = 'Clarify that documentation updates are in scope.';
    await page.getByLabel('Review feedback').fill(feedback);
    await binding.getByRole('button', { name: 'Request changes' }).click();
    await expect(binding.getByText('Instructions review in progress')).toBeVisible();
    await expect(binding.getByText('Code edits and write tools are available')).toHaveCount(0);

    const reviewed = await findProjectByRoot(request, fixture.containerPath);
    expect(reviewed.metadata.onboardingState).toBe('in_progress');
    expect(reviewed.metadata.onboardingReview).toEqual(
      expect.objectContaining({ decision: 'request_changes', comment: feedback }),
    );

    const approvalResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/projects/${reviewed.id}/onboarding/review`) &&
        response.request().method() === 'POST',
    );
    await binding.getByRole('button', { name: 'Approve draft' }).click();
    const response = await approvalResponse;
    expect(response.ok(), await response.text()).toBeTruthy();
    await expect(binding.getByText('Instructions approved')).toBeVisible({ timeout: 15_000 });
    await expect(binding.getByText('Code edits and write tools are available')).toBeVisible({
      timeout: 15_000,
    });

    const approved = await findProjectByRoot(request, fixture.containerPath);
    expect(approved.metadata.onboardingState).toBe('approved');
    expect(approved.metadata.onboardingDraft).toEqual(
      expect.objectContaining({
        revision: 2,
        markdown: expect.stringContaining(answer),
      }),
    );
    expect(approved.metadata.onboardingApproval).toEqual(
      expect.objectContaining({
        source: 'manual_review',
        targetPath: 'AGENTS.md',
        contentHash: expect.any(String),
      }),
    );
    expect(readFileSync(join(fixture.hostPath, 'AGENTS.md'), 'utf8')).toBe(
      (approved.metadata.onboardingDraft as { markdown: string }).markdown,
    );
  });

  test('keeps Chat mode separate from Project code tooling', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Open Chat/ }).click();

    await expect(page.locator('[aria-label="Active agent"]').first()).toContainText(
      'Personal assistant',
    );
    await expect(page.locator('textarea[placeholder*="Send a message"]')).toBeVisible();
    await expect(page.getByLabel('Project binding')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open Folder' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Terminal/ })).toHaveCount(0);
  });
});
