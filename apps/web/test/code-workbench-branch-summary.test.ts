import { describe, expect, it } from 'vitest';

import { buildWorkbenchBranchSummary } from '@/lib/code-workbench-branch-summary';

describe('code workbench branch summary', () => {
  it('shows a clean local state when there are no dirty files', () => {
    expect(
      buildWorkbenchBranchSummary({
        workspaceName: 'agent-platform',
        openTabs: [{ path: '/src/app.ts', name: 'app.ts', isDirty: false }],
      }),
    ).toMatchObject({
      workspaceName: 'agent-platform',
      branchLabel: 'Branch not connected',
      stateLabel: 'Clean',
      changedFiles: [],
    });
  });

  it('lists dirty files as local changed files', () => {
    expect(
      buildWorkbenchBranchSummary({
        workspaceName: 'agent-platform',
        openTabs: [{ path: '/src/app.ts', name: 'app.ts', isDirty: true }],
      }).changedFiles,
    ).toEqual([{ path: '/src/app.ts', name: 'app.ts', state: 'modified' }]);
  });

  it('marks pending edit proposals separately from applied changes', () => {
    expect(
      buildWorkbenchBranchSummary({
        workspaceName: null,
        openTabs: [{ path: '/src/app.ts', name: 'app.ts', isDirty: false }],
        pendingProposalPath: '/src/app.ts',
      }),
    ).toMatchObject({
      workspaceName: 'No folder open',
      stateLabel: 'Review pending',
      changedFiles: [{ path: '/src/app.ts', name: 'app.ts', state: 'pending_review' }],
    });
  });
});
