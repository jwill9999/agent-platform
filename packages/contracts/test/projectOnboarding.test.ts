import { describe, expect, it } from 'vitest';

import {
  ProjectOnboardingAssessmentSchema,
  ProjectOnboardingApprovalDecisionSchema,
  ProjectOnboardingDraftSchema,
  ProjectOnboardingFixtureStateSchema,
  ProjectOnboardingRefreshResultSchema,
  transitionProjectOnboardingState,
} from '../src/project.js';

const assessedAtMs = 1_778_172_000_000;

describe('Project onboarding contracts', () => {
  it('parses structured assessment output with user-visible display context', () => {
    const assessment = ProjectOnboardingAssessmentSchema.parse({
      status: 'in_progress',
      profile: 'mixed',
      capabilities: ['files', 'chat', 'coding_tools', 'docs_research'],
      summary: 'This Project mixes a web app with product planning documents.',
      evidenceFiles: [
        {
          path: 'AGENTS.md',
          kind: 'instructions',
          summary: 'Root instructions exist but do not mention docs workflow.',
        },
        {
          path: 'apps/web/package.json',
          kind: 'manifest',
        },
      ],
      subprojectScopes: [{ path: 'apps/web', packageName: '@agent-platform/web' }],
      commands: [
        {
          kind: 'test',
          command: 'pnpm --filter @agent-platform/web test',
          path: 'apps/web',
          packageName: '@agent-platform/web',
          confidence: 0.9,
        },
      ],
      gaps: [
        {
          kind: 'ambiguous_scope',
          severity: 'blocking',
          message: 'The user intent could target docs or the web app.',
          evidencePaths: ['docs/tasks'],
        },
      ],
      questions: [
        {
          id: 'target-workflow',
          prompt: 'Should this Project default to code changes, docs work, or both?',
        },
      ],
      recommendedInstructionUpdates: [
        {
          summary: 'Document the mixed code and docs workflow.',
          proposedMarkdown: '# Agent Instructions\n\nPrefer asking which surface to change.',
        },
      ],
      display: {
        projectName: 'agent-platform',
        folderLabel: 'agent-platform',
        relativePath: 'apps/web',
        profileLabel: 'Mixed Project',
        onboardingLabel: 'Needs clarification',
        branchLabel: 'feature/project-onboarding',
      },
      assessedAtMs,
    });

    expect(assessment.profile).toBe('mixed');
    expect(assessment.display.projectName).toBe('agent-platform');
    expect(JSON.stringify(assessment.display)).not.toContain('/workspace');
    expect(assessment.recommendedInstructionUpdates[0]?.targetPath).toBe('AGENTS.md');
  });

  it('rejects unsafe project-relative paths in assessment evidence', () => {
    expect(() =>
      ProjectOnboardingAssessmentSchema.parse({
        status: 'needs_review',
        profile: 'coding',
        summary: 'Unsafe evidence path.',
        evidenceFiles: [{ path: '../AGENTS.md', kind: 'instructions' }],
        display: {
          projectName: 'agent-platform',
          onboardingLabel: 'Needs review',
        },
        assessedAtMs,
      }),
    ).toThrow();
  });

  it('parses draft, approval, refresh, and fixture contracts', () => {
    const draft = ProjectOnboardingDraftSchema.parse({
      id: 'draft-1',
      projectId: 'project-1',
      markdown: '# Agent Instructions\n\nRun tests before closing tasks.',
      revision: 1,
      createdAtMs: assessedAtMs,
      updatedAtMs: assessedAtMs,
    });
    expect(draft.targetPath).toBe('AGENTS.md');

    const approval = ProjectOnboardingApprovalDecisionSchema.parse({
      decision: 'approve',
      projectId: 'project-1',
      reviewer: 'owner',
      source: 'manual_review',
      decidedAtMs: assessedAtMs,
    });
    expect(approval.targetPath).toBe('AGENTS.md');

    const refresh = ProjectOnboardingRefreshResultSchema.parse({
      previousState: 'approved',
      nextState: 'needs_review',
      materialDrift: true,
      refreshedAtMs: assessedAtMs,
      assessment: {
        status: 'needs_review',
        profile: 'automation',
        summary: 'New scheduler files were added after approval.',
        display: {
          projectName: 'automation-project',
          onboardingLabel: 'Needs review',
          profileLabel: 'Automation Project',
        },
        assessedAtMs,
      },
    });
    expect(refresh.materialDrift).toBe(true);

    expect(ProjectOnboardingFixtureStateSchema.options).toContain('mixed_non_code_project');
  });

  it('allows the intended onboarding state transitions', () => {
    expect(
      transitionProjectOnboardingState({
        current: 'missing',
        trigger: 'assessment_missing',
      }),
    ).toBe('in_progress');

    expect(
      transitionProjectOnboardingState({
        current: 'needs_review',
        trigger: 'assessment_approved',
      }),
    ).toBe('approved');

    expect(
      transitionProjectOnboardingState({
        current: 'in_progress',
        trigger: 'approval_granted',
      }),
    ).toBe('approved');

    expect(
      transitionProjectOnboardingState({
        current: 'approved',
        trigger: 'refresh_material_drift',
      }),
    ).toBe('needs_review');

    expect(
      transitionProjectOnboardingState({
        current: 'approved',
        trigger: 'refresh_no_change',
      }),
    ).toBe('approved');
  });

  it('rejects invalid onboarding state transitions', () => {
    expect(() =>
      transitionProjectOnboardingState({
        current: 'missing',
        trigger: 'approval_granted',
      }),
    ).toThrow('Invalid Project onboarding transition');

    expect(() =>
      transitionProjectOnboardingState({
        current: 'approved',
        trigger: 'approval_rejected',
      }),
    ).toThrow('Invalid Project onboarding transition');
  });
});
