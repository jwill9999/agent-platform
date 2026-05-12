import { describe, expect, it } from 'vitest';
import {
  buildProjectChatHref,
  buildProjectIdeHref,
  createWorkspaceNavigationState,
  desktopProjectFolderLabel,
  desktopProjectIsAvailable,
  projectReopenSearchParam,
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

  it('builds safe Project reopen metadata for desktop Projects', () => {
    const project = {
      id: 'project 1',
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
    } as const;

    expect(projectReopenSearchParam).toBe('projectId');
    expect(buildProjectChatHref(project.id)).toBe('/?projectId=project%201');
    expect(buildProjectIdeHref(project.id)).toBe('/ide?projectId=project%201');
    expect(desktopProjectFolderLabel(project)).toBe('auth-app');
    expect(desktopProjectIsAvailable(project)).toBe(true);
  });
});
