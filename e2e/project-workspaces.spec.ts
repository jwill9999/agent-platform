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

function writeFixtureFile(path: string, content: string) {
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  chmodSync(path, 0o666);
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
    JSON.stringify({
      name: 'e2e-monorepo',
      private: true,
      workspaces: ['apps/*', 'packages/*'],
      scripts: {
        build: 'pnpm -r build',
        lint: 'pnpm -r lint',
        test: 'pnpm -r test',
      },
    }),
  );
  writeFileSync(
    join(root, 'apps', 'web', 'package.json'),
    JSON.stringify({
      name: '@e2e/web',
      private: true,
      scripts: { build: 'next build', lint: 'eslint .', test: 'vitest run' },
    }),
  );
  writeFileSync(
    join(root, 'packages', 'api', 'package.json'),
    JSON.stringify({
      name: '@e2e/api',
      private: true,
      scripts: { build: 'tsc -p tsconfig.json', lint: 'eslint .', test: 'vitest run' },
    }),
  );
  writeFileSync(join(root, 'README.md'), '# E2E Project\n');
  writeFileSync(join(root, 'apps', 'web', 'page.tsx'), 'export default function Page() {}\n');
  writeFileSync(join(root, 'packages', 'api', 'index.ts'), 'export const api = true;\n');
  if (options.includeInstructions) {
    const rootInstructionsPath = join(root, 'AGENTS.md');
    const webInstructionsPath = join(root, 'apps', 'web', 'AGENTS.md');
    writeFixtureFile(
      rootInstructionsPath,
      [
        '# Agent Instructions',
        '',
        'Use Beads for task tracking and keep Project work read-only until instructions are approved.',
        'Run build, typecheck, lint, tests, and docs quality gates before closing a ticket.',
        'Open a pull request and wait for CI, SonarCloud, GitGuardian, and review comments.',
      ].join('\n'),
    );
    writeFixtureFile(
      webInstructionsPath,
      'Use the root instructions and run web lint/tests before closing changes.\n',
    );
  }
}

function writeDocsFixture(root: string) {
  mkdirSync(join(root, 'research'), { recursive: true });
  chmodSync(join(root, 'research'), 0o777);
  writeFileSync(join(root, 'README.md'), '# Research Workspace\n');
  writeFileSync(join(root, 'research', 'brief.md'), '# Brief\n\nCollect source notes.\n');
  writeFixtureFile(
    join(root, 'AGENTS.md'),
    [
      '# Agent Instructions',
      '',
      'This Project is a docs and research folder, not a coding-only repository.',
      'Use Beads for task tracking when work is ticketed and keep changes read-only until approved.',
      'Run document review, link checks, and relevant quality checks before closing a ticket.',
      'Open a pull request when files change and wait for CI, SonarCloud, GitGuardian, and comments.',
    ].join('\n'),
  );
}

