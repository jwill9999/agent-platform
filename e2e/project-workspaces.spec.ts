import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';

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
  const hostPath = join(workspaceHostPath(), 'e2e-project-workspaces', name);
  rmSync(hostPath, { recursive: true, force: true });
  mkdirSync(hostPath, { recursive: true });
  return { hostPath, containerPath: toContainerWorkspacePath(hostPath) };
}

function writeRepoFixture(root: string, options: { includeInstructions: boolean }) {
  mkdirSync(join(root, 'apps', 'web'), { recursive: true });
  mkdirSync(join(root, 'packages', 'api'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'e2e-monorepo', private: true, workspaces: ['apps/*', 'packages/*'] }),
  );
  writeFileSync(join(root, 'README.md'), '# E2E Project\n');
  writeFileSync(join(root, 'apps', 'web', 'page.tsx'), 'export default function Page() {}\n');
  writeFileSync(join(root, 'packages', 'api', 'index.ts'), 'export const api = true;\n');
  if (options.includeInstructions) {
    writeFileSync(join(root, 'AGENTS.md'), 'Root project instructions\n');
    writeFileSync(join(root, 'apps', 'web', 'AGENTS.md'), 'Web app instructions\n');
  }
}

async function openProject(page: Page, containerPath: string) {
  await page.goto('/ide');
  const binding = page.getByLabel('Project binding');
  await expect(binding).toBeVisible();
  await page.getByLabel('Backend project path').fill(containerPath);
  await binding.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(binding.getByText('Backend accessible')).toBeVisible();
  await expect(binding.getByText(`Root: ${containerPath}`)).toBeVisible();
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
  test('opens a Project with AGENTS.md, shows the review gate, and approves it', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = resetFixtureDir(`with-agents-${testInfo.workerIndex}`);
    writeRepoFixture(fixture.hostPath, { includeInstructions: true });

    const binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Instructions review required')).toBeVisible();
    await expect(
      binding.getByText(/Read-only inspection and planning remain available/),
    ).toBeVisible();
    await expect(binding.getByRole('button', { name: 'Approve' })).toBeVisible();

    const opened = await findProjectByRoot(request, fixture.containerPath);
    expect(opened.metadata.onboardingState).toBe('needs_review');
    expect(opened.metadata.instructionFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scope: 'root', path: 'AGENTS.md' }),
        expect.objectContaining({
          scope: 'nested',
          path: 'apps/web/AGENTS.md',
          appliesToPath: 'apps/web',
        }),
      ]),
    );

    await binding.getByRole('button', { name: 'Approve' }).click();
    await expect(binding.getByText('Instructions approved')).toBeVisible();
    await expect(binding.getByText('Code edits and write tools are available')).toBeVisible();

    const approved = await findProjectByRoot(request, fixture.containerPath);
    expect(approved.metadata.onboardingState).toBe('approved');
    expect(approved.metadata.instructionFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'root',
          path: 'AGENTS.md',
          approvedAtMs: expect.any(Number),
        }),
        expect.objectContaining({
          scope: 'nested',
          path: 'apps/web/AGENTS.md',
          approvedAtMs: expect.any(Number),
        }),
      ]),
    );
  });

  test('opens a Project without AGENTS.md as read-only and refuses approval', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = resetFixtureDir(`missing-agents-${testInfo.workerIndex}`);
    writeRepoFixture(fixture.hostPath, { includeInstructions: false });

    const binding = await openProject(page, fixture.containerPath);
    await expect(binding.getByText('Instructions missing')).toBeVisible();
    await expect(
      binding.getByText(/Read-only inspection and planning remain available/),
    ).toBeVisible();
    await expect(binding.getByRole('button', { name: 'Approve' })).toHaveCount(0);

    const opened = await findProjectByRoot(request, fixture.containerPath);
    expect(opened.metadata.onboardingState).toBe('missing');
    expect(opened.metadata.instructionFiles).toEqual([]);
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
