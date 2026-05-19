import type {
  ProjectGitChecksResult,
  ProjectGitPullRequestsResult,
  ProjectGitStatusResult,
} from '@agent-platform/contracts';
import { describe, expect, it } from 'vitest';

import {
  deriveGitWorkflowOverview,
  shouldRenderGitStatusLoader,
  shouldRequestProjectGitDiff,
} from '@/components/project/project-git-github-panel';

const cleanStatus: ProjectGitStatusResult = {
  available: true,
  repositoryName: 'app',
  remoteUrl: 'git@github.com:user/app.git',
  currentBranch: 'main',
  upstreamBranch: 'origin/main',
  upstreamState: 'active',
  baseBranch: 'main',
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

function status(overrides: Partial<ProjectGitStatusResult>): ProjectGitStatusResult {
  return {
    ...cleanStatus,
    ...overrides,
    workingTree: {
      ...cleanStatus.workingTree,
      ...overrides.workingTree,
    },
  };
}

describe('deriveGitWorkflowOverview', () => {
  it('prioritizes changed files and sends users to the Changes tab', () => {
    expect(
      deriveGitWorkflowOverview({
        status: status({
          clean: false,
          workingTree: {
            total: 3,
            staged: 0,
            unstaged: 2,
            added: 1,
            modified: 2,
            deleted: 0,
            renamed: 0,
            untracked: 0,
            conflicts: 0,
          },
        }),
      }),
    ).toMatchObject({
      title: 'Review local changes',
      primaryAction: { label: 'Review changes', tab: 'changes' },
    });
  });

  it('labels missing upstream as a publish workflow without treating it as synced', () => {
    expect(
      deriveGitWorkflowOverview({
        status: status({
          currentBranch: 'fix/trivy-version-pin',
          upstreamBranch: 'origin/fix/trivy-version-pin',
          upstreamState: 'missing',
        }),
      }),
    ).toMatchObject({
      title: 'Publish this branch',
      tone: 'warning',
      primaryAction: { label: 'Review publish options', tab: 'commits' },
    });
  });

  it('moves ahead branches to push and then pull request creation', () => {
    expect(
      deriveGitWorkflowOverview({
        status: status({ ahead: 2 }),
      }),
    ).toMatchObject({
      title: 'Push local commits',
      primaryAction: { label: 'Push commits', tab: 'commits' },
    });

    const pullRequests: ProjectGitPullRequestsResult = {
      available: true,
      repositoryName: 'app',
      remoteUrl: 'git@github.com:user/app.git',
      currentBranch: 'main',
      githubRemoteDetected: true,
      ghAvailable: true,
      authenticated: true,
      checkedAt: '2026-05-19T15:00:00.000Z',
      pullRequests: [],
    };

    expect(
      deriveGitWorkflowOverview({
        status: status({
          currentBranch: 'task/pushed',
          upstreamBranch: 'origin/task/pushed',
          baseBranch: 'task/pushed',
        }),
        pullRequests,
      }),
    ).toMatchObject({
      title: 'Create a pull request',
      primaryAction: { label: 'Review pull request options', tab: 'prs' },
    });
  });

  it('surfaces pull request checks before generic clean synced state', () => {
    const pullRequests: ProjectGitPullRequestsResult = {
      available: true,
      repositoryName: 'app',
      remoteUrl: 'git@github.com:user/app.git',
      currentBranch: 'main',
      githubRemoteDetected: true,
      ghAvailable: true,
      authenticated: true,
      checkedAt: '2026-05-19T15:00:00.000Z',
      pullRequests: [
        {
          number: 42,
          title: 'Fix Trivy version pin',
          state: 'open',
          url: 'https://github.com/user/app/pull/42',
          headRefName: 'main',
          baseRefName: 'main',
          isDraft: false,
          currentBranch: true,
          checks: {
            total: 3,
            success: 2,
            failure: 1,
            pending: 0,
            unknown: 0,
          },
        },
      ],
    };
    const checks: ProjectGitChecksResult = {
      available: true,
      repositoryName: 'app',
      remoteUrl: 'git@github.com:user/app.git',
      currentBranch: 'main',
      headSha: 'abc123',
      scope: 'pull_request',
      pullRequestNumber: 42,
      githubRemoteDetected: true,
      ghAvailable: true,
      authenticated: true,
      checkedAt: '2026-05-19T15:00:00.000Z',
      summary: {
        total: 3,
        success: 2,
        failure: 1,
        inProgress: 0,
        queued: 0,
        cancelled: 0,
        skipped: 0,
        unknown: 0,
      },
      checks: [],
    };

    expect(
      deriveGitWorkflowOverview({
        status: cleanStatus,
        pullRequests,
        checks,
      }),
    ).toMatchObject({
      title: 'Pull request checks need attention',
      primaryAction: { label: 'Review checks', tab: 'checks' },
    });
  });
});

describe('Git panel loading and diff guards', () => {
  it('shows the Git status loader until the current Project status has loaded', () => {
    expect(
      shouldRenderGitStatusLoader({
        projectId: 'project-a',
        statusProjectId: null,
        loading: false,
        error: null,
      }),
    ).toBe(true);

    expect(
      shouldRenderGitStatusLoader({
        projectId: 'project-a',
        statusProjectId: 'project-b',
        loading: false,
        error: null,
      }),
    ).toBe(true);

    expect(
      shouldRenderGitStatusLoader({
        projectId: 'project-a',
        statusProjectId: 'project-a',
        loading: false,
        error: null,
      }),
    ).toBe(false);
  });

  it('does not request a diff for a stale selected file after Project changes reload', () => {
    expect(
      shouldRequestProjectGitDiff({
        projectId: 'project-a',
        activeTab: 'changes',
        selectedChange: { path: 'old-project-file.ts' },
        changesProjectId: 'project-a',
        changes: {
          available: true,
          clean: false,
          workingTree: {
            total: 1,
            staged: 0,
            unstaged: 1,
            added: 0,
            modified: 1,
            deleted: 0,
            renamed: 0,
            untracked: 0,
            conflicts: 0,
          },
          files: [
            {
              path: 'README.md',
              status: 'modified',
              indexStatus: ' ',
              worktreeStatus: 'M',
              staged: false,
              unstaged: true,
            },
          ],
        },
      }),
    ).toBe(false);

    expect(
      shouldRequestProjectGitDiff({
        projectId: 'project-a',
        activeTab: 'changes',
        selectedChange: { path: 'README.md' },
        changesProjectId: 'project-a',
        changes: {
          available: true,
          clean: false,
          workingTree: {
            total: 1,
            staged: 0,
            unstaged: 1,
            added: 0,
            modified: 1,
            deleted: 0,
            renamed: 0,
            untracked: 0,
            conflicts: 0,
          },
          files: [
            {
              path: 'README.md',
              status: 'modified',
              indexStatus: ' ',
              worktreeStatus: 'M',
              staged: false,
              unstaged: true,
            },
          ],
        },
      }),
    ).toBe(true);
  });
});
