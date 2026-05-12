import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ProjectInstructionUpdatesPanel,
  ProjectOnboardingAssessmentPanel,
  ProjectOnboardingDraftPanel,
  RecentDesktopProjectsPanel,
} from '@/components/ide/ide-with-chat';

beforeAll(() => {
  vi.stubGlobal('React', React);
});

describe('Project onboarding assessment panel', () => {
  it('renders user-facing assessment status, gaps, and questions without runtime paths', () => {
    const html = renderToStaticMarkup(
      createElement(ProjectOnboardingAssessmentPanel, {
        assessment: {
          status: 'in_progress',
          profile: 'mixed',
          capabilities: ['files', 'chat', 'coding_tools', 'docs_research'],
          summary: 'Root instructions exist but need clearer workflow expectations.',
          evidenceFiles: [{ path: 'AGENTS.md', kind: 'instructions' }],
          subprojectScopes: [{ path: 'apps/web', packageName: '@agent-platform/web' }],
          commands: [{ kind: 'test', command: 'pnpm --filter @agent-platform/web test' }],
          gaps: [
            {
              kind: 'stale_instructions',
              severity: 'warning',
              message: 'The root instructions need clearer project workflow rules.',
              evidencePaths: ['AGENTS.md'],
            },
          ],
          questions: [
            {
              id: 'q1',
              prompt: 'Should I draft updated root Project instructions?',
              required: true,
            },
          ],
          recommendedInstructionUpdates: [],
          display: {
            projectName: 'agent-platform',
            folderLabel: 'agent-platform',
            profileLabel: 'Mixed Project',
            onboardingLabel: 'Needs onboarding',
            branchLabel: 'feature/project-onboarding',
          },
          assessedAtMs: 1_778_172_000_000,
        },
        isRefreshing: false,
        onRefresh: () => {},
      }),
    );

    expect(html).toContain('Mixed Project');
    expect(html).toContain('Needs onboarding');
    expect(html).toContain('The root instructions need clearer project workflow rules.');
    expect(html).toContain('Should I draft updated root Project instructions?');
    expect(html).not.toContain('/workspace');
    expect(html).not.toContain('backend');
  });

  it('renders onboarding draft questions, answers, and revision state', () => {
    const html = renderToStaticMarkup(
      createElement(ProjectOnboardingDraftPanel, {
        draft: {
          id: 'draft-project-1',
          projectId: 'project-1',
          targetPath: 'AGENTS.md',
          markdown:
            '# Agent Instructions\n\n## User Workflow Notes\n\n- This Project mixes code and docs.',
          revision: 2,
          history: [
            {
              revision: 1,
              markdown: '# Agent Instructions\n',
              summary: 'Initial draft.',
              createdAtMs: 1_778_172_000_000,
            },
          ],
          createdAtMs: 1_778_172_000_000,
          updatedAtMs: 1_778_172_001_000,
        },
        dialogue: {
          status: 'asking',
          activeQuestionId: 'project-intended-workflow',
          answeredQuestionIds: [],
          turns: [
            {
              id: 'assistant-1',
              role: 'assistant',
              content:
                'What kind of work should this Project support: code changes, docs/content, research, automation, or a mix?',
              questionId: 'project-intended-workflow',
              createdAtMs: 1_778_172_000_000,
            },
          ],
          updatedAtMs: 1_778_172_000_000,
        },
        answer: '',
        isStarting: false,
        isSubmitting: false,
        isReviewing: false,
        reviewComment: '',
        onStart: () => {},
        onAnswerChange: () => {},
        onSubmitAnswer: () => {},
        onReviewCommentChange: () => {},
        onApprove: () => {},
        onRequestChanges: () => {},
        onReject: () => {},
      }),
    );

    expect(html).toContain('Onboarding draft');
    expect(html).toContain('Revision 2');
    expect(html).toContain('What kind of work should this Project support');
    expect(html).toContain('This Project mixes code and docs.');
    expect(html).toContain('Approve draft');
    expect(html).toContain('1 earlier revision');
    expect(html).not.toContain('/workspace');
    expect(html).not.toContain('Code edits and write tools are available');
  });

  it('renders closeout instruction update candidates for review', () => {
    const html = renderToStaticMarkup(
      createElement(ProjectInstructionUpdatesPanel, {
        candidates: [
          {
            id: 'candidate-1',
            targetPath: 'AGENTS.md',
            summary: 'Use focused API tests for router-only changes.',
            proposedMarkdown:
              '- Focused API tests: pnpm --filter @agent-platform/api test -- <test-file>',
            source: 'closeout',
            risk: 'low_risk_fact',
            status: 'proposed',
            evidence: [{ path: 'package.json', kind: 'manifest' }],
            createdAtMs: 1_778_172_000_000,
          },
        ],
        proposal: {
          id: 'proposal-1',
          status: 'ready',
          candidateIds: ['candidate-1'],
          summary: '1 reviewable Project instruction update is ready.',
          policy: 'relaxed_reviewable',
          createdAtMs: 1_778_172_000_000,
        },
        isPreparing: false,
        isDeciding: false,
        onPrepare: () => {},
        onApply: () => {},
        onReject: () => {},
      }),
    );

    expect(html).toContain('Closeout updates');
    expect(html).toContain('1 reviewable Project instruction update is ready.');
    expect(html).toContain('Use focused API tests for router-only changes.');
    expect(html).toContain('Focused API tests: pnpm --filter @agent-platform/api test');
    expect(html).toContain('Apply');
    expect(html).toContain('Reject');
    expect(html).not.toContain('/workspace');
  });

  it('renders recent desktop Projects without host paths and disables missing folders', () => {
    const html = renderToStaticMarkup(
      createElement(RecentDesktopProjectsPanel, {
        projects: [
          {
            id: 'project-1',
            slug: 'auth-app',
            name: 'Auth App',
            workspacePath: 'projects/auth-app',
            metadata: {
              source: 'desktop',
              folderName: 'auth-app',
              capabilityState: 'backend_accessible',
              onboardingState: 'approved',
              defaultAgentProfile: 'coding',
              instructionFileCount: 1,
            },
            createdAtMs: 1,
            updatedAtMs: 2,
          },
          {
            id: 'project-2',
            slug: 'missing-app',
            name: 'Missing App',
            workspacePath: 'projects/missing-app',
            metadata: {
              source: 'desktop',
              folderName: 'missing-app',
              capabilityState: 'unavailable',
              onboardingState: 'missing',
              defaultAgentProfile: 'coding',
              instructionFileCount: 0,
            },
            createdAtMs: 1,
            updatedAtMs: 1,
          },
        ],
        isLoading: false,
        onRefresh: () => {},
        onReopen: () => {},
      }),
    );

    expect(html).toContain('Recent Projects');
    expect(html).toContain('Auth App');
    expect(html).toContain('Ready to reopen');
    expect(html).toContain('Missing App');
    expect(html).toContain('Folder unavailable');
    expect(html).not.toContain('/Users/');
    expect(html).not.toContain('/workspace');
  });
});
