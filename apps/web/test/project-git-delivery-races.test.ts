// @vitest-environment jsdom
import React, { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GitDeliveryReceipt, ProjectGitStatusResult } from '@agent-platform/contracts';
import { ProjectGitHubPanel } from '@/components/project/project-git-github-panel';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/apiClient', async (original) => ({
  ...(await original<object>()),
  apiGet: transport.get,
  apiPost: transport.post,
}));
const receipt: GitDeliveryReceipt = {
  id: '7ef19449-8403-4d88-b71f-101933083849',
  projectId: 'first',
  source: 'panel',
  action: { kind: 'push', mode: 'push' },
  state: 'prepared',
  createdAtMs: 1,
  updatedAtMs: 1,
  expiresAtMs: Date.now() + 60_000,
  review: {
    branch: 'feature/first',
    head: 'a'.repeat(40),
    indexTree: 'b'.repeat(40),
    paths: [],
    remoteRef: 'refs/heads/feature/first',
  },
};
function status(projectId: string): ProjectGitStatusResult {
  return {
    available: true,
    repositoryName: projectId,
    currentBranch: `feature/${projectId}`,
    remoteUrl: 'git@github.com:fixture/project.git',
    upstreamBranch: `origin/feature/${projectId}`,
    upstreamState: 'active',
    ahead: 0,
    behind: 0,
    clean: true,
    githubRemoteDetected: true,
    workingTree: {
      total: 0,
      staged: 0,
      unstaged: 0,
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
      untracked: 0,
      conflicts: 0,
    },
  };
}
let container: HTMLDivElement;
let root: Root;
async function mount(projectId: string) {
  await act(async () =>
    root.render(createElement(ProjectGitHubPanel, { projectId, embedded: true })),
  );
}
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  transport.get.mockReset();
  transport.post.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it('ignores old Project refresh completions and does not start old follow-up reads after a switch', async () => {
  let holdFirst = false;
  const held: {
    path: string;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }[] = [];
  function result(path: string) {
    const projectId = path.includes('/first/') ? 'first' : 'second';
    if (path.endsWith('/git/status')) return status(projectId);
    if (path.endsWith('/git/delivery/index')) return { paths: [] };
    if (path.endsWith('/git/delivery'))
      return { operations: projectId === 'first' ? [receipt] : [] };
    if (path.endsWith('/git/changes')) return { files: [], available: true };
    if (path.endsWith('/git/checks'))
      return { available: false, checks: [], reason: `${projectId} checks unavailable` };
    if (path.endsWith('/github/pull-requests'))
      return { available: false, pullRequests: [], reason: `${projectId} PRs unavailable` };
    if (path.endsWith('/branches')) return { branches: [] };
    throw new Error(`Unexpected read ${path}`);
  }
  transport.get.mockImplementation((path: string) => {
    if (holdFirst && path.includes('/first/') && !path.includes('/delivery')) {
      return new Promise((resolve, reject) => held.push({ path, resolve, reject }));
    }
    return Promise.resolve(result(path));
  });
  transport.post.mockResolvedValue({
    ...receipt,
    state: 'succeeded',
    result: { remoteRef: receipt.review.remoteRef },
  });
  await mount('first');
  const confirm = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === 'Confirm Git operation',
  );
  expect(confirm).toBeDefined();
  holdFirst = true;
  await act(async () => confirm!.click());
  expect(held.some(({ path }) => path.endsWith('/git/status'))).toBe(true);
  await mount('second');
  expect(container.textContent).toContain('feature/second');
  const oldCallsAtSwitch = transport.get.mock.calls.filter(([path]) =>
    path.includes('/first/'),
  ).length;
  await act(async () => {
    for (const pending of held) {
      if (pending.path.endsWith('/git/checks')) pending.reject(new Error('old project failure'));
      else pending.resolve(result(pending.path));
    }
  });
  expect(transport.get.mock.calls.filter(([path]) => path.includes('/first/'))).toHaveLength(
    oldCallsAtSwitch,
  );
  expect(container.textContent).toContain('feature/second');
  expect(container.textContent).not.toContain('feature/first');
  expect(container.textContent).not.toContain('old project failure');
  expect(container.textContent).not.toContain('Failed to load checks');
});
