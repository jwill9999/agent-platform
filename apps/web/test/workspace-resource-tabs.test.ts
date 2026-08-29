import { workspaceResourceUri, type WorkspaceResource } from '@agent-platform/contracts';
import { describe, expect, it } from 'vitest';

import {
  activateWorkspaceResourceTab,
  closeWorkspaceResourceTab,
  EMPTY_WORKSPACE_RESOURCE_TABS,
  minimizeWorkspaceResourceTabs,
  openWorkspaceResourceTab,
  restoreWorkspaceResourceTabs,
} from '@/lib/workspace-resource-tabs';

function resource(projectId: string, path: string): WorkspaceResource {
  return {
    uri: workspaceResourceUri({ projectId, kind: 'file', target: path }),
    kind: 'file',
    projectId,
    label: path,
    metadata: { relativePath: path },
    createdAt: '2026-08-29T20:00:00.000Z',
  };
}

describe('workspace resource tabs', () => {
  it('adds, activates, and de-duplicates normalized resource identities', () => {
    const first = resource('project-1', 'generated/first.md');
    const second = resource('project-1', 'generated/second.md');
    const opened = openWorkspaceResourceTab(
      openWorkspaceResourceTab(EMPTY_WORKSPACE_RESOURCE_TABS, first),
      second,
    );
    const reopened = openWorkspaceResourceTab(opened, { ...first, label: 'Updated first' });

    expect(reopened.resources).toHaveLength(2);
    expect(reopened.resources[0]?.label).toBe('Updated first');
    expect(reopened.activeUri).toBe(first.uri);
    expect(activateWorkspaceResourceTab(reopened, second.uri).activeUri).toBe(second.uri);
  });

  it('selects the next neighbor, then the previous neighbor, when closing active tabs', () => {
    const first = resource('project-1', 'first.md');
    const second = resource('project-1', 'second.md');
    const third = resource('project-1', 'third.md');
    let state = [first, second, third].reduce(
      openWorkspaceResourceTab,
      EMPTY_WORKSPACE_RESOURCE_TABS,
    );
    state = activateWorkspaceResourceTab(state, second.uri);

    state = closeWorkspaceResourceTab(state, second.uri);
    expect(state.activeUri).toBe(third.uri);
    state = closeWorkspaceResourceTab(state, third.uri);
    expect(state.activeUri).toBe(first.uri);
    expect(closeWorkspaceResourceTab(state, first.uri)).toEqual(EMPTY_WORKSPACE_RESOURCE_TABS);
  });

  it('keeps the active tab when closing an inactive tab and preserves tabs while minimized', () => {
    const first = resource('project-1', 'first.md');
    const second = resource('project-1', 'second.md');
    let state = openWorkspaceResourceTab(
      openWorkspaceResourceTab(EMPTY_WORKSPACE_RESOURCE_TABS, first),
      second,
    );

    state = closeWorkspaceResourceTab(state, first.uri);
    expect(state.activeUri).toBe(second.uri);
    const minimized = minimizeWorkspaceResourceTabs(state);
    expect(minimized.minimized).toBe(true);
    expect(restoreWorkspaceResourceTabs(minimized)).toEqual({ ...state, minimized: false });
  });

  it('ignores unavailable identities and cannot minimize an empty workspace', () => {
    const first = resource('project-1', 'first.md');
    const state = openWorkspaceResourceTab(EMPTY_WORKSPACE_RESOURCE_TABS, first);

    expect(activateWorkspaceResourceTab(state, 'workspace://project/project-2/file/other.md')).toBe(
      state,
    );
    expect(minimizeWorkspaceResourceTabs(EMPTY_WORKSPACE_RESOURCE_TABS)).toBe(
      EMPTY_WORKSPACE_RESOURCE_TABS,
    );
  });
});
