import type {
  ProjectCapability,
  ProjectDesktopRecord,
  ProjectOnboardingAssessment,
  ProjectProfile,
  ProjectRecord,
  SessionRecord,
} from '@agent-platform/contracts';
import { ProjectOnboardingAssessmentSchema } from '@agent-platform/contracts';
import { House, MessageSquare, type LucideIcon } from 'lucide-react';

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

export interface ProjectProfileDisplay {
  readonly label: string;
  readonly description: string;
}

export interface ProjectCapabilityDisplay {
  readonly capability: ProjectCapability;
  readonly label: string;
  readonly description: string;
}

export const workspaceNavigationItems: readonly WorkspaceNavigationItem[] = [
  {
    name: 'Workspaces',
    href: '/',
    surface: 'home',
    icon: House,
    description: 'Choose chat or Project',
  },
  {
    name: 'Chat',
    href: '/?mode=chat',
    surface: 'chat',
    icon: MessageSquare,
    description: 'Personal assistant',
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
export const sessionReopenSearchParam = 'sessionId';
export const workspaceModeSearchParam = 'mode';
export const personalChatModeSearchValue = 'chat';
export const recentProjectsUpdatedEvent = 'agent-platform:desktop-projects-updated';
export const projectReopenRequestedEvent = 'agent-platform:project-reopen-requested';
export const workspaceHomeRequestedEvent = 'agent-platform:workspace-home-requested';
export const workspacePersonalChatRequestedEvent =
  'agent-platform:workspace-personal-chat-requested';

const projectProfileDisplayByProfile: Record<ProjectProfile, ProjectProfileDisplay> = {
  coding: {
    label: 'Code project',
    description: 'Files can be inspected with code-aware help when the Project allows it.',
  },
  docs_content: {
    label: 'Docs/content project',
    description: 'Files can be reviewed, summarized, and updated as content.',
  },
  research: {
    label: 'Research project',
    description: 'Research notes and reference files can be organized and summarized.',
  },
  automation: {
    label: 'Automation project',
    description: 'Automation files and schedules can be inspected before changes are made.',
  },
  mixed: {
    label: 'Mixed project',
    description: 'This Project may contain code, docs, automation, or other file types.',
  },
  unknown: {
    label: 'Project',
    description: 'Open the Project chat to describe what you want to do with these files.',
  },
};

const projectCapabilityDisplayByCapability: Record<ProjectCapability, ProjectCapabilityDisplay> = {
  files: {
    capability: 'files',
    label: 'Files',
    description: 'Browse and reference Project files.',
  },
  chat: {
    capability: 'chat',
    label: 'Chat',
    description: 'Discuss the Project with the assistant.',
  },
  coding_tools: {
    capability: 'coding_tools',
    label: 'Code tools',
    description: 'Use code-aware editing and review tools when policy allows.',
  },
  terminal: {
    capability: 'terminal',
    label: 'Terminal',
    description: 'Run Project commands when policy allows.',
  },
  git: {
    capability: 'git',
    label: 'Git',
    description: 'Inspect repository state and branch information.',
  },
  tests: {
    capability: 'tests',
    label: 'Tests',
    description: 'Run detected Project test commands.',
  },
  automation: {
    capability: 'automation',
    label: 'Automation',
    description: 'Work with automation and scheduled-task files.',
  },
  docs_research: {
    capability: 'docs_research',
    label: 'Docs/research',
    description: 'Summarize and improve documentation or research files.',
  },
};

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

export function desktopProjectPathLabel(project: ProjectDesktopRecord | null): string | null {
  const folderPathLabel = project?.metadata.folderPathLabel;
  return typeof folderPathLabel === 'string' && folderPathLabel.trim() ? folderPathLabel : null;
}

export function desktopProjectNeedsDisambiguator(
  project: ProjectDesktopRecord,
  projects: readonly ProjectDesktopRecord[],
): boolean {
  const folderLabel = (desktopProjectFolderLabel(project) ?? project.name).toLowerCase();
  return (
    projects.filter((candidate) => {
      const candidateFolderLabel = (
        desktopProjectFolderLabel(candidate) ?? candidate.name
      ).toLowerCase();
      return candidateFolderLabel === folderLabel;
    }).length > 1
  );
}

export function desktopProjectSecondaryLabel(
  project: ProjectDesktopRecord,
  projects: readonly ProjectDesktopRecord[],
): string {
  if (desktopProjectNeedsDisambiguator(project, projects)) {
    return desktopProjectPathLabel(project) ?? desktopProjectFolderLabel(project) ?? project.name;
  }
  return desktopProjectFolderLabel(project) ?? project.name;
}

export function desktopProjectIsAvailable(project: ProjectDesktopRecord): boolean {
  return project.metadata.capabilityState !== 'unavailable';
}

export function visibleRecentDesktopProjects(
  projects: readonly ProjectDesktopRecord[],
  options: {
    readonly limit?: number;
    readonly unavailableLimit?: number;
  } = {},
): ProjectDesktopRecord[] {
  const limit = options.limit ?? 6;
  const unavailableLimit = options.unavailableLimit ?? 2;
  const seen = new Set<string>();
  const unique = projects.filter((project) => {
    const folderLabel = desktopProjectFolderLabel(project)?.toLowerCase() ?? '';
    const dedupeKey = `${project.id}:${project.name.toLowerCase()}:${folderLabel}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
  const available = unique.filter(desktopProjectIsAvailable);
  const unavailable = unique.filter((project) => !desktopProjectIsAvailable(project));
  const visibleAvailable = available.slice(0, limit);
  const remainingSlots = Math.max(0, limit - visibleAvailable.length);
  const visibleUnavailable = unavailable.slice(0, Math.min(unavailableLimit, remainingSlots));
  return [...visibleAvailable, ...visibleUnavailable];
}

export function mostRecentTitledProjectSession(
  sessions: readonly SessionRecord[],
  projectId: string,
): SessionRecord | null {
  return (
    sessions
      .filter(
        (session) =>
          session.mode === 'project' &&
          session.projectId === projectId &&
          Boolean(session.title?.trim()),
      )
      .toSorted((a, b) => b.updatedAtMs - a.updatedAtMs)[0] ?? null
  );
}

export function projectOnboardingAssessmentFromMetadata(
  project: { readonly metadata?: unknown } | null,
): ProjectOnboardingAssessment | null {
  const parsed = ProjectOnboardingAssessmentSchema.safeParse(
    typeof project?.metadata === 'object' && project.metadata !== null
      ? (project.metadata as { readonly onboardingAssessment?: unknown }).onboardingAssessment
      : undefined,
  );
  return parsed.success ? parsed.data : null;
}

export function projectProfileDisplay(profile?: ProjectProfile | null): ProjectProfileDisplay {
  return profile ? projectProfileDisplayByProfile[profile] : projectProfileDisplayByProfile.unknown;
}

export function projectDisplayProfile(
  project: { readonly metadata?: unknown } | null,
): ProjectProfileDisplay {
  return projectProfileDisplay(projectOnboardingAssessmentFromMetadata(project)?.profile);
}

export function projectCapabilityDisplay(capability: ProjectCapability): ProjectCapabilityDisplay {
  return projectCapabilityDisplayByCapability[capability];
}

export function projectCapabilityDisplays(
  capabilities: readonly ProjectCapability[] | null | undefined,
): ProjectCapabilityDisplay[] {
  const uniqueCapabilities = new Set(capabilities ?? []);
  return [...uniqueCapabilities].map(projectCapabilityDisplay);
}

export function projectCapabilitySummary(
  capabilities: readonly ProjectCapability[] | null | undefined,
  limit = 3,
): string {
  const labels = projectCapabilityDisplays(capabilities).map((capability) => capability.label);
  if (labels.length === 0) return 'Files and chat';
  const visible = labels.slice(0, limit);
  const hiddenCount = labels.length - visible.length;
  return hiddenCount > 0 ? `${visible.join(', ')} +${hiddenCount}` : visible.join(', ');
}

export function buildProjectIdeHref(projectId: string, sessionId?: string | null): string {
  const params = [`${projectReopenSearchParam}=${encodeURIComponent(projectId)}`];
  if (sessionId) {
    params.push(`${sessionReopenSearchParam}=${encodeURIComponent(sessionId)}`);
  }
  return `/ide?${params.join('&')}`;
}

export function buildProjectChatHref(projectId: string, sessionId?: string | null): string {
  const params = [`${projectReopenSearchParam}=${encodeURIComponent(projectId)}`];
  if (sessionId) {
    params.push(`${sessionReopenSearchParam}=${encodeURIComponent(sessionId)}`);
  }
  return `/?${params.join('&')}`;
}

export function buildPersonalChatHref(): string {
  return `/?${workspaceModeSearchParam}=${personalChatModeSearchValue}`;
}
