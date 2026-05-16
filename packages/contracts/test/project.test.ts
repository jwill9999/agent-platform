import { describe, expect, it } from 'vitest';

import {
  ProjectModeSchema,
  ProjectBranchCheckoutBodySchema,
  ProjectGitChecksResultSchema,
  ProjectGitStatusResultSchema,
  ProjectBranchListResultSchema,
  ProjectOpenBodySchema,
  ProjectWorkspaceBindingSchema,
  ProjectCapabilityStateSchema,
  ProjectOnboardingStateSchema,
  getDefaultAgentProfileForMode,
  getProjectAccessPolicy,
} from '../src/project.js';

describe('Project mode and workspace binding contracts', () => {
  it('uses coding by default for Project mode and personal assistant by default for Chat mode', () => {
    expect(ProjectModeSchema.options).toEqual(['project', 'chat']);
    expect(getDefaultAgentProfileForMode('project')).toBe('coding');
    expect(getDefaultAgentProfileForMode('chat')).toBe('personal_assistant');
  });

  it('validates backend project open requests', () => {
    expect(ProjectOpenBodySchema.parse({ path: '/workspace' })).toEqual({ path: '/workspace' });
    expect(ProjectOpenBodySchema.parse({ path: '/workspace/app', name: 'App' })).toEqual({
      path: '/workspace/app',
      name: 'App',
    });

    expect(() => ProjectOpenBodySchema.parse({ path: '' })).toThrow();
  });

  it('validates Project branch list and checkout contracts', () => {
    expect(
      ProjectBranchListResultSchema.parse({
        currentBranch: 'main',
        clean: true,
        branches: [
          { name: 'main', current: true },
          { name: 'feature/chat-input-branch', current: false },
        ],
      }),
    ).toEqual({
      currentBranch: 'main',
      clean: true,
      branches: [
        { name: 'main', current: true },
        { name: 'feature/chat-input-branch', current: false },
      ],
    });

    expect(ProjectBranchCheckoutBodySchema.parse({ branch: 'feature/chat-input-branch' })).toEqual({
      branch: 'feature/chat-input-branch',
    });
    expect(() => ProjectBranchCheckoutBodySchema.parse({ branch: '-bad' })).toThrow();
    expect(() => ProjectBranchCheckoutBodySchema.parse({ branch: '../bad' })).toThrow();
  });

  it('validates Project Git status contracts', () => {
    expect(
      ProjectGitStatusResultSchema.parse({
        available: true,
        repositoryName: 'agent-platform',
        remoteUrl: 'https://github.com/jwill9999/agent-platform.git',
        currentBranch: 'task/git-panel',
        upstreamBranch: 'origin/task/git-panel',
        baseBranch: 'task/git-panel',
        headSha: 'abc123',
        ahead: 2,
        behind: 1,
        clean: false,
        githubRemoteDetected: true,
        workingTree: {
          total: 3,
          staged: 1,
          unstaged: 1,
          added: 1,
          modified: 1,
          deleted: 0,
          renamed: 0,
          untracked: 1,
          conflicts: 0,
        },
        recentCommit: {
          sha: 'abc123',
          subject: 'Add Git panel',
          authorName: 'Test User',
          committedAt: '2026-05-16T15:00:00+00:00',
        },
      }),
    ).toMatchObject({
      available: true,
      ahead: 2,
      behind: 1,
      githubRemoteDetected: true,
    });

    expect(
      ProjectGitStatusResultSchema.parse({
        available: false,
        reason: 'Project is not a Git repository.',
        clean: true,
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
    ).toMatchObject({ available: false, clean: true });
  });

  it('validates Project Git checks contracts', () => {
    expect(
      ProjectGitChecksResultSchema.parse({
        available: true,
        repositoryName: 'agent-platform',
        remoteUrl: 'git@github.com:jwill9999/agent-platform.git',
        currentBranch: 'task/checks',
        headSha: 'abc123',
        githubRemoteDetected: true,
        ghAvailable: true,
        authenticated: true,
        checkedAt: '2026-05-16T16:00:00.000Z',
        summary: {
          total: 2,
          success: 1,
          failure: 1,
          inProgress: 0,
          queued: 0,
          cancelled: 0,
          skipped: 0,
          unknown: 0,
        },
        checks: [
          {
            id: '123',
            name: 'CI / build',
            workflowName: 'CI',
            displayTitle: 'build',
            status: 'completed',
            conclusion: 'success',
            event: 'push',
            headSha: 'abc123',
            url: 'https://github.com/jwill9999/agent-platform/actions/runs/123',
            startedAt: '2026-05-16T15:55:00.000Z',
            completedAt: '2026-05-16T15:58:00.000Z',
          },
          {
            id: '124',
            name: 'Tests',
            status: 'completed',
            conclusion: 'failure',
          },
        ],
      }),
    ).toMatchObject({
      available: true,
      githubRemoteDetected: true,
      summary: { total: 2, success: 1, failure: 1 },
    });

    expect(
      ProjectGitChecksResultSchema.parse({
        available: false,
        reason: 'GitHub CLI is not authenticated.',
        githubRemoteDetected: true,
        ghAvailable: true,
        authenticated: false,
        checkedAt: '2026-05-16T16:00:00.000Z',
        summary: {
          total: 0,
          success: 0,
          failure: 0,
          inProgress: 0,
          queued: 0,
          cancelled: 0,
          skipped: 0,
          unknown: 0,
        },
        checks: [],
      }),
    ).toMatchObject({ available: false, authenticated: false });
  });

  it('captures backend-accessible Project working-tree metadata without conflating chat workspace', () => {
    const binding = ProjectWorkspaceBindingSchema.parse({
      projectId: 'project-1',
      displayName: 'Agent Platform',
      projectRoot: '/workspace',
      repositoryRoot: '/workspace',
      activeBranch: 'task/agent-platform-project-workspaces.1',
      activeWorktreeId: 'agent-platform:task/agent-platform-project-workspaces.1',
      subprojectScope: {
        path: 'apps/web',
        packageName: '@agent-platform/web',
      },
      capabilityState: 'backend_accessible',
      onboardingState: 'approved',
      defaultAgentProfile: 'coding',
      instructionFiles: [
        {
          scope: 'root',
          path: 'AGENTS.md',
        },
        {
          scope: 'nested',
          path: 'apps/web/AGENTS.md',
          appliesToPath: 'apps/web',
        },
      ],
    });

    expect(binding.projectRoot).toBe('/workspace');
    expect(binding.repositoryRoot).toBe('/workspace');
    expect(binding.subprojectScope?.path).toBe('apps/web');
    expect(binding.instructionFiles.map((file) => file.scope)).toEqual(['root', 'nested']);
  });

  it('rejects unsafe or ambiguous project-relative instruction and subproject paths', () => {
    const baseBinding = {
      projectId: 'project-1',
      displayName: 'Agent Platform',
      projectRoot: '/workspace',
      repositoryRoot: '/workspace',
      capabilityState: 'backend_accessible',
      onboardingState: 'approved',
      defaultAgentProfile: 'coding',
    };

    for (const path of [
      '/apps/web',
      '../apps/web',
      'apps/../web',
      'apps//web',
      String.raw`apps\web`,
      ' apps/web',
      'apps/web ',
      'apps web',
    ]) {
      expect(() =>
        ProjectWorkspaceBindingSchema.parse({
          ...baseBinding,
          subprojectScope: { path },
        }),
      ).toThrow();

      expect(() =>
        ProjectWorkspaceBindingSchema.parse({
          ...baseBinding,
          instructionFiles: [{ scope: 'nested', path }],
        }),
      ).toThrow();
    }
  });

  it('allows reads from backend-accessible or readonly projects but never unavailable projects', () => {
    expect(
      getProjectAccessPolicy({
        capabilityState: 'backend_accessible',
        onboardingState: 'missing',
      }),
    ).toMatchObject({ canInspect: true, canWrite: true });

    expect(
      getProjectAccessPolicy({
        capabilityState: 'readonly',
        onboardingState: 'approved',
      }),
    ).toMatchObject({ canInspect: true, canWrite: false });

    expect(
      getProjectAccessPolicy({
        capabilityState: 'unavailable',
        onboardingState: 'approved',
      }),
    ).toMatchObject({ canInspect: false, canWrite: false });
  });

  it('allows writes whenever the backend can access the project', () => {
    expect(
      getProjectAccessPolicy({
        capabilityState: 'backend_accessible',
        onboardingState: 'approved',
      }),
    ).toEqual({
      canInspect: true,
      canWrite: true,
      writeBlockReason: undefined,
    });

    expect(
      getProjectAccessPolicy({
        capabilityState: 'backend_accessible',
        onboardingState: 'needs_review',
      }),
    ).toEqual({
      canInspect: true,
      canWrite: true,
      writeBlockReason: undefined,
    });
  });

  it('maps every capability and onboarding state to an explicit access policy', () => {
    const policies = ProjectCapabilityStateSchema.options.flatMap((capabilityState) =>
      ProjectOnboardingStateSchema.options.map((onboardingState) =>
        getProjectAccessPolicy({ capabilityState, onboardingState }),
      ),
    );

    expect(policies).toHaveLength(
      ProjectCapabilityStateSchema.options.length * ProjectOnboardingStateSchema.options.length,
    );
    expect(policies.every((policy) => typeof policy.canInspect === 'boolean')).toBe(true);
    expect(policies.every((policy) => typeof policy.canWrite === 'boolean')).toBe(true);
    expect(
      policies.every((policy) => policy.canWrite || policy.writeBlockReason !== undefined),
    ).toBe(true);
  });
});
