'use client';

import type {
  Agent,
  ModelConfig,
  ProjectOnboardingDraft,
  ProjectDesktopRecord,
  SensorDashboardResponse,
  SessionRecord,
} from '@agent-platform/contracts';
import {
  ProjectOnboardingDraftSchema,
  ProjectOnboardingStateSchema,
} from '@agent-platform/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Chat } from '../components/chat/chat';
import { AgentModelProvider } from '../components/chat/agent-model-context';
import { SessionDropdown } from '../components/chat/session-dropdown';
import type { ApprovalDecision } from '@/hooks/use-harness-chat';
import { useHarnessChat } from '@/hooks/use-harness-chat';
import { useContextAttachments } from '@/hooks/use-context-attachments';
import { useSessions } from '@/hooks/use-sessions';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import {
  ProjectInstructionsApprovalNotice,
  ProjectInstructionsRejectedNotice,
  ProjectInstructionsReview,
} from '@/components/project/project-instructions-review';
import { pickDefaultAgentForMode } from '@/lib/default-agent';
import { resolveChatModelConfigId } from '@/lib/modelSelection';
import {
  buildPersonalChatHref,
  buildProjectIdeHref,
  createWorkspaceNavigationState,
  desktopProjectIsAvailable,
  personalChatModeSearchValue,
  projectCapabilitySummary,
  projectDisplayProfile,
  projectOnboardingAssessmentFromMetadata,
  projectReopenSearchParam,
  projectReopenRequestedEvent,
  recentProjectsUpdatedEvent,
  sessionReopenSearchParam,
  workspaceHomeRequestedEvent,
  workspaceEntryCopy,
  workspaceModeSearchParam,
  workspacePersonalChatRequestedEvent,
} from '@/lib/project-navigation';
import {
  bindProjectSession,
  hasDesktopProjectBridge,
  loadRecentDesktopProjects,
  selectAndRegisterDesktopProject,
} from '@/lib/desktop-projects';

type WorkspaceMode = 'chat' | 'project-chat';
type HomeEntryScreenProps = Readonly<{
  isDesktopProjectBridgeAvailable: boolean;
  isOpeningProject: boolean;
  onOpenChat: () => void;
  onOpenProject: () => void;
}>;
type ErrorBannerProps = Readonly<{
  message: string | null;
  onDismiss: () => void;
}>;
type ProjectChatHeaderProps = Readonly<{
  project: ProjectDesktopRecord | null;
  sessionId: string | null;
  onReturnHome: () => void;
}>;
type ApprovedProjectInstructions = Readonly<{
  projectId: string;
  targetPath: string;
}>;
type RejectedProjectInstructions = Readonly<{
  projectId: string;
  targetPath: string;
}>;

function getInputStatusText(
  hasPendingApproval: boolean,
  selectedMode: WorkspaceMode | null,
  sessionId: string | null,
) {
  if (hasPendingApproval) {
    return 'Resolve the pending approval before sending another message.';
  }
  if (selectedMode === 'project-chat' && !sessionId) {
    return 'Opening Project chat...';
  }
  return undefined;
}

function getWorkspaceSurface(selectedMode: WorkspaceMode | null) {
  if (selectedMode === 'project-chat') {
    return 'project-chat';
  }
  if (selectedMode === 'chat') {
    return 'chat';
  }
  return 'home';
}

function projectOnboardingDraft(
  project: ProjectDesktopRecord | null,
): ProjectOnboardingDraft | null {
  const metadata = project?.metadata as Record<string, unknown> | undefined;
  const parsed = ProjectOnboardingDraftSchema.safeParse(metadata?.['onboardingDraft']);
  return parsed.success ? parsed.data : null;
}

function projectOnboardingIsApproved(project: ProjectDesktopRecord | null): boolean {
  const parsed = ProjectOnboardingStateSchema.safeParse(project?.metadata.onboardingState);
  return parsed.success && parsed.data === 'approved';
}

