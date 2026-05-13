import { describe, expect, it } from 'vitest';
import {
  buildPersonalChatHref,
  buildProjectChatHref,
  buildProjectIdeHref,
  createWorkspaceNavigationState,
  projectCapabilityDisplays,
  projectCapabilitySummary,
  projectDisplayProfile,
  desktopProjectFolderLabel,
  desktopProjectIsAvailable,
  projectOnboardingAssessmentFromMetadata,
  projectProfileDisplay,
  projectReopenSearchParam,
  resolveWorkspaceScope,
  sessionReopenSearchParam,
  visibleRecentDesktopProjects,
  workspaceModeSearchParam,
  workspaceEntryCopy,
  workspaceNavigationItems,
  workspaceScopeLabel,
  workspaceSurfaceLabel,
} from '@/lib/project-navigation';

describe('Project navigation model', () => {
  const assessedAtMs = 1_778_172_000_000;

  function projectWithAssessment(input: {
    readonly profile: 'coding' | 'docs_content' | 'research' | 'automation' | 'mixed' | 'unknown';
    readonly capabilities: readonly (
      | 'files'
      | 'chat'
      | 'coding_tools'
      | 'terminal'
      | 'git'
      | 'tests'
      | 'automation'
      | 'docs_research'
    )[];
  }) {
    return {
      id: `project-${input.profile}`,
      slug: `project-${input.profile}`,
      name: 'Project',
      workspacePath: `projects/${input.profile}`,
      metadata: {
        onboardingAssessment: {
          status: 'in_progress',
          profile: input.profile,
          capabilities: input.capabilities,
          summary: 'Detected Project files.',
          evidenceFiles: [],
          subprojectScopes: [],
          commands: [],
          gaps: [],
          questions: [],
          recommendedInstructionUpdates: [],
          display: {
            projectName: 'Project',
            folderLabel: 'project',
            onboardingLabel: 'Needs onboarding',
          },
          assessedAtMs,
        },
      },
      createdAtMs: 1,
      updatedAtMs: 2,
    } as const;
  }

  function desktopProject(input: {
    readonly id: string;
    readonly name: string;
    readonly folderName: string;
    readonly available: boolean;
  }) {
    return {
      id: input.id,
      slug: input.folderName,
      name: input.name,
      workspacePath: `projects/${input.folderName}`,
      metadata: {
        source: 'desktop',
        folderName: input.folderName,
        capabilityState: input.available ? 'backend_accessible' : 'unavailable',
        onboardingState: input.available ? 'approved' : 'missing',
        defaultAgentProfile: 'coding',
        instructionFileCount: input.available ? 1 : 0,
      },
      createdAtMs: 1,
      updatedAtMs: input.available ? 2 : 1,
    } as const;
  }

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
    expect(workspaceNavigationItems.map((item) => item.name)).toEqual(['Workspaces', 'Chat']);
  });

  it('builds safe Project reopen metadata for desktop Projects', () => {
    const project = desktopProject({
      id: 'project 1',
      name: 'Auth App',
      folderName: 'auth-app',
      available: true,
    });

    expect(projectReopenSearchParam).toBe('projectId');
    expect(sessionReopenSearchParam).toBe('sessionId');
    expect(workspaceModeSearchParam).toBe('mode');
    expect(buildPersonalChatHref()).toBe('/?mode=chat');
    expect(buildProjectChatHref(project.id)).toBe('/?projectId=project%201');
    expect(buildProjectChatHref(project.id, 'session 1')).toBe(
      '/?projectId=project%201&sessionId=session%201',
    );
    expect(buildProjectIdeHref(project.id)).toBe('/ide?projectId=project%201');
    expect(buildProjectIdeHref(project.id, 'session 1')).toBe(
      '/ide?projectId=project%201&sessionId=session%201',
    );
    expect(desktopProjectFolderLabel(project)).toBe('auth-app');
    expect(desktopProjectIsAvailable(project)).toBe(true);
  });

  it('keeps Recent Projects focused on available Projects and limits stale unavailable entries', () => {
    const projects = [
      desktopProject({
        id: 'missing-1',
        name: 'Missing One',
        folderName: 'missing-one',
        available: false,
      }),
      desktopProject({
        id: 'available-1',
        name: 'Available One',
        folderName: 'available-one',
        available: true,
      }),
      desktopProject({
        id: 'missing-2',
        name: 'Missing Two',
        folderName: 'missing-two',
        available: false,
      }),
      desktopProject({
        id: 'available-2',
        name: 'Available Two',
        folderName: 'available-two',
        available: true,
      }),
      desktopProject({
        id: 'missing-3',
        name: 'Missing Three',
        folderName: 'missing-three',
        available: false,
      }),
    ];

    expect(
      visibleRecentDesktopProjects(projects, { limit: 4, unavailableLimit: 1 }).map((p) => p.id),
    ).toEqual(['available-1', 'available-2', 'missing-1']);
  });

  it('maps Project profiles to generic user-facing labels', () => {
    expect(projectProfileDisplay('coding').label).toBe('Code project');
    expect(projectProfileDisplay('docs_content').label).toBe('Docs/content project');
    expect(projectProfileDisplay('research').label).toBe('Research project');
    expect(projectProfileDisplay('automation').label).toBe('Automation project');
    expect(projectProfileDisplay('mixed').label).toBe('Mixed project');
    expect(projectProfileDisplay('unknown').label).toBe('Project');
    expect(projectProfileDisplay(null).label).toBe('Project');
  });

  it('derives profile and capability labels from Project assessment metadata', () => {
    const project = projectWithAssessment({
      profile: 'mixed',
      capabilities: ['files', 'chat', 'coding_tools', 'docs_research'],
    });

    expect(projectDisplayProfile(project).label).toBe('Mixed project');
    expect(
      projectCapabilityDisplays(['files', 'chat', 'coding_tools']).map((item) => item.label),
    ).toEqual(['Files', 'Chat', 'Code tools']);
    expect(
      projectCapabilitySummary(projectOnboardingAssessmentFromMetadata(project)?.capabilities),
    ).toBe('Files, Chat, Code tools +1');
  });

  it('uses clear fallback copy for unknown or unassessed Projects', () => {
    const unknownProject = projectWithAssessment({
      profile: 'unknown',
      capabilities: ['files', 'chat'],
    });

    expect(projectDisplayProfile(unknownProject).label).toBe('Project');
    expect(projectDisplayProfile({ metadata: {} }).description).toContain(
      'describe what you want to do',
    );
    expect(projectCapabilitySummary([])).toBe('Files and chat');
  });
});
