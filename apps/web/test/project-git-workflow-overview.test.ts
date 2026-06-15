import type {
  ProjectBranchListResult,
  ProjectGitChecksResult,
  ProjectGitPullRequestsResult,
  ProjectGitStatusResult,
} from '@agent-platform/contracts';
import { describe, expect, it } from 'vitest';

import {
  defaultRepositoryName,
  deriveGitPullRequestCreateState,
  deriveGitPublishState,
  deriveGitWorkflowOverview,
  deriveGitWorkflowTabs,
  derivePullRequestBaseBranchOptions,
  recommendPullRequestBaseBranch,
  resolveGitWorkflowActiveTab,
  resolvePullRequestBaseBranchValue,
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
      primaryAction: { label: 'Review publish options', tab: 'push' },
    });
  });

  it('moves ahead branches to push and then pull request creation', () => {
    expect(
      deriveGitWorkflowOverview({
        status: status({ ahead: 2 }),
      }),
    ).toMatchObject({
      title: 'Push local commits',
      primaryAction: { label: 'Push commits', tab: 'push' },
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

  it('prioritizes pulling remote commits before pushing divergent branches', () => {
    expect(
      deriveGitWorkflowOverview({
        status: status({ ahead: 2, behind: 1 }),
      }),
    ).toMatchObject({
      title: 'Pull remote changes',
      primaryAction: { label: 'Review pull options', tab: 'push' },
    });
  });

  it('keeps dirty behind branches in local change review before pulling', () => {
    expect(
      deriveGitWorkflowOverview({
        status: status({
          clean: false,
          behind: 1,
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
        }),
      }),
    ).toMatchObject({
      title: 'Review local changes',
      primaryAction: { label: 'Review changes', tab: 'changes' },
    });
  });

  it('sends committed local-only repositories to the GitHub connection workflow', () => {
    expect(
      deriveGitWorkflowOverview({
        status: status({
          remoteUrl: undefined,
          githubRemoteDetected: false,
          upstreamBranch: undefined,
          upstreamState: 'none',
          recentCommit: {
            sha: '752fe8b',
            subject: 'First commit',
          },
        }),
      }),
    ).toMatchObject({
      title: 'Connect this project to GitHub',
      tone: 'warning',
      primaryAction: { label: 'Create or connect repository', tab: 'push' },
    });
  });

  it('prioritizes merge conflict resolution over every other Git workflow step', () => {
    expect(
      deriveGitWorkflowOverview({
        status: status({
          clean: false,
          ahead: 2,
          behind: 1,
          workingTree: {
            total: 1,
            staged: 0,
            unstaged: 0,
            added: 0,
            modified: 1,
            deleted: 0,
            renamed: 0,
            untracked: 0,
            conflicts: 1,
          },
        }),
      }),
    ).toMatchObject({
      title: 'Resolve merge conflicts',
      tone: 'danger',
      primaryAction: { label: 'Resolve conflicts', tab: 'push' },
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

describe('defaultRepositoryName', () => {
  it('normalizes repository names without regex replacement', () => {
    expect(defaultRepositoryName('  My App / Prototype  ')).toBe('my-app-prototype');
    expect(defaultRepositoryName('...agent_platform---web...')).toBe('...agent_platform---web...');
    expect(defaultRepositoryName('---')).toBe('new-project');
    expect(defaultRepositoryName(undefined)).toBe('new-project');
  });
});

describe('deriveGitWorkflowTabs', () => {
  it('keeps only Overview for clean primary branches without workflow work', () => {
    expect(deriveGitWorkflowTabs({ status: cleanStatus })).toEqual([
      { id: 'overview', label: 'Overview' },
    ]);
  });

  it('shows Changes for unstaged work and Commit once files are staged', () => {
    expect(
      deriveGitWorkflowTabs({
        status: status({
          clean: false,
          workingTree: {
            total: 2,
            staged: 0,
            unstaged: 2,
            added: 1,
            modified: 1,
            deleted: 0,
            renamed: 0,
            untracked: 0,
            conflicts: 0,
          },
        }),
      }),
    ).toEqual([
      { id: 'overview', label: 'Overview' },
      { id: 'changes', label: 'Changes', badge: 2 },
    ]);

    expect(
      deriveGitWorkflowTabs({
        status: status({
          clean: false,
          workingTree: {
            total: 2,
            staged: 1,
            unstaged: 1,
            added: 1,
            modified: 1,
            deleted: 0,
            renamed: 0,
            untracked: 0,
            conflicts: 0,
          },
        }),
      }),
    ).toEqual([
      { id: 'overview', label: 'Overview' },
      { id: 'changes', label: 'Changes', badge: 2 },
      { id: 'commit', label: 'Commit', badge: 1 },
    ]);
  });

  it('shows Publish or Push when a clean branch needs remote publication', () => {
    expect(
      deriveGitWorkflowTabs({
        status: status({ upstreamBranch: undefined, upstreamState: 'none' }),
      }),
    ).toEqual([
      { id: 'overview', label: 'Overview' },
      { id: 'push', label: 'Publish' },
    ]);

    expect(
      deriveGitWorkflowTabs({
        status: status({ ahead: 2 }),
      }),
    ).toEqual([
      { id: 'overview', label: 'Overview' },
      { id: 'push', label: 'Push', badge: 2 },
    ]);

    expect(
      deriveGitWorkflowTabs({
        status: status({ ahead: 2, behind: 1 }),
      }),
    ).toEqual([
      { id: 'overview', label: 'Overview' },
      { id: 'push', label: 'Pull', badge: 1 },
    ]);

    expect(
      deriveGitWorkflowTabs({
        status: status({
          clean: false,
          ahead: 2,
          behind: 1,
          workingTree: {
            total: 1,
            staged: 0,
            unstaged: 0,
            added: 0,
            modified: 1,
            deleted: 0,
            renamed: 0,
            untracked: 0,
            conflicts: 1,
          },
        }),
      }),
    ).toEqual([
      { id: 'overview', label: 'Overview' },
      { id: 'changes', label: 'Changes', badge: 1 },
      { id: 'push', label: 'Resolve', badge: 1 },
    ]);
  });

  it('does not keep the Commit tab visible after a successful commit clears staged files', () => {
    expect(
      deriveGitWorkflowTabs({
        status: status({
          clean: true,
          ahead: 1,
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
        }),
        commitSuccess: 'Committed 8440042: chore: test node server first commit',
      }),
    ).toEqual([
      { id: 'overview', label: 'Overview' },
      { id: 'push', label: 'Push', badge: 1 },
    ]);
  });

  it('uses Publish tab copy that does not claim a branch was pushed before pushing', () => {
    expect(
      deriveGitWorkflowTabs({
        status: status({
          clean: true,
          remoteUrl: undefined,
          githubRemoteDetected: false,
          upstreamBranch: undefined,
          upstreamState: 'none',
          ahead: 1,
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
        }),
        commitSuccess: 'Committed 8440042: chore: test node server first commit',
      }),
    ).toEqual([
      { id: 'overview', label: 'Overview' },
      { id: 'push', label: 'Publish', badge: 1 },
    ]);

    expect(
      deriveGitPublishState({
        status: status({
          remoteUrl: undefined,
          githubRemoteDetected: false,
          upstreamBranch: undefined,
          upstreamState: 'none',
        }),
        commitSuccess: 'Committed 8440042: chore: test node server first commit',
        pushSuccess: null,
      }),
    ).toMatchObject({
      title: 'Connect this project to GitHub',
      actionLabel: undefined,
      statusLabel: 'Not connected',
      pushed: false,
    });

    expect(
      deriveGitPublishState({
        status: status({
          upstreamBranch: undefined,
          upstreamState: 'none',
          ahead: 1,
        }),
        commitSuccess: null,
        pushSuccess: null,
      }),
    ).toMatchObject({
      title: 'Publish this branch',
      actionLabel: 'Publish branch',
      statusLabel: 'Ready to publish',
      pushed: false,
    });
  });

  it('uses Publish tab state that disables push until divergent branches are pulled', () => {
    expect(
      deriveGitPublishState({
        status: status({ ahead: 2, behind: 1 }),
        commitSuccess: null,
        pushSuccess: null,
      }),
    ).toMatchObject({
      title: 'Pull remote changes',
      statusLabel: 'Pull required',
      actionLabel: 'Pull remote changes',
      canPublish: false,
      canPull: true,
      pushed: false,
    });
  });

  it('uses Publish tab state that disables push until conflicts are resolved', () => {
    expect(
      deriveGitPublishState({
        status: status({
          clean: false,
          ahead: 2,
          behind: 1,
          workingTree: {
            total: 1,
            staged: 0,
            unstaged: 0,
            added: 0,
            modified: 1,
            deleted: 0,
            renamed: 0,
            untracked: 0,
            conflicts: 1,
          },
        }),
        commitSuccess: null,
        pushSuccess: null,
      }),
    ).toMatchObject({
      title: 'Resolve merge conflicts',
      actionLabel: 'Resolve conflicts',
      canPublish: false,
      canPull: false,
      pushed: false,
    });
  });

  it('shows PRs and Checks only when GitHub context is useful', () => {
    const pullRequests: ProjectGitPullRequestsResult = {
      available: true,
      repositoryName: 'app',
      remoteUrl: 'git@github.com:user/app.git',
      currentBranch: 'feature/work',
      githubRemoteDetected: true,
      ghAvailable: true,
      authenticated: true,
      checkedAt: '2026-05-19T15:00:00.000Z',
      pullRequests: [
        {
          number: 42,
          title: 'Feature work',
          state: 'open',
          url: 'https://github.com/user/app/pull/42',
          headRefName: 'feature/work',
          baseRefName: 'main',
          isDraft: false,
          currentBranch: true,
          checks: {
            total: 1,
            success: 0,
            failure: 0,
            pending: 1,
            unknown: 0,
          },
        },
      ],
    };
    const checks: ProjectGitChecksResult = {
      available: true,
      repositoryName: 'app',
      remoteUrl: 'git@github.com:user/app.git',
      currentBranch: 'feature/work',
      headSha: 'abc123',
      scope: 'pull_request',
      pullRequestNumber: 42,
      githubRemoteDetected: true,
      ghAvailable: true,
      authenticated: true,
      checkedAt: '2026-05-19T15:00:00.000Z',
      summary: {
        total: 1,
        success: 0,
        failure: 0,
        inProgress: 1,
        queued: 0,
        cancelled: 0,
        skipped: 0,
        unknown: 0,
      },
      checks: [],
    };

    expect(
      deriveGitWorkflowTabs({
        status: status({
          currentBranch: 'feature/work',
          upstreamBranch: 'origin/feature/work',
          baseBranch: 'main',
        }),
        pullRequests,
        checks,
      }),
    ).toEqual([
      { id: 'overview', label: 'Overview' },
      { id: 'prs', label: 'PRs', badge: 1 },
      { id: 'checks', label: 'Checks', badge: 1 },
    ]);
  });
});

describe('deriveGitPullRequestCreateState', () => {
  it('builds editable pull request base branch options without the current branch', () => {
    const branches: ProjectBranchListResult = {
      currentBranch: 'feature/work',
      clean: true,
      branches: [
        {
          name: 'main',
          current: false,
          upstreamState: 'active',
        },
        {
          name: 'staging',
          current: false,
          upstreamState: 'active',
        },
        {
          name: 'feature/work',
          current: true,
          upstreamState: 'active',
        },
      ],
    };

    expect(
      derivePullRequestBaseBranchOptions({
        status: status({
          currentBranch: 'feature/work',
          upstreamBranch: 'origin/feature/work',
          baseBranch: 'develop',
        }),
        branches,
      }),
    ).toEqual(['develop', 'staging', 'main']);
  });

  it('resolves the selected pull request base branch before using the fallback', () => {
    expect(
      resolvePullRequestBaseBranchValue({
        selectedBaseBranch: ' staging ',
        fallbackBaseBranch: 'main',
      }),
    ).toBe('staging');

    expect(
      resolvePullRequestBaseBranchValue({
        selectedBaseBranch: ' ',
        fallbackBaseBranch: 'main',
      }),
    ).toBe('main');
  });

  it('recommends staging as the pull request target when available', () => {
    expect(
      recommendPullRequestBaseBranch({
        fallbackBaseBranch: 'main',
        options: ['main', 'staging', 'develop'],
      }),
    ).toBe('staging');

    expect(
      recommendPullRequestBaseBranch({
        fallbackBaseBranch: 'main',
        options: ['main', 'develop'],
      }),
    ).toBe('main');
  });

  it('allows creating a pull request for a published feature branch without an open PR', () => {
    expect(
      deriveGitPullRequestCreateState({
        status: status({
          currentBranch: 'feature/work',
          upstreamBranch: 'origin/feature/work',
          baseBranch: 'main',
        }),
        pullRequests: {
          available: true,
          repositoryName: 'app',
          remoteUrl: 'git@github.com:user/app.git',
          currentBranch: 'feature/work',
          githubRemoteDetected: true,
          ghAvailable: true,
          authenticated: true,
          pullRequests: [],
          checkedAt: '2026-05-22T10:00:00.000Z',
        },
      }),
    ).toMatchObject({
      canCreate: true,
      defaultTitle: 'feature/work',
      baseBranch: 'main',
      repositoryUrl: 'https://github.com/user/app',
    });
  });

  it('does not offer create PR for primary branches or branches with a current PR', () => {
    expect(
      deriveGitPullRequestCreateState({
        status: cleanStatus,
        pullRequests: {
          available: true,
          repositoryName: 'app',
          remoteUrl: 'git@github.com:user/app.git',
          currentBranch: 'main',
          githubRemoteDetected: true,
          ghAvailable: true,
          authenticated: true,
          pullRequests: [],
          checkedAt: '2026-05-22T10:00:00.000Z',
        },
      }).canCreate,
    ).toBe(false);

    expect(
      deriveGitPullRequestCreateState({
        status: status({
          currentBranch: 'feature/work',
          upstreamBranch: 'origin/feature/work',
          baseBranch: 'main',
        }),
        pullRequests: {
          available: true,
          repositoryName: 'app',
          remoteUrl: 'git@github.com:user/app.git',
          currentBranch: 'feature/work',
          githubRemoteDetected: true,
          ghAvailable: true,
          authenticated: true,
          checkedAt: '2026-05-22T10:00:00.000Z',
          pullRequests: [
            {
              number: 7,
              title: 'Feature work',
              url: 'https://github.com/user/app/pull/7',
              state: 'open',
              isDraft: false,
              authorLogin: 'user',
              headRefName: 'feature/work',
              baseRefName: 'main',
              currentBranch: true,
              reviewDecision: 'unknown',
              checks: {
                total: 0,
                success: 0,
                failure: 0,
                pending: 0,
                unknown: 0,
              },
            },
          ],
        },
      }).canCreate,
    ).toBe(false);
  });
});

describe('resolveGitWorkflowActiveTab', () => {
  it('preserves the intended publish tab when the commit tab disappears after refresh', () => {
    expect(
      resolveGitWorkflowActiveTab({
        activeTab: 'commit',
        preferredTab: 'push',
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'push', label: 'Publish', badge: 1 },
        ],
      }),
    ).toBe('push');
  });

  it('falls back to Overview only when the current and preferred tabs are unavailable', () => {
    expect(
      resolveGitWorkflowActiveTab({
        activeTab: 'commit',
        preferredTab: 'push',
        tabs: [{ id: 'overview', label: 'Overview' }],
      }),
    ).toBe('overview');
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
