import { expect, type Page } from '@playwright/test';
import type { ApprovalRequest, GitDeliveryReceipt } from '@agent-platform/contracts';
import type { RemoteJourneyBoundary } from './panel-remote-journey';

export const gitChatTools = [
  'sys_git_stage',
  'sys_git_commit',
  'sys_git_push',
  'sys_git_create_pull_request',
];
export type GitChatScenario = 'success' | 'denied' | 'unknown';
export const gitChatModel = 'git-delivery-connected-chat';
export const gitChatKey = 'git-delivery-local-only-key-canary';
export const gitChatCommit = 'Reviewed chat delivery';
export const gitChatTitle = 'Reviewed chat pull request';
export const gitChatBody = 'Exact description reviewed in the chat card.';
export function gitChatReplies(scenario: GitChatScenario) {
  const stage = {
    kind: 'tool',
    id: 'chat-stage',
    name: 'sys_git_stage',
    args: { kind: 'stage', mode: 'stage', paths: ['delivery.txt'] },
  };
  if (scenario === 'denied')
    return [
      stage,
      {
        kind: 'text',
        text: 'Git action denied; no change made.',
        requiredToolResults: ['chat-stage'],
      },
    ];
  return [
    stage,
    {
      kind: 'tool',
      id: 'chat-commit',
      name: 'sys_git_commit',
      args: { kind: 'commit', message: gitChatCommit, paths: ['delivery.txt'] },
      requiredToolResults: ['chat-stage'],
    },
    {
      kind: 'tool',
      id: 'chat-push',
      name: 'sys_git_push',
      args: { kind: 'push', mode: 'publish' },
      requiredToolResults: ['chat-commit'],
    },
    {
      kind: 'tool',
      id: 'chat-pr',
      name: 'sys_git_create_pull_request',
      args: {
        kind: 'pull_request',
        baseBranch: 'staging',
        title: gitChatTitle,
        body: gitChatBody,
        draft: true,
      },
      requiredToolResults: ['chat-push'],
    },
    { kind: 'text', text: 'Reviewed chat delivery complete.', requiredToolResults: ['chat-pr'] },
  ];
}
export type GitChatApi = <T>(path: string, init?: RequestInit) => Promise<T>;
export async function createGitChatSession(api: GitChatApi, directory: string, name: string) {
  const model = await api<{ id: string }>('model-configs', {
    method: 'POST',
    body: JSON.stringify({ name, provider: 'ollama', model: gitChatModel, apiKey: gitChatKey }),
  });
  const agent = await api<{ id: string; name: string }>('agents', {
    method: 'POST',
    body: JSON.stringify({
      name,
      modelConfigId: model.id,
      systemPrompt: 'Perform only the requested reviewed Git delivery operation.',
      allowedSkillIds: [],
      allowedToolIds: gitChatTools,
      allowedMcpServerIds: [],
      pluginAllowlist: [],
      executionLimits: { maxSteps: 6, maxParallelTasks: 1, timeoutMs: 30000 },
    }),
  });
  const registered = await api<{ project: { id: string } }>('projects/desktop/register', {
    method: 'POST',
    headers: { 'x-agent-platform-desktop-bridge': '1' },
    body: JSON.stringify({ name, path: directory }),
  });
  const session = await api<{ id: string }>('sessions', {
    method: 'POST',
    body: JSON.stringify({ agentId: agent.id, mode: 'project', projectId: registered.project.id }),
  });
  return { model, agent, session, projectId: registered.project.id };
}
export async function openGitChat(
  page: Page,
  identity: Awaited<ReturnType<typeof createGitChatSession>>,
  origin = '',
) {
  await page.goto(`${origin}/?projectId=${identity.projectId}&sessionId=${identity.session.id}`);
  const input = page.getByPlaceholder('Ask about this Project...');
  await expect(input).toBeEnabled();
  await input.fill('/init');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('button', { name: 'Approve instructions' }).click();
  await expect(page.getByText('Project instructions approved').last()).toBeVisible();
  const model = page.getByRole('combobox', { name: 'Active model' });
  await model.click();
  await page.getByRole('option', { name: new RegExp(identity.agent.name) }).click();
  const hide = page.getByRole('button', { name: 'Hide activity and Git panel', exact: true });
  if (await hide.isVisible()) await hide.click();
  await expect(
    page.getByRole('button', { name: 'Show activity and Git panel', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Git & GitHub' })).toHaveCount(0);
}
export async function runGitChatJourney(options: {
  page: Page;
  api: GitChatApi;
  boundary: RemoteJourneyBoundary;
  projectId: string;
  sessionId: string;
  branch: string;
  scenario: GitChatScenario;
  waiting?: () => Promise<void>;
  beforePr?: () => Promise<void>;
  restartBeforeRestore?: () => Promise<Page>;
}) {
  const { api, boundary, projectId, sessionId, branch, scenario } = options;
  let { page } = options;
  boundary.git('add', '--', 'AGENTS.md');
  boundary.git('commit', '-m', 'fixture approved instructions');
  const initialHead = boundary.git('rev-parse', 'HEAD');
  const protectedHead = boundary.remote('rev-parse', 'refs/heads/staging');
  boundary.write('delivery.txt', 'Chat Git delivery fixture content\n');
  let input = page.getByPlaceholder('Ask about this Project...');
  await expect(input).toBeEnabled();
  await input.fill(
    'Review the selected delivery file, commit it, publish this branch, then create the requested draft PR against staging.',
  );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const operations: GitDeliveryReceipt[] = [];
  const names = scenario === 'denied' ? gitChatTools.slice(0, 1) : gitChatTools;
  for (const [index, tool] of names.entries()) {
    const card = page.getByRole('region', { name: 'Git operation approval', exact: true }).last();
    await expect(
      card.getByRole('button', { name: 'Approve Git operation', exact: true }),
    ).toBeEnabled();
    const pending = await api<ApprovalRequest[]>(
      `approval-requests?sessionId=${sessionId}&status=pending`,
    );
    expect(pending).toHaveLength(1);
    const approval = pending[0]!;
    expect(approval.toolName).toBe(tool);
    const preview = JSON.parse(approval.argsJson).gitDeliveryReceipt as GitDeliveryReceipt;
    expect(preview).toMatchObject({ projectId, sessionId, source: 'chat', state: 'prepared' });
    await expect(card).toContainText(preview.id);
    expect(
      await api<GitDeliveryReceipt>(`projects/${projectId}/git/delivery/${preview.id}`),
    ).toMatchObject({ state: 'prepared' });
    if (index === 0) {
      expect(boundary.git('diff', '--cached', '--name-only')).toBe('');
      await options.waiting?.();
    }
    if (tool === 'sys_git_commit') {
      await expect(card).toContainText(gitChatCommit);
      expect(boundary.git('rev-parse', 'HEAD')).toBe(initialHead);
    }
    if (tool === 'sys_git_push')
      expect(boundary.remote('for-each-ref', '--format=%(refname)', `refs/heads/${branch}`)).toBe(
        '',
      );
    if (tool === 'sys_git_create_pull_request') {
      await options.beforePr?.();
      await expect(card).toContainText(gitChatTitle);
      await expect(card).toContainText(gitChatBody);
      await expect(card).toContainText('staging');
      expect((await boundary.ledger()).pullRequests).toHaveLength(0);
      if (scenario === 'unknown') await boundary.loseNextCreateResponse();
    }
    await card
      .getByRole('button', {
        name: scenario === 'denied' ? 'Deny Git operation' : 'Approve Git operation',
        exact: true,
      })
      .click();
    const expected =
      scenario === 'denied'
        ? 'denied'
        : scenario === 'unknown' && index === 3
          ? 'unknown'
          : 'succeeded';
    await expect
      .poll(
        async () =>
          (await api<GitDeliveryReceipt>(`projects/${projectId}/git/delivery/${preview.id}`)).state,
      )
      .toBe(expected);
    operations.push(
      await api<GitDeliveryReceipt>(`projects/${projectId}/git/delivery/${preview.id}`),
    );
  }
  if (scenario === 'denied') {
    await expect(
      page
        .getByText(
          '[APPROVAL_REJECTED] Human rejected tool execution. Git action denied; no change made.',
          { exact: true },
        )
        .last(),
    ).toBeVisible();
    expect(boundary.git('rev-parse', 'HEAD')).toBe(initialHead);
    expect(boundary.git('diff', '--cached', '--name-only')).toBe('');
    expect((await boundary.ledger()).pullRequests).toHaveLength(0);
  } else {
    expect(boundary.git('log', '-1', '--format=%B')).toBe(gitChatCommit);
    expect(boundary.git('rev-list', '--count', `${initialHead}..HEAD`)).toBe('1');
    expect(boundary.remote('rev-parse', `refs/heads/${branch}`)).toBe(
      boundary.git('rev-parse', 'HEAD'),
    );
    expect(boundary.remote('rev-parse', 'refs/heads/staging')).toBe(protectedHead);
    expect((await boundary.ledger()).pullRequests).toEqual([
      expect.objectContaining({
        title: gitChatTitle,
        body: gitChatBody,
        isDraft: true,
        baseRefName: 'staging',
        headRefName: branch,
      }),
    ]);
  }
  await expect(input).toBeEnabled();
  if (options.restartBeforeRestore) {
    page = await options.restartBeforeRestore();
    input = page.getByPlaceholder('Ask about this Project...');
  }
  await page.reload();
  await expect(page.getByText('/init', { exact: true })).toBeVisible();
  await expect(input).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Show activity and Git panel', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Git & GitHub' })).toHaveCount(0);
  const restored = page.getByRole('region', { name: 'Git operation approval', exact: true });
  await expect(restored).toHaveCount(operations.length);
  const last = restored.filter({ hasText: operations.at(-1)!.id });
  if (scenario === 'unknown') {
    await expect(last).toContainText('Outcome unknown');
    await expect(last.getByRole('button', { name: 'Approve Git operation' })).toHaveCount(0);
    await last.getByRole('button', { name: 'Check actual outcome' }).click();
    await expect(last).toContainText('Status: succeeded');
  } else
    await expect(last).toContainText(`Status: ${scenario === 'denied' ? 'denied' : 'succeeded'}`);
  await last.getByLabel(/Delete this retained record/).check();
  await last.getByRole('button', { name: 'Delete closed record' }).click();
  await expect(last).toHaveCount(0);
  const retained = await api<{
    approvals: ApprovalRequest[];
    recoveryReceipts: GitDeliveryReceipt[];
  }>(`approval-requests/git-delivery?sessionId=${sessionId}`);
  expect(
    retained.approvals.some(
      (a) => JSON.parse(a.argsJson).gitDeliveryReceipt.id === operations.at(-1)!.id,
    ),
  ).toBe(false);
  if (scenario !== 'denied')
    expect(
      (await boundary.ledger()).calls.filter(
        ({ args }) => args[0] === 'pr' && args[1] === 'create',
      ),
    ).toHaveLength(1);
  return {
    initialHead,
    protectedHead,
    head: boundary.git('rev-parse', 'HEAD'),
    operations,
    retained,
    hiddenRail: true,
    reloadRecovered: true,
  };
}

/** Fixture-owned cancelled records exercise the recovery-only scroller, not execution authority. */
export async function assertGitRecoveryReachable(page: Page, receiptIds: string[]) {
  await page.reload();
  await expect(page.getByText('/init', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Show activity and Git panel', exact: true }),
  ).toBeVisible();
  const first = page
    .getByRole('region', { name: 'Retained Git outcome', exact: true })
    .filter({ hasText: receiptIds[0]! });
  const last = page
    .getByRole('region', { name: 'Retained Git outcome', exact: true })
    .filter({ hasText: receiptIds.at(-1)! });
  await first.scrollIntoViewIfNeeded();
  await expect(first).toBeInViewport();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  const input = page.getByPlaceholder('Ask about this Project...');
  await expect(input).toBeInViewport();
  await expect(input).toBeEnabled();
  await expect(last.getByRole('button', { name: 'Approve Git operation' })).toHaveCount(0);
  await last.getByLabel(/Delete this retained record/).check();
  await last.getByRole('button', { name: 'Delete closed record' }).click();
  await expect(last).toHaveCount(0);
  await expect(input).toBeInViewport();
}
