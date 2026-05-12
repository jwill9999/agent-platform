import { describe, expect, it } from 'vitest';
import {
  createWorkspaceNavigationState,
  resolveWorkspaceScope,
  workspaceEntryCopy,
  workspaceNavigationItems,
  workspaceScopeLabel,
  workspaceSurfaceLabel,
} from '@/lib/project-navigation';

describe('Project navigation model', () => {
  it('tracks surface, Project, and session context explicitly', () => {
    expect(
      createWorkspaceNavigationState({
        surface: 'project-chat',
        projectId: 'project-1',
        sessionId: 'session-1',
      }),
    ).toEqual({
      surface: 'project-chat',
      scope: 'project',
      projectId: 'project-1',
      sessionId: 'session-1',
    });
  });

  it('distinguishes global chat from Project-bound surfaces', () => {
    expect(resolveWorkspaceScope('chat', null)).toBe('global-chat');
    expect(resolveWorkspaceScope('ide', null)).toBe('none');
    expect(resolveWorkspaceScope('ide', 'project-1')).toBe('project');
  });

  it('uses user-facing labels without runtime implementation details', () => {
    expect(workspaceSurfaceLabel('project-chat')).toBe('Project chat');
    expect(workspaceScopeLabel(createWorkspaceNavigationState({ surface: 'chat' }))).toBe('Chat');

    const visibleCopy = [
      workspaceEntryCopy.description,
      workspaceEntryCopy.projectDescription,
      ...workspaceNavigationItems.flatMap((item) => [item.name, item.description]),
    ].join(' ');

    expect(visibleCopy).toContain('Project');
    expect(visibleCopy).not.toMatch(/backend|\/workspace|container|coding agent/i);
  });
});
