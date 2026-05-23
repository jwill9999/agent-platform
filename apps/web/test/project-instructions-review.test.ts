import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ProjectInstructionsApprovalNotice,
  ProjectInstructionsRejectedNotice,
  ProjectInstructionsReview,
} from '@/components/project/project-instructions-review';

describe('Project instructions review UI', () => {
  it('shows approve and reject actions for draft instructions', () => {
    const html = renderToStaticMarkup(
      createElement(ProjectInstructionsReview, {
        draft: {
          id: 'draft-1',
          projectId: 'project-1',
          targetPath: 'AGENTS.md',
          revision: 1,
          history: [],
          markdown: '# Agent Instructions\n\n- Run npm run test\n',
          createdAtMs: 1,
          updatedAtMs: 1,
        },
        isApproving: false,
        isRejecting: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );

    expect(html).toContain('Review Project instructions');
    expect(html).toContain('Approve instructions');
    expect(html).toContain('Reject draft');
    expect(html).toContain('npm run test');
  });

  it('confirms approved Project instructions in user-facing language', () => {
    const html = renderToStaticMarkup(
      createElement(ProjectInstructionsApprovalNotice, { targetPath: 'AGENTS.md' }),
    );

    expect(html).toContain('Project instructions approved');
    expect(html).toContain('AGENTS.md');
    expect(html).toContain('Project root');
    expect(html).not.toContain('/workspace');
    expect(html).not.toContain('backend');
  });

  it('renders a dismiss action for approved Project instructions when provided', () => {
    const html = renderToStaticMarkup(
      createElement(ProjectInstructionsApprovalNotice, {
        targetPath: 'AGENTS.md',
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('Dismiss Project instructions notice');
  });

  it('confirms rejected Project instructions in user-facing language', () => {
    const html = renderToStaticMarkup(
      createElement(ProjectInstructionsRejectedNotice, { targetPath: 'AGENTS.md' }),
    );

    expect(html).toContain('Project instructions rejected');
    expect(html).toContain('AGENTS.md');
    expect(html).toContain('/init');
    expect(html).not.toContain('/workspace');
    expect(html).not.toContain('backend');
  });
});
