import type {
  ProjectGitChangesResult,
  ProjectGitChecksResult,
  ProjectGitPullRequestsResult,
  WorkspaceResource,
} from '@agent-platform/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProjectActivityPanel } from '@/components/project/project-activity-panel';
import { ProjectEvidenceRail } from '@/components/project/project-evidence-rail';
import { normalizeProjectActivity } from '@/lib/project-activity';

const changes: ProjectGitChangesResult = {
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
      path: 'src/app.ts',
      status: 'modified',
      indexStatus: ' ',
      worktreeStatus: 'M',
      staged: false,
      unstaged: true,
    },
  ],
};

const checks: ProjectGitChecksResult = {
  available: true,
  repositoryName: 'agent-platform',
  currentBranch: 'task/activity',
  githubRemoteDetected: true,
  ghAvailable: true,
  authenticated: true,
  checkedAt: '2026-08-29T20:00:00.000Z',
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
    { id: 'verify', name: 'Verify', status: 'completed', conclusion: 'success' },
    { id: 'e2e', name: 'Browser E2E', status: 'completed', conclusion: 'failure' },
  ],
};

const pullRequests: ProjectGitPullRequestsResult = {
  available: true,
  repositoryName: 'agent-platform',
  currentBranch: 'task/activity',
  githubRemoteDetected: true,
  ghAvailable: true,
  authenticated: true,
  checkedAt: '2026-08-29T20:00:00.000Z',
  pullRequests: [
    {
      number: 247,
      title: 'Add activity panel',
      state: 'open',
      url: 'https://github.com/example/repo/pull/247',
      headRefName: 'task/activity',
      baseRefName: 'staging',
      currentBranch: true,
      isDraft: false,
      reviewDecision: 'changes_requested',
      checks: { total: 2, success: 1, failure: 1, pending: 0, unknown: 0 },
    },
  ],
};

const generated: WorkspaceResource = {
  uri: 'workspace://project/project-1/file/generated/report.md',
  kind: 'file',
  projectId: 'project-1',
  label: '/Users/example/private/report.md',
  metadata: { relativePath: 'generated/report.md' },
  createdAt: '2026-08-29T20:00:00.000Z',
};

describe('normalizeProjectActivity', () => {
  it('groups coding evidence behind a normalized, clickable resource boundary', () => {
    const activity = normalizeProjectActivity({
      projectId: 'project-1',
      profile: 'coding',
      changes,
      checks,
      pullRequests,
      resources: [generated, generated],
      approvals: [{ id: 'approval-1', title: 'Run command approval', status: 'pending' }],
      findings: [
        {
          id: 'local-test',
          title: 'Unit tests',
          detail: 'Completed successfully',
          status: 'success',
          category: 'check',
        },
        { id: 'tool-error', title: 'Tool issue', status: 'error' },
      ],
    });

    expect(activity.state).toBe('ready');
    expect(activity.sections.find((section) => section.id === 'changes')?.entries[0]).toMatchObject(
      {
        kind: 'changed_file',
        title: 'src/app.ts',
        resource: { kind: 'diff', projectId: 'project-1' },
      },
    );
    expect(activity.sections.find((section) => section.id === 'generated')?.entries).toHaveLength(
      1,
    );
    expect(activity.sections.find((section) => section.id === 'checks')?.entries).toHaveLength(3);
    expect(activity.sections.find((section) => section.id === 'reviews')?.entries).toHaveLength(2);
    expect(activity.sections.find((section) => section.id === 'findings')?.entries).toHaveLength(1);
    expect(activity.sections.find((section) => section.id === 'next_actions')?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'next:approval' }),
        expect.objectContaining({ id: 'next:changes' }),
        expect.objectContaining({ id: 'next:checks' }),
        expect.objectContaining({ id: 'next:review' }),
      ]),
    );
  });

  it('hides host paths and commit hashes from user-facing labels', () => {
    const activity = normalizeProjectActivity({
      projectId: 'project-1',
      profile: 'coding',
      resources: [generated],
      findings: [
        {
          id: 'finding',
          title: 'Reviewed 1234567890abcdef1234567890abcdef12345678',
          detail: 'Result at /workspace/generated/report.md from /Users/example/private/report.md',
          status: 'success',
        },
      ],
    });
    const serialized = JSON.stringify(activity);

    expect(serialized).toContain('report.md');
    expect(serialized).toContain('a recent commit');
    expect(serialized).not.toContain('/Users/example');
    expect(serialized).not.toContain('/workspace');
    expect(serialized).not.toContain('1234567890abcdef1234567890abcdef12345678');
  });

  it('provides explicit disconnected, unavailable, and non-coding fallback states', () => {
    expect(normalizeProjectActivity({ projectId: null, profile: 'unknown' }).state).toBe(
      'disconnected',
    );

    const unavailable = normalizeProjectActivity({
      projectId: 'project-1',
      profile: 'research',
      gitError: 'offline',
      checksError: 'offline',
      reviewsError: 'offline',
    });
    expect(unavailable.state).toBe('unavailable');
    expect(unavailable.profileMessage).toContain('Research evidence');
    expect(
      unavailable.sections.find((section) => section.id === 'checks')?.unavailableMessage,
    ).toBe('Checks are unavailable for this branch.');
  });

  it('renders an accessible compact panel from session-scoped normalized evidence', () => {
    const html = renderToStaticMarkup(
      createElement(ProjectActivityPanel, {
        projectId: 'project-1',
        sessionId: 'session-1',
        profile: 'research',
        workspaceEventsByMessage: {
          'message-1': [{ type: 'resource_created', resource: generated, metadata: {} }],
        },
      }),
    );

    expect(html).toContain('aria-label="Project activity"');
    expect(html).toContain('data-project-id="project-1"');
    expect(html).toContain('data-session-id="session-1"');
    expect(html).toContain('Generated outputs');
    expect(html).toContain('Research evidence appears');
    expect(html).toContain('<button');
    expect(html).not.toContain('/Users/example');
  });

  it('shares the established right rail through accessible Activity and Git tabs', () => {
    const html = renderToStaticMarkup(
      createElement(ProjectEvidenceRail, {
        projectId: 'project-1',
        sessionId: 'session-1',
        profile: 'coding',
      }),
    );

    expect(html).toContain('aria-label="Project evidence views"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Activity');
    expect(html).toContain('Git &amp; GitHub');
    expect(html).toContain('aria-label="Project activity"');
  });
});
