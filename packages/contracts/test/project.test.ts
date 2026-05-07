import { describe, expect, it } from 'vitest';

import {
  ProjectModeSchema,
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
    ).toMatchObject({ canInspect: true, canWrite: false });

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

  it('allows writes only when the backend can access the project and onboarding is approved', () => {
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
      }).writeBlockReason,
    ).toBe('onboarding_not_approved');
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