function projectOnboardingApprovalTargetPath(project: ProjectDesktopRecord): string {
  const metadata = project.metadata as Record<string, unknown>;
  const approval = metadata['onboardingApproval'];
  if (typeof approval !== 'object' || approval === null) return 'AGENTS.md';
  const targetPath = (approval as Record<string, unknown>)['targetPath'];
  return typeof targetPath === 'string' && targetPath.trim() ? targetPath : 'AGENTS.md';
}

function HomeEntryScreen({
  isDesktopProjectBridgeAvailable,
  isOpeningProject,
  onOpenChat,
  onOpenProject,
}: HomeEntryScreenProps) {
  return (
    <main className="flex h-full min-h-0 flex-col bg-background">
      <section className="border-b border-border px-6 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1">
          <h2 className="text-2xl font-semibold text-foreground">{workspaceEntryCopy.title}</h2>
          <p className="text-sm text-muted-foreground">{workspaceEntryCopy.description}</p>
        </div>
      </section>
      <section className="flex flex-1 items-center px-6 py-8">
        <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
          <button
            type="button"
            className="group flex min-h-44 flex-col items-start justify-between rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary"
            onClick={onOpenChat}
          >
            <span>
              <span className="block text-lg font-semibold text-foreground">
                {workspaceEntryCopy.chatTitle}
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                {workspaceEntryCopy.chatDescription}
              </span>
            </span>
            <span className="text-sm font-medium text-primary">
              {workspaceEntryCopy.chatProfile}
            </span>
          </button>
          {isDesktopProjectBridgeAvailable ? (
            <button
              type="button"
              className="group flex min-h-44 flex-col items-start justify-between rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary disabled:opacity-70"
              onClick={onOpenProject}
              disabled={isOpeningProject}
            >
              <span>
                <span className="block text-lg font-semibold text-foreground">
                  {workspaceEntryCopy.projectTitle}
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                  {workspaceEntryCopy.projectDescription}
                </span>
              </span>
              <span className="text-sm font-medium text-primary">
                {isOpeningProject ? 'Opening...' : workspaceEntryCopy.projectProfile}
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="group flex min-h-44 flex-col items-start justify-between rounded-lg border border-border bg-card p-5 text-left opacity-75"
              disabled
            >
              <span>
                <span className="block text-lg font-semibold text-foreground">
                  {workspaceEntryCopy.projectTitle}
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                  {workspaceEntryCopy.projectDescription}
                </span>
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                Open this app on desktop to choose a Project folder.
              </span>
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="shrink-0 z-50 bg-destructive/15 border-b border-destructive/30 text-destructive px-4 py-2 text-sm">
      {message}
      <button type="button" className="ml-2 underline" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

function ProjectChatHeader({ project, sessionId, onReturnHome }: ProjectChatHeaderProps) {
  if (!project) {
    return null;
  }

  const profile = projectDisplayProfile(project);
  const assessment = projectOnboardingAssessmentFromMetadata(project);

  return (
    <div className="ml-auto flex min-w-0 items-center gap-3">
      <div className="min-w-0 text-right">
        <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
          Project / Chat
        </div>
        <div className="truncate text-sm font-medium text-foreground">{project.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {profile.label} - {projectCapabilitySummary(assessment?.capabilities)}
        </div>
      </div>
      <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={onReturnHome}>
        Workspaces
      </Button>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href={buildProjectIdeHref(project.id, sessionId)}>Open IDE</Link>
      </Button>
    </div>
  );
}

export default function HomePage() {
  const [selectedMode, setSelectedMode] = useState<WorkspaceMode | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectDesktopRecord | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedModelConfigId, setSelectedModelConfigId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sensorDashboard, setSensorDashboard] = useState<SensorDashboardResponse | null>(null);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [isDesktopProjectBridgeAvailable, setIsDesktopProjectBridgeAvailable] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [isApprovingProjectInstructions, setIsApprovingProjectInstructions] = useState(false);
  const [isRejectingProjectInstructions, setIsRejectingProjectInstructions] = useState(false);
  const [approvedProjectInstructions, setApprovedProjectInstructions] =
    useState<ApprovedProjectInstructions | null>(null);
  const [rejectedProjectInstructions, setRejectedProjectInstructions] =
    useState<RejectedProjectInstructions | null>(null);
  const attemptedProjectReopenIdRef = useRef<string | null>(null);

  const {
    messages,
    sendMessage,
    status,
    error,
    setError,
    criticEventsByMessage,
    thinkingByMessage,
    toolEventsByMessage,
    approvalEventsByMessage,
    decideApproval,
    hasPendingApproval,
  } = useHarnessChat(sessionId, isResuming);
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useSessions();
  const {
    attachments,
    warnings: attachmentWarnings,
    formattedContext,
    addFiles,
    removeAttachment,
    clearAll: clearAttachments,
  } = useContextAttachments();

  const bootstrapAgents = useCallback(async () => {
    setLoadError(null);
    try {
      const [agentList, configList] = await Promise.all([
        apiGet<Agent[]>(apiPath('agents')),
        apiGet<ModelConfig[]>(apiPath('model-configs')),
      ]);
      const nextAgents = agentList ?? [];
      setAgents(nextAgents);
      const def = pickDefaultAgentForMode(nextAgents, 'chat');
      const withKey = (configList ?? []).filter((c) => c.hasApiKey);
      if (def) {
        setSelectedAgentId((prev) => prev ?? def.id);
      }
      // Only show configs that have an API key stored; default to the selected agent's config.
      setModelConfigs(withKey);
      setSelectedModelConfigId((prev) =>
        prev && withKey.some((config) => config.id === prev)
          ? prev
          : resolveChatModelConfigId(def?.id ?? null, nextAgents, withKey),
      );
    } catch (e) {
      setLoadError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    bootstrapAgents().catch(() => {});
  }, [bootstrapAgents]);

  useEffect(() => {
    setIsDesktopProjectBridgeAvailable(hasDesktopProjectBridge());
  }, []);

  const refreshSensors = useCallback(async (id: string, retry = false) => {
    setSensorLoading(true);
    setSensorError(null);
    try {
      const path = apiPath('sessions', id, 'sensors');
      const data = retry
        ? await apiPost<SensorDashboardResponse>(`${path}/retry`, {})
        : await apiGet<SensorDashboardResponse>(path);
      setSensorDashboard(data ?? null);
    } catch (e) {
      setSensorError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setSensorLoading(false);
    }
  }, []);

  const createSessionForAgent = useCallback(
    async (agentId: string) => {
      setSessionError(null);
      setIsResuming(false);
      try {
        const session = await apiPost<SessionRecord>(apiPath('sessions'), {
          agentId,
          mode: 'chat',
        });
        if (!session?.id) {
          setSessionError('Failed to create session');
          setSessionId(null);
          setSensorDashboard(null);
          return;
        }
        setSessionId(session.id);
        await refreshSensors(session.id);
      } catch (e) {
        setSessionError(e instanceof ApiRequestError ? e.message : String(e));
        setSessionId(null);
        setSensorDashboard(null);
      }
    },
    [refreshSensors],
  );

  useEffect(() => {
    if (selectedMode !== 'chat') return;
    if (!selectedAgentId) return;
    // Only create a new session when agent selection changes organically
    // (not via resume, which sets sessionId directly)
    if (!isResuming) {
      createSessionForAgent(selectedAgentId).catch(() => {});
    }
  }, [selectedAgentId, createSessionForAgent, isResuming, selectedMode]);

  const handleAgentChange = useCallback(
    (agentId: string) => {
      setIsResuming(false);
      setSelectedAgentId(agentId);
      setSelectedModelConfigId(resolveChatModelConfigId(agentId, agents, modelConfigs));
    },
    [agents, modelConfigs],
  );

  const handleOpenChat = useCallback(
    (options?: { readonly updateUrl?: boolean }) => {
      if (options?.updateUrl !== false && globalThis.window !== undefined) {
        globalThis.window.history.pushState(null, '', buildPersonalChatHref());
      }
      setSelectedMode('chat');
      setActiveProject(null);
      setSessionId(null);
      setSensorDashboard(null);
      setSessionError(null);
      setIsResuming(false);
      const def = pickDefaultAgentForMode(agents, 'chat');
      if (def) {
        setSelectedAgentId(def.id);
        setSelectedModelConfigId(resolveChatModelConfigId(def.id, agents, modelConfigs));
      }
    },
    [agents, modelConfigs],
  );

  const handleReturnHome = useCallback(() => {
    if (globalThis.window !== undefined) {
      globalThis.window.history.pushState(null, '', '/');
    }
    setSelectedMode(null);
    setActiveProject(null);
    setSessionId(null);
    setSensorDashboard(null);
    setSessionError(null);
    setIsResuming(false);
  }, []);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const returnHome = () => {
      handleReturnHome();
    };
    globalThis.window.addEventListener(workspaceHomeRequestedEvent, returnHome);
    return () => {
      globalThis.window.removeEventListener(workspaceHomeRequestedEvent, returnHome);
    };
  }, [handleReturnHome]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const openPersonalChat = () => {
      handleOpenChat({ updateUrl: false });
    };
    globalThis.window.addEventListener(workspacePersonalChatRequestedEvent, openPersonalChat);
    return () => {
      globalThis.window.removeEventListener(workspacePersonalChatRequestedEvent, openPersonalChat);
    };
  }, [handleOpenChat]);

  const bindActiveProjectSession = useCallback(
    async (agentId: string, projectId: string) => {
      setSessionError(null);
      try {
        const result = await bindProjectSession({
          agentId,
          projectId,
        });
        const session = result?.session;
        if (!session?.id) {
          setSessionError('Failed to create Project chat session');
          setSessionId(null);
          setSensorDashboard(null);
          return;
        }
        setSessionId(session.id);
        await refreshSensors(session.id);
      } catch (error) {
        setSessionError(
          error instanceof ApiRequestError ? error.message : 'Failed to open Project chat',
        );
        setSessionId(null);
        setSensorDashboard(null);
      }
    },
    [refreshSensors],
  );

  const openProjectChat = useCallback(
    (project: ProjectDesktopRecord) => {
      setSelectedMode('project-chat');
      setActiveProject(project);
      setSessionId(null);
      setSensorDashboard(null);
      setSessionError(null);
      setIsResuming(false);
      const def = pickDefaultAgentForMode(agents, 'project');
      const nextAgentId = def?.id ?? selectedAgentId;
      if (def) {
        setSelectedAgentId(def.id);
        setSelectedModelConfigId(resolveChatModelConfigId(def.id, agents, modelConfigs));
      }
      return nextAgentId ?? null;
    },
    [agents, modelConfigs, selectedAgentId],
  );

  const handleOpenProject = useCallback(async () => {
    setIsOpeningProject(true);
    setSessionError(null);
    try {
      const result = await selectAndRegisterDesktopProject();
      if (!result) return;
      const agentId = openProjectChat(result.project);
      if (agentId) {
        await bindActiveProjectSession(agentId, result.project.id);
      }
      if (globalThis.window !== undefined) {
        globalThis.window.dispatchEvent(new Event(recentProjectsUpdatedEvent));
      }
    } catch (error) {
      setSessionError(error instanceof ApiRequestError ? error.message : 'Failed to open Project');
    } finally {
      setIsOpeningProject(false);
    }
  }, [bindActiveProjectSession, openProjectChat]);

  const reopenRecentProject = useCallback(
    async (projectId: string, requestedSessionId: string | null) => {
      try {
        const projects = await loadRecentDesktopProjects();
        const project = projects.find((candidate) => candidate.id === projectId);
        if (!project || !desktopProjectIsAvailable(project)) {
          setSessionError('This recent Project is no longer available. Open it again.');
          return;
        }
        const agentId = openProjectChat(project);
        if (requestedSessionId) {
          const session = await apiGet<SessionRecord>(apiPath('sessions', requestedSessionId));
          if (session?.mode === 'project' && session.projectId === project.id) {
            setSelectedAgentId(session.agentId);
            setSelectedModelConfigId(
              resolveChatModelConfigId(session.agentId, agents, modelConfigs),
            );
            setSessionId(session.id);
            await refreshSensors(session.id);
            return;
          }
        }
        if (agentId) {
          await bindActiveProjectSession(agentId, project.id);
        }
      } catch (error) {
        setSessionError(
          error instanceof ApiRequestError ? error.message : 'Failed to reopen Project',
        );
      }
    },
    [agents, bindActiveProjectSession, modelConfigs, openProjectChat, refreshSensors],
  );

  const refreshActiveProject = useCallback(async () => {
    if (!activeProject?.id) return;
    const project = await apiGet<ProjectDesktopRecord>(apiPath('projects', activeProject.id));
    if (project) setActiveProject(project);
  }, [activeProject?.id]);

  const handleApproveProjectInstructions = useCallback(async () => {
    if (!activeProject?.id) return;
    setIsApprovingProjectInstructions(true);
    setSessionError(null);
    try {
      const project = await apiPost<ProjectDesktopRecord>(
        apiPath('projects', activeProject.id, 'onboarding', 'approve'),
        { decision: 'approve', reviewer: 'User' },
      );
      if (!project) throw new ApiRequestError('Failed to approve Project instructions', 500);
      setActiveProject(project);
      setApprovedProjectInstructions({
        projectId: project.id,
        targetPath: projectOnboardingApprovalTargetPath(project),
      });
      setRejectedProjectInstructions(null);
      if (globalThis.window !== undefined) {
        globalThis.window.dispatchEvent(new Event(recentProjectsUpdatedEvent));
      }
    } catch (error) {
      setSessionError(
        error instanceof ApiRequestError ? error.message : 'Failed to approve Project instructions',
      );
    } finally {
      setIsApprovingProjectInstructions(false);
    }
  }, [activeProject?.id]);

  const handleRejectProjectInstructions = useCallback(async () => {
    if (!activeProject?.id) return;
    const draft = projectOnboardingDraft(activeProject);
    setIsRejectingProjectInstructions(true);
    setSessionError(null);
    try {
      const project = await apiPost<ProjectDesktopRecord>(
        apiPath('projects', activeProject.id, 'onboarding', 'review'),
        {
          decision: 'reject',
          reviewer: 'User',
          comment: 'Rejected from Project Chat review.',
        },
      );
      if (!project) throw new ApiRequestError('Failed to reject Project instructions', 500);
      setActiveProject(project);
      setApprovedProjectInstructions(null);
      setRejectedProjectInstructions({
        projectId: project.id,
        targetPath: draft?.targetPath ?? 'AGENTS.md',
      });
      if (globalThis.window !== undefined) {
        globalThis.window.dispatchEvent(new Event(recentProjectsUpdatedEvent));
      }
    } catch (error) {
      setSessionError(
        error instanceof ApiRequestError ? error.message : 'Failed to reject Project instructions',
      );
    } finally {
      setIsRejectingProjectInstructions(false);
    }
  }, [activeProject]);

  useEffect(() => {
    if (!approvedProjectInstructions) return;
    if (approvedProjectInstructions.projectId !== activeProject?.id) {
      setApprovedProjectInstructions(null);
    }
  }, [activeProject?.id, approvedProjectInstructions]);

  useEffect(() => {
    if (!rejectedProjectInstructions) return;
    if (rejectedProjectInstructions.projectId !== activeProject?.id) {
      setRejectedProjectInstructions(null);
    }
  }, [activeProject?.id, rejectedProjectInstructions]);

  useEffect(() => {
    if (selectedMode !== 'project-chat') return;
    if (selectedAgentId || agents.length === 0) return;
    const def = pickDefaultAgentForMode(agents, 'project');
    if (!def) return;
    setSelectedAgentId(def.id);
    setSelectedModelConfigId(resolveChatModelConfigId(def.id, agents, modelConfigs));
  }, [agents, modelConfigs, selectedAgentId, selectedMode]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const params = new URLSearchParams(globalThis.window.location.search);
    const projectId = params.get(projectReopenSearchParam);
    const requestedSessionId = params.get(sessionReopenSearchParam);
    if (!projectId) return;
    if (selectedMode === 'project-chat' && activeProject?.id === projectId) return;
    if (attemptedProjectReopenIdRef.current === projectId) return;
    attemptedProjectReopenIdRef.current = projectId;

    void reopenRecentProject(projectId, requestedSessionId);
  }, [activeProject, reopenRecentProject, selectedMode]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const params = new URLSearchParams(globalThis.window.location.search);
    const requestedMode = params.get(workspaceModeSearchParam);
    const projectId = params.get(projectReopenSearchParam);
    if (projectId || requestedMode !== personalChatModeSearchValue || selectedMode === 'chat') {
      return;
    }
    handleOpenChat({ updateUrl: false });
  }, [handleOpenChat, selectedMode]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    const handleProjectReopenRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: unknown }>).detail;
      if (typeof detail?.projectId !== 'string') return;
      void reopenRecentProject(detail.projectId, null);
    };

    globalThis.window.addEventListener(projectReopenRequestedEvent, handleProjectReopenRequest);
    return () => {
      globalThis.window.removeEventListener(
        projectReopenRequestedEvent,
        handleProjectReopenRequest,
      );
    };
  }, [reopenRecentProject]);

  const handleSelectSession = useCallback(
    (session: SessionRecord) => {
      setIsResuming(true);
      setSelectedMode(session.mode === 'project' ? 'project-chat' : 'chat');
      setSelectedAgentId(session.agentId);
      setSelectedModelConfigId(resolveChatModelConfigId(session.agentId, agents, modelConfigs));
      setSessionId(session.id);
      refreshSensors(session.id).catch(() => {});
    },
    [agents, modelConfigs, refreshSensors],
  );

  const handleNewChatForAgent = useCallback(
    (agentId: string) => {
      setIsResuming(false);
      setSelectedAgentId(agentId);
      setSelectedModelConfigId(resolveChatModelConfigId(agentId, agents, modelConfigs));
      createSessionForAgent(agentId).catch(() => {});
    },
    [agents, createSessionForAgent, modelConfigs],
  );

  const isLoading = status === 'streaming';
  const canSend = Boolean(sessionId) && !hasPendingApproval;
  const inputStatusText = getInputStatusText(hasPendingApproval, selectedMode, sessionId);
  const onboardingDraft = projectOnboardingDraft(activeProject);
  const showProjectInstructionReview =
    selectedMode === 'project-chat' &&
    Boolean(onboardingDraft) &&
    !projectOnboardingIsApproved(activeProject);
  const showProjectInstructionApprovalNotice =
    selectedMode === 'project-chat' &&
    Boolean(approvedProjectInstructions) &&
    approvedProjectInstructions?.projectId === activeProject?.id &&
    !showProjectInstructionReview;
  const showProjectInstructionRejectedNotice =
    selectedMode === 'project-chat' &&
    Boolean(rejectedProjectInstructions) &&
    rejectedProjectInstructions?.projectId === activeProject?.id &&
    !showProjectInstructionReview;
  const navigationState = createWorkspaceNavigationState({
    surface: getWorkspaceSurface(selectedMode),
    projectId: activeProject?.id,
    sessionId,
  });

  useEffect(() => {
    if (selectedMode !== 'project-chat') return;
    if (!selectedAgentId || !activeProject?.id) return;
    bindActiveProjectSession(selectedAgentId, activeProject.id).catch(() => {});
  }, [activeProject?.id, bindActiveProjectSession, selectedAgentId, selectedMode]);

  const handleSend = useCallback(
    (text: string) => {
      const messageForApi = formattedContext ? `${formattedContext}\n${text}` : text;
      const displayText = formattedContext ? text : undefined;
      sendMessage(messageForApi, displayText, selectedModelConfigId)
        .then(async () => {
          await refreshSessions();
          if (sessionId) await refreshSensors(sessionId);
          if (selectedMode === 'project-chat' && activeProject?.id) {
            await refreshActiveProject();
          }
        })
        .catch(() => {});
      clearAttachments();
    },
    [
      sendMessage,
      refreshSessions,
      formattedContext,
      clearAttachments,
      selectedModelConfigId,
      sessionId,
      refreshSensors,
      selectedMode,
      activeProject?.id,
      refreshActiveProject,
    ],
  );

  const handleApprovalDecision = useCallback(
    (approvalRequestId: string, decision: ApprovalDecision) => {
      decideApproval(approvalRequestId, decision, selectedModelConfigId);
    },
    [decideApproval, selectedModelConfigId],
  );

  if (!selectedMode) {
    return (
      <HomeEntryScreen
        isDesktopProjectBridgeAvailable={isDesktopProjectBridgeAvailable}
        isOpeningProject={isOpeningProject}
        onOpenChat={() => {
          handleOpenChat();
        }}
        onOpenProject={() => {
          handleOpenProject().catch(() => {});
        }}
      />
    );
  }

  const alertMessage = [loadError, sessionError, error].filter(Boolean).join(' — ') || null;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        <ErrorBanner
          message={alertMessage}
          onDismiss={() => {
            setError(null);
          }}
        />
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50"
          data-workspace-surface={navigationState.surface}
          data-workspace-scope={navigationState.scope}
        >
          <SessionDropdown
            sessions={sessions}
            agents={agents}
            activeSessionId={sessionId}
            selectedAgentId={selectedAgentId}
            onSelectSession={handleSelectSession}
            onNewChatForAgent={handleNewChatForAgent}
            loading={sessionsLoading}
            disabled={isLoading}
          />
          {selectedMode === 'project-chat' && (
            <ProjectChatHeader
              project={activeProject}
              sessionId={sessionId}
              onReturnHome={handleReturnHome}
            />
          )}
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <AgentModelProvider
            value={{
              agents,
              modelConfigs,
              selectedAgentId,
              selectedModelConfigId,
              onSelectAgent: handleAgentChange,
              onSelectModelConfig: setSelectedModelConfigId,
              selectorDisabled: isLoading,
            }}
          >
            <Chat
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              canSend={canSend}
              inputStatusText={inputStatusText}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              onClearAttachments={clearAttachments}
              attachmentWarnings={attachmentWarnings}
              criticEventsByMessage={criticEventsByMessage}
              thinkingByMessage={thinkingByMessage}
              toolEventsByMessage={toolEventsByMessage}
              approvalEventsByMessage={approvalEventsByMessage}
              onApprovalDecision={handleApprovalDecision}
              sensorDashboard={sensorDashboard}
              sensorLoading={sensorLoading}
              sensorError={sensorError}
              onRetrySensors={() => {
                if (sessionId) refreshSensors(sessionId, true).catch(() => {});
              }}
              inputPlaceholder={
                selectedMode === 'project-chat' ? 'Ask about this Project...' : undefined
              }
              emptyStateTitle={
                selectedMode === 'project-chat'
                  ? (activeProject?.name ?? 'Project chat')
                  : undefined
              }
              emptyStateDescription={
                selectedMode === 'project-chat'
                  ? 'Tell the assistant what you want done in this Project.'
                  : undefined
              }
              conversationAccessory={
                showProjectInstructionReview && onboardingDraft ? (
                  <ProjectInstructionsReview
                    draft={onboardingDraft}
                    isApproving={isApprovingProjectInstructions}
                    isRejecting={isRejectingProjectInstructions}
                    onApprove={handleApproveProjectInstructions}
                    onReject={handleRejectProjectInstructions}
                  />
                ) : showProjectInstructionApprovalNotice && approvedProjectInstructions ? (
                  <ProjectInstructionsApprovalNotice
                    targetPath={approvedProjectInstructions.targetPath}
                  />
                ) : showProjectInstructionRejectedNotice && rejectedProjectInstructions ? (
                  <ProjectInstructionsRejectedNotice
                    targetPath={rejectedProjectInstructions.targetPath}
                  />
                ) : null
              }
            />
          </AgentModelProvider>
        </div>
      </div>
    </div>
  );
}
