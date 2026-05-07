import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ProjectOnboardingAssessmentPanel } from '@/components/ide/ide-with-chat';

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
});