async function openProject(page: Page, containerPath: string) {
  await page.goto('/ide');
  const binding = page.getByLabel('Project binding');
  await expect(binding).toBeVisible();
  await binding.getByText('Use folder path').click();
  await page.getByLabel('Project folder path').fill(containerPath);
  await binding.getByRole('button', { name: 'Open Path' }).click();
  await expect(binding.getByText('Open', { exact: true })).toBeVisible();
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
  test.describe.configure({ mode: 'serial' });

  test('opens a Project with sufficient AGENTS.md and auto-approves it', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = resetFixtureDir(`with-agents-${testInfo.workerIndex}`);
    writeRepoFixture(fixture.hostPath, { includeInstructions: true });

    const binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Project ready')).toBeVisible();
    await expect(binding.getByText('File edits are enabled for this Project')).toBeVisible();
    await expect(binding.getByRole('button', { name: 'Approve setup' })).toHaveCount(0);

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
    expect(opened.metadata.onboardingAssessment).toEqual(
      expect.objectContaining({
        profile: 'mixed',
        subprojectScopes: expect.arrayContaining([
          expect.objectContaining({ path: 'apps/web', packageName: '@e2e/web' }),
          expect.objectContaining({ path: 'packages/api', packageName: '@e2e/api' }),
        ]),
      }),
    );

    await binding.getByRole('button', { name: 'Refresh project assessment' }).click();
    await expect(binding.getByText('Project ready')).toBeVisible({ timeout: 15_000 });
    const refreshed = await findProjectByRoot(request, fixture.containerPath);
    expect(refreshed.metadata.onboardingRefresh).toEqual(
      expect.objectContaining({
        previousState: 'approved',
        nextState: 'approved',
        updateStatus: 'no_change',
        materialDrift: false,
      }),
    );
  });

  test('requires review for insufficient Project instructions', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = resetFixtureDir(`stale-agents-${testInfo.workerIndex}`);
    writeRepoFixture(fixture.hostPath, { includeInstructions: false });
    writeFixtureFile(join(fixture.hostPath, 'AGENTS.md'), 'thin instructions\n');

    const binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Project setup needs review')).toBeVisible();
    await expect(binding.getByText('Review required before edits')).toBeVisible();
    await expect(binding.getByText('The root instructions need clearer')).toHaveCount(0);
    await expect(binding.getByText('File edits are enabled for this Project')).toHaveCount(0);

    const opened = await findProjectByRoot(request, fixture.containerPath);
    expect(opened.metadata.onboardingState).toBe('in_progress');
    expect(opened.metadata.onboardingAssessment).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        gaps: expect.arrayContaining([
          expect.objectContaining({
            kind: 'stale_instructions',
            severity: 'warning',
          }),
        ]),
      }),
    );
  });

  test('reviews a drafted AGENTS.md before unlocking Project writes', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = resetFixtureDir(`missing-agents-${testInfo.workerIndex}`);
    writeRepoFixture(fixture.hostPath, { includeInstructions: false });

    const binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Project setup needs review')).toBeVisible();
    await expect(binding.getByText(/review the Project instructions/)).toBeVisible();
    await expect(binding.getByRole('button', { name: 'Approve setup' })).toHaveCount(0);

    const opened = await findProjectByRoot(request, fixture.containerPath);
    expect(opened.metadata.onboardingState).toBe('in_progress');
    expect(opened.metadata.instructionFiles).toEqual([]);

    await binding.getByRole('button', { name: 'Review setup' }).click();
    await expect(binding.getByText('Revision 1')).toBeVisible();
    await expect(binding.getByText('# Agent Instructions')).toBeVisible();
    await expect(page.getByLabel('Onboarding answer')).toBeVisible();

    const answer = 'This project supports code changes and documentation updates.';
    await page.getByLabel('Onboarding answer').fill(answer);
    await binding.getByRole('button', { name: 'Send answer' }).click();
    await expect(binding.getByText('Revision 2')).toBeVisible();
    await expect(binding.getByText(answer)).toBeVisible();
    await expect(binding.getByText('File edits are enabled for this Project')).toHaveCount(0);

    const feedback = 'Clarify that documentation updates are in scope.';
    await page.getByLabel('Review feedback').fill(feedback);
    await binding.getByRole('button', { name: 'Request changes' }).click();
    await expect(binding.getByText('Project setup needs review')).toBeVisible();
    await expect(binding.getByText('File edits are enabled for this Project')).toHaveCount(0);

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
    await expect(binding.getByText('Project ready')).toBeVisible({ timeout: 15_000 });
    await expect(binding.getByText('File edits are enabled for this Project')).toBeVisible({
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

  test('reviews closeout instruction update candidates and refreshes Project instructions', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = resetFixtureDir(`closeout-updates-${testInfo.workerIndex}`);
    writeRepoFixture(fixture.hostPath, { includeInstructions: true });

    let binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Project ready')).toBeVisible();

    const opened = await findProjectByRoot(request, fixture.containerPath);
    const collected = await request.post(
      `${apiURL}/v1/projects/${opened.id}/instruction-updates/candidates`,
      {
        data: {
          candidates: [
            {
              summary: 'Record the focused E2E command for Project workspace checks.',
              proposedMarkdown:
                '- Focused Project workspace E2E: pnpm exec playwright test -c e2e/playwright.config.ts e2e/project-workspaces.spec.ts',
              source: 'closeout',
              risk: 'low_risk_fact',
              evidence: [{ path: 'e2e/project-workspaces.spec.ts', kind: 'test' }],
            },
            {
              summary: 'Reject the outdated Project note.',
              proposedMarkdown: '- Outdated Project note that should not be persisted.',
              source: 'closeout',
              risk: 'low_risk_fact',
              evidence: [
                { path: 'docs/tasks/agent-platform-project-onboarding.6.md', kind: 'docs' },
              ],
            },
          ],
        },
      },
    );
    expect(collected.ok(), await collected.text()).toBeTruthy();
    const proposed = await request.post(
      `${apiURL}/v1/projects/${opened.id}/instruction-updates/closeout`,
    );
    expect(proposed.ok(), await proposed.text()).toBeTruthy();

    binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Closeout updates')).toBeVisible();
    await expect(binding.getByText('Record the focused E2E command')).toBeVisible();
    await expect(binding.getByText('Reject the outdated Project note')).toBeVisible();
    const applyResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/projects/${opened.id}/instruction-updates/candidates/`) &&
        response.url().endsWith('/apply') &&
        response.request().method() === 'POST',
    );
    await binding.getByRole('button', { name: 'Apply' }).first().click();
    const applied = await applyResponse;
    expect(applied.ok(), await applied.text()).toBeTruthy();
    await expect(binding.getByText('Record the focused E2E command')).toHaveCount(0);
    const rejectResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/projects/${opened.id}/instruction-updates/candidates/`) &&
        response.url().endsWith('/reject') &&
        response.request().method() === 'POST',
    );
    await binding.getByRole('button', { name: 'Reject' }).click();
    const rejected = await rejectResponse;
    expect(rejected.ok(), await rejected.text()).toBeTruthy();
    await expect(binding.getByText('Reject the outdated Project note')).toHaveCount(0);
    expect(readFileSync(join(fixture.hostPath, 'AGENTS.md'), 'utf8')).toContain(
      'Focused Project workspace E2E: pnpm exec playwright test',
    );
    expect(readFileSync(join(fixture.hostPath, 'AGENTS.md'), 'utf8')).not.toContain(
      'Outdated Project note',
    );

    writeFileSync(join(fixture.hostPath, 'AGENTS.md'), 'thin instructions\n');
    await binding.getByRole('button', { name: 'Refresh project assessment' }).first().click();
    await expect(binding.getByText('Project setup needs review')).toBeVisible({
      timeout: 15_000,
    });

    const refreshed = await findProjectByRoot(request, fixture.containerPath);
    expect(refreshed.metadata.onboardingRefresh).toEqual(
      expect.objectContaining({
        previousState: 'approved',
        nextState: 'needs_review',
        updateStatus: 'material_drift',
        materialDrift: true,
      }),
    );
  });

  test('handles mixed and non-code Project folders without coding-only framing', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = resetFixtureDir(`docs-project-${testInfo.workerIndex}`);
    writeDocsFixture(fixture.hostPath);

    const binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Project ready')).toBeVisible();
    await expect(binding.getByText('Project setup')).toBeVisible();
    await expect(binding.getByText(/Detected docs content Project/)).toHaveCount(0);
    await expect(binding.getByText(/coding-only/)).toHaveCount(0);

    const opened = await findProjectByRoot(request, fixture.containerPath);
    expect(opened.metadata.onboardingAssessment).toEqual(
      expect.objectContaining({
        profile: 'docs_content',
        capabilities: expect.arrayContaining(['docs_research']),
      }),
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
