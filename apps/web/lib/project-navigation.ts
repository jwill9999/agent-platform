import type { ProjectDesktopRecord, ProjectRecord } from '@agent-platform/contracts';
import { Code2, MessageSquare, type LucideIcon } from 'lucide-react';

export type WorkspaceSurface = 'home' | 'chat' | 'project-chat' | 'ide';

export type WorkspaceScope = 'none' | 'global-chat' | 'project';

export interface WorkspaceNavigationState {
  readonly surface: WorkspaceSurface;
  readonly scope: WorkspaceScope;
  readonly projectId: string | null;
  readonly sessionId: string | null;
}

export interface WorkspaceNavigationItem {
  readonly name: string;
  readonly href: string;
  readonly surface: WorkspaceSurface;
  readonly icon: LucideIcon;
  readonly description: string;
}

export const workspaceNavigationItems: readonly WorkspaceNavigationItem[] = [
  {
    name: 'Chat',
    href: '/',
    surface: 'chat',
    icon: MessageSquare,
    description: 'Start conversations',
  },
  {
    name: 'IDE',
    href: '/ide',
    surface: 'ide',
    icon: Code2,
    description: 'Inspect Project files',
  },
];

export const workspaceEntryCopy = {
  title: 'Choose a workspace',
  description: 'Open a general chat or choose a Project.',
  chatTitle: 'Open Chat',
  chatDescription: 'Talk with the personal assistant without loading a Project.',
  chatProfile: 'Personal assistant',
  projectTitle: 'Open Project',
  projectDescription: 'Choose a Project folder for chat, file review, and optional IDE work.',
  projectProfile: 'Project workspace',
} as const;

export const projectReopenSearchParam = 'projectId';
export const recentProjectsUpdatedEvent = 'agent-platform:desktop-projects-updated';

export function createWorkspaceNavigationState(input: {
  readonly surface: WorkspaceSurface;
  readonly projectId?: string | null;
  readonly sessionId?: string | null;
}): WorkspaceNavigationState {
  const projectId = input.projectId ?? null;
  return {
    surface: input.surface,
    scope: resolveWorkspaceScope(input.surface, projectId),
    projectId,
    sessionId: input.sessionId ?? null,
  };
}

export function resolveWorkspaceScope(
  surface: WorkspaceSurface,
  projectId: string | null,
): WorkspaceScope {
  if (projectId) return 'project';
  if (surface === 'chat') return 'global-chat';
  return 'none';
}

export function workspaceSurfaceLabel(surface: WorkspaceSurface): string {
  switch (surface) {
    case 'home':
      return 'Home';
    case 'chat':
      return 'Chat';
    case 'project-chat':
      return 'Project chat';
    case 'ide':
      return 'IDE';
  }
}

export function workspaceScopeLabel(state: WorkspaceNavigationState): string {
  switch (state.scope) {
    case 'project':
      return 'Project';
    case 'global-chat':
      return 'Chat';
    case 'none':
      return 'Workspace';
  }
}

export function desktopProjectFolderLabel(
  project: Pick<ProjectRecord, 'metadata' | 'name'> | null,
): string | null {
  const folderName = project?.metadata.folderName;
  return typeof folderName === 'string' && folderName.trim() ? folderName : null;
}

export function desktopProjectIsAvailable(project: ProjectDesktopRecord): boolean {
  return project.metadata.capabilityState !== 'unavailable';
}

export function buildProjectIdeHref(projectId: string): string {
  return `/ide?${projectReopenSearchParam}=${encodeURIComponent(projectId)}`;
}

export function buildProjectChatHref(projectId: string): string {
  return `/?${projectReopenSearchParam}=${encodeURIComponent(projectId)}`;
}
