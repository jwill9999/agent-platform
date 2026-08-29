'use client';

import type {
  Agent,
  ModelConfig,
  ProjectOnboardingDraft,
  ProjectDesktopRecord,
  ReadinessResponse,
  SensorDashboardResponse,
  SessionRecord,
} from '@agent-platform/contracts';
import {
  ProjectOnboardingDraftSchema,
  ProjectOnboardingStateSchema,
} from '@agent-platform/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Chat } from '../components/chat/chat';
import { AgentModelProvider } from '../components/chat/agent-model-context';
import { SessionDropdown } from '../components/chat/session-dropdown';
import type { ApprovalDecision } from '@/hooks/use-harness-chat';
import { useHarnessChat } from '@/hooks/use-harness-chat';
import { useContextAttachments } from '@/hooks/use-context-attachments';
import { useSessions } from '@/hooks/use-sessions';
import { apiGet, apiPath, apiPost, apiPut, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ProjectInstructionsApprovalNotice,
  ProjectInstructionsRejectedNotice,
  ProjectInstructionsReview,
} from '@/components/project/project-instructions-review';
import { ProjectBranchSelector } from '@/components/project/project-branch-selector';
import { ProjectEvidenceRail } from '@/components/project/project-evidence-rail';
import { ProjectTerminalDock } from '@/components/project/project-terminal-dock';
import {
  ProjectWebViewPanel,
  type ProjectWebViewMode,
} from '@/components/project/project-webview-panel';
import { pickDefaultAgentForMode } from '@/lib/default-agent';
import { resolveChatModelConfigId, usableModelConfigs } from '@/lib/modelSelection';
import {
  buildPersonalChatHref,
  commandRunnerStatusDescription,
  commandRunnerStatusLabel,
  createWorkspaceNavigationState,
  desktopProjectIsAvailable,
  desktopProjectFolderLabel,
  mostRecentTitledProjectSession,
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
  workspaceNavigationChangedEvent,
  workspacePersonalChatRequestedEvent,
} from '@/lib/project-navigation';
import {
  bindProjectSession,
  createAndRegisterDesktopProject,
  hasDesktopProjectBridge,
  hasDesktopProjectIdeBridge,
  loadRecentDesktopProjects,
  openDesktopProjectIde,
  selectAndRegisterDesktopProject,
} from '@/lib/desktop-projects';
import {
  ChevronRight,
  FolderOpen,
  FolderPlus,
  MessageSquare,
  Terminal as TerminalIcon,
} from 'lucide-react';

type WorkspaceMode = 'chat' | 'project-chat';
type HomeEntryScreenProps = Readonly<{
  isCreatingProject: boolean;
  isDesktopProjectBridgeAvailable: boolean;
  isOpeningProject: boolean;
  onCreateProject: () => void;
  onOpenChat: () => void;
  onOpenProject: () => void;
}>;
type NewProjectDialogProps = Readonly<{
  error: string | null;
  isCreating: boolean;
  isDesktopProjectBridgeAvailable: boolean;
  name: string;
  onCreate: () => void;
  onNameChange: (name: string) => void;
  onOpenChange: (open: boolean) => void;
  onUseExistingFolder: () => void;
  open: boolean;
}>;
type ErrorBannerProps = Readonly<{
  message: string | null;
  onDismiss: () => void;
}>;
type ProjectChatHeaderProps = Readonly<{
  commandRunner: CommandRunnerDisplay | null;
  project: ProjectDesktopRecord | null;
  onReturnHome: () => void;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  canOpenIde: boolean;
  isOpeningIde: boolean;
  onOpenIde: () => void;
}>;
type CommandRunnerDisplay = Readonly<{
  canExecute: boolean;
  message: string;
  mode: string;
  reason: string;
  status: string;
}>;
type ProjectInstructionsDecision = Readonly<{
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
  const metadata = project?.metadata as Record<string, unknown> | undefined;
  const parsed = ProjectOnboardingStateSchema.safeParse(metadata?.['onboardingState']);
  return parsed.success && parsed.data === 'approved';
}

function projectOnboardingApprovalTargetPath(project: ProjectDesktopRecord): string {
  const metadata = project.metadata as Record<string, unknown>;
  const approval = metadata['onboardingApproval'];
  if (typeof approval !== 'object' || approval === null) return 'AGENTS.md';
  const targetPath = (approval as Record<string, unknown>)['targetPath'];
  return typeof targetPath === 'string' && targetPath.trim() ? targetPath : 'AGENTS.md';
}

function projectInstructionsDecisionApplies(
  decision: ProjectInstructionsDecision | null,
  project: ProjectDesktopRecord | null,
): decision is ProjectInstructionsDecision {
  return Boolean(decision) && decision?.projectId === project?.id;
}

function projectChatPlaceholder(selectedMode: WorkspaceMode | null): string | undefined {
  return selectedMode === 'project-chat' ? 'Ask about this Project...' : undefined;
}

function projectChatEmptyStateTitle(
  selectedMode: WorkspaceMode | null,
  project: ProjectDesktopRecord | null,
): string | undefined {
  if (selectedMode !== 'project-chat') return undefined;
  return project?.name ?? 'Project chat';
}

function projectChatEmptyStateDescription(selectedMode: WorkspaceMode | null): string | undefined {
  if (selectedMode !== 'project-chat') return undefined;
  return 'Tell the assistant what you want done in this Project.';
}

function commandRunnerDisplayFromReadiness(readiness: ReadinessResponse): CommandRunnerDisplay {
  const commandRunner = readiness.checks['commandRunner'];
  const details = commandRunner?.details ?? {};
  const status = details['status'] ?? commandRunner?.status ?? 'unknown';
  const mode = details['mode'] ?? 'unknown';
  return {
    canExecute: details['canExecute'] === 'true',
    message: details['message'] ?? commandRunner?.error ?? 'Command runner status unavailable.',
    mode,
    reason: details['reason'] ?? '',
    status,
  };
}

function commandRunnerStatusColor(commandRunner: CommandRunnerDisplay): string {
  if (commandRunner.canExecute) return 'bg-emerald-500';
  if (commandRunner.status === 'failed') return 'bg-destructive';
  return 'bg-amber-500';
}

async function fetchCommandRunnerDisplay(): Promise<CommandRunnerDisplay> {
  const response = await fetch('/api/health/ready', { cache: 'no-store' });
  const payload = (await response.json()) as ReadinessResponse;
  if (!response.ok && !payload.checks?.['commandRunner']) {
    return {
      canExecute: false,
      message: `Command runner health check failed (${response.status}).`,
      mode: 'unknown',
      reason: 'health_check_failed',
      status: 'unavailable',
    };
  }
  return commandRunnerDisplayFromReadiness(payload);
}

type ProjectInstructionsConversationAccessoryProps = Readonly<{
  draft: ProjectOnboardingDraft | null;
  approved: ProjectInstructionsDecision | null;
  rejected: ProjectInstructionsDecision | null;
  project: ProjectDesktopRecord | null;
  selectedMode: WorkspaceMode | null;
  isApproving: boolean;
  isRejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDismissApproved: () => void;
  onDismissRejected: () => void;
}>;

function ProjectInstructionsConversationAccessory({
  draft,
  approved,
  rejected,
  project,
  selectedMode,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
  onDismissApproved,
  onDismissRejected,
}: ProjectInstructionsConversationAccessoryProps) {
  if (selectedMode !== 'project-chat') return null;
  if (draft && !projectOnboardingIsApproved(project)) {
    return (
      <ProjectInstructionsReview
        draft={draft}
        isApproving={isApproving}
        isRejecting={isRejecting}
        onApprove={onApprove}
        onReject={onReject}
      />
    );
  }
  if (projectInstructionsDecisionApplies(approved, project)) {
    return (
      <ProjectInstructionsApprovalNotice
        targetPath={approved.targetPath}
        onDismiss={onDismissApproved}
      />
    );
  }
  if (projectInstructionsDecisionApplies(rejected, project)) {
    return (
      <ProjectInstructionsRejectedNotice
        targetPath={rejected.targetPath}
        onDismiss={onDismissRejected}
      />
    );
  }
  return null;
}

function HomeEntryScreen({
  isCreatingProject,
  isDesktopProjectBridgeAvailable,
  isOpeningProject,
  onCreateProject,
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
        <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-2">
          <button
            type="button"
            className="group flex min-h-52 flex-col items-start justify-between rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary"
            onClick={onOpenChat}
          >
            <span>
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-muted-foreground group-hover:text-primary">
                <MessageSquare className="h-5 w-5" aria-hidden />
              </span>
              <span className="block text-lg font-semibold leading-7 text-foreground">
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
          <div className="flex min-h-52 flex-col justify-between rounded-lg border border-border bg-card p-5">
            <div>
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <FolderOpen className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold leading-7 text-foreground">
                {workspaceEntryCopy.projectTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {workspaceEntryCopy.projectDescription}
              </p>
            </div>
            <div className="mt-5 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={onCreateProject}
                  disabled={!isDesktopProjectBridgeAvailable || isCreatingProject}
                >
                  <FolderPlus className="h-4 w-4" aria-hidden />
                  {isCreatingProject ? 'Creating...' : workspaceEntryCopy.projectCreateAction}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={onOpenProject}
                  disabled={!isDesktopProjectBridgeAvailable || isOpeningProject}
                >
                  <FolderOpen className="h-4 w-4" aria-hidden />
                  {isOpeningProject ? 'Opening...' : workspaceEntryCopy.projectOpenAction}
                </Button>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {isDesktopProjectBridgeAvailable
                  ? workspaceEntryCopy.projectProfile
                  : 'Open the desktop app to choose a project folder.'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function NewProjectDialog({
  error,
  isCreating,
  isDesktopProjectBridgeAvailable,
  name,
  onCreate,
  onNameChange,
  onOpenChange,
  onUseExistingFolder,
  open,
}: NewProjectDialogProps) {
  const [step, setStep] = useState<'choices' | 'start'>('choices');

  useEffect(() => {
    if (open) setStep('choices');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'choices' ? (
          <>
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
              <DialogDescription>
                Choose how you want to start. Projects are folders on your computer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <button
                type="button"
                className="rounded-lg border border-border p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setStep('start')}
              >
                <span className="block text-sm font-medium text-foreground">
                  Start from scratch
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Create a new folder and open it in Project Chat.
                </span>
              </button>
              <button
                type="button"
                className="rounded-lg border border-border p-4 text-left transition-colors hover:border-primary disabled:opacity-60"
                onClick={onUseExistingFolder}
                disabled={!isDesktopProjectBridgeAvailable}
              >
                <span className="block text-sm font-medium text-foreground">
                  Use an existing folder
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Choose a folder you already work from.
                </span>
              </button>
              <button
                type="button"
                className="rounded-lg border border-border p-4 text-left opacity-60"
                disabled
              >
                <span className="block text-sm font-medium text-foreground">Import from Chat</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Coming later for chat-generated artifacts.
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Start from scratch</DialogTitle>
              <DialogDescription>
                Name the Project, then choose where to create the folder.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                onCreate();
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="new-project-name">Project name</Label>
                <Input
                  id="new-project-name"
                  autoFocus
                  value={name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder="Project name"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-between gap-2">
                <Button type="button" variant="ghost" onClick={() => setStep('choices')}>
                  Back
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
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

function ProjectCommandRunnerStatus({
  commandRunner,
}: Readonly<{ commandRunner: CommandRunnerDisplay | null }>) {
  if (!commandRunner) {
    return null;
  }

  const label = commandRunnerStatusLabel(commandRunner);
  return (
    <div
      aria-label={`Project command status: ${label}`}
      className="hidden min-w-0 max-w-44 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground md:flex"
      title={commandRunnerStatusDescription(commandRunner)}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${commandRunnerStatusColor(commandRunner)}`}
      />
      <span className="truncate">{label}</span>
    </div>
  );
}

function ProjectChatHeader({
  commandRunner,
  project,
  onReturnHome,
  terminalOpen,
  onToggleTerminal,
  canOpenIde,
  isOpeningIde,
  onOpenIde,
}: ProjectChatHeaderProps) {
  if (!project) {
    return null;
  }

  const profile = projectDisplayProfile(project);
  const assessment = projectOnboardingAssessmentFromMetadata(project);
  const folderLabel = desktopProjectFolderLabel(project);
  const showFolderLabel = folderLabel && folderLabel !== project.name;

  return (
    <div
      role="group"
      aria-label="Project controls"
      className="ml-auto flex min-w-0 items-center gap-3"
    >
      <div className="min-w-0 text-right">
        <nav
          aria-label="Project location"
          className="flex items-center justify-end gap-1 text-xs text-muted-foreground"
        >
          <button
            type="button"
            className="truncate transition-colors hover:text-foreground"
            onClick={onReturnHome}
          >
            Workspaces
          </button>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <span>Project</span>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <span aria-current="page">Chat</span>
        </nav>
        <div className="truncate text-sm font-medium text-foreground">{project.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {profile.label} - {projectCapabilitySummary(assessment?.capabilities)}
        </div>
        {showFolderLabel && (
          <div className="truncate text-[11px] text-muted-foreground">{folderLabel}</div>
        )}
      </div>
      <ProjectCommandRunnerStatus commandRunner={commandRunner} />
      <Button
        type="button"
        size="sm"
        variant={terminalOpen ? 'secondary' : 'outline'}
        className="shrink-0"
        onClick={onToggleTerminal}
        title={terminalOpen ? 'Hide terminal' : 'Show terminal'}
      >
        <TerminalIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{terminalOpen ? 'Hide Terminal' : 'Terminal'}</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={onOpenIde}
        disabled={!canOpenIde || isOpeningIde}
        title={
          canOpenIde
            ? 'Open this Project folder in your local IDE'
            : 'Open local IDE is available in the desktop app when a Project folder is connected'
        }
      >
        {isOpeningIde ? 'Opening...' : 'Open local IDE'}
      </Button>
    </div>
  );
}

export default function HomePage() {
  const [selectedMode, setSelectedMode] = useState<WorkspaceMode | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectDesktopRecord | null>(null);
  const [projectTerminalOpen, setProjectTerminalOpen] = useState(false);
  const [projectWebViewMode, setProjectWebViewMode] = useState<ProjectWebViewMode>('docked');
  const [projectGitRefreshKey, setProjectGitRefreshKey] = useState(0);
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
  const [commandRunnerHealth, setCommandRunnerHealth] = useState<CommandRunnerDisplay | null>(null);
  const [isDesktopProjectBridgeAvailable, setIsDesktopProjectBridgeAvailable] = useState(false);
  const [isDesktopProjectIdeBridgeAvailable, setIsDesktopProjectIdeBridgeAvailable] =
    useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [isOpeningProjectIde, setIsOpeningProjectIde] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isApprovingProjectInstructions, setIsApprovingProjectInstructions] = useState(false);
  const [isRejectingProjectInstructions, setIsRejectingProjectInstructions] = useState(false);
  const [isStartingProjectInstructions, setIsStartingProjectInstructions] = useState(false);
  const [approvedProjectInstructions, setApprovedProjectInstructions] =
    useState<ProjectInstructionsDecision | null>(null);
  const [rejectedProjectInstructions, setRejectedProjectInstructions] =
    useState<ProjectInstructionsDecision | null>(null);
  const attemptedProjectReopenIdRef = useRef<string | null>(null);
  const projectGitRefreshTimeoutRef = useRef<number | null>(null);
  const agentSelectionSourceRef = useRef<'system' | 'user'>('system');
  const personalChatRepairRef = useRef<string | null>(null);

  const {
    messages,
    sendMessage,
    status,
    error,
    setError,
    criticEventsByMessage,
    thinkingByMessage,
    toolEventsByMessage,
    workspaceEventsByMessage,
    approvalEventsByMessage,
    decideApproval,
    hasPendingApproval,
  } = useHarnessChat(sessionId, isResuming);
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useSessions();
  const scopedSessions =
    selectedMode === 'project-chat' && activeProject
      ? sessions.filter(
          (session) => session.mode === 'project' && session.projectId === activeProject.id,
        )
      : sessions.filter((session) => session.mode === 'chat' && !session.projectId);
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
      const usableConfigs = usableModelConfigs(configList ?? []);
      if (def) {
        setSelectedAgentId((prev) => {
          if (prev) return prev;
          agentSelectionSourceRef.current = 'system';
          return def.id;
        });
      }
      // Only show configs that can run: saved keyed configs plus local providers.
      setModelConfigs(usableConfigs);
      setSelectedModelConfigId((prev) =>
        prev && usableConfigs.some((config) => config.id === prev)
          ? prev
          : resolveChatModelConfigId(def?.id ?? null, nextAgents, usableConfigs),
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
    setIsDesktopProjectIdeBridgeAvailable(hasDesktopProjectIdeBridge());
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
      const chatAgentId = pickDefaultAgentForMode(agents, 'chat')?.id ?? agentId;
      setSessionError(null);
      setIsResuming(false);
      try {
        const session = await apiPost<SessionRecord>(apiPath('sessions'), {
          agentId: chatAgentId,
          mode: 'chat',
        });
        if (!session?.id) {
          setSessionError('Failed to create session');
          setSessionId(null);
          setSensorDashboard(null);
          return;
        }
        setSelectedAgentId(chatAgentId);
        setSelectedModelConfigId(resolveChatModelConfigId(chatAgentId, agents, modelConfigs));
        setSessionId(session.id);
        setSensorDashboard(null);
        setSensorError(null);
        setSensorLoading(false);
      } catch (e) {
        setSessionError(e instanceof ApiRequestError ? e.message : String(e));
        setSessionId(null);
        setSensorDashboard(null);
      }
    },
    [agents, modelConfigs],
  );

  const normalizePersonalChatSession = useCallback(
    async (session: SessionRecord): Promise<SessionRecord> => {
      const chatDefaultAgent = pickDefaultAgentForMode(agents, 'chat');
      if (session.mode !== 'chat' || !chatDefaultAgent || chatDefaultAgent.id === session.agentId) {
        return session;
      }

      const updatedSession: SessionRecord = {
        ...session,
        agentId: chatDefaultAgent.id,
        mode: 'chat',
        projectId: null,
        updatedAtMs: Date.now(),
      };
      return (
        (await apiPut<SessionRecord>(apiPath('sessions', session.id), updatedSession)) ??
        updatedSession
      );
    },
    [agents],
  );

  useEffect(() => {
    if (selectedMode !== 'chat') return;
    if (isResuming || agents.length === 0 || agentSelectionSourceRef.current === 'user') return;
    const def = pickDefaultAgentForMode(agents, 'chat');
    if (!def || selectedAgentId === def.id) return;
    agentSelectionSourceRef.current = 'system';
    setSelectedAgentId(def.id);
    setSelectedModelConfigId(resolveChatModelConfigId(def.id, agents, modelConfigs));
  }, [agents, isResuming, modelConfigs, selectedAgentId, selectedMode]);

  useEffect(() => {
    if (selectedMode !== 'chat') return;
    if (!selectedAgentId) return;
    // Only create a new session when agent selection changes organically
    // (not via resume, which sets sessionId directly)
    if (!isResuming) {
      createSessionForAgent(selectedAgentId).catch(() => {});
    }
  }, [selectedAgentId, createSessionForAgent, isResuming, selectedMode]);

  useEffect(() => {
    if (selectedMode !== 'chat' || !sessionId || agents.length === 0) return;
    const session = sessions.find((candidate) => candidate.id === sessionId);
    if (session?.mode !== 'chat') return;
    const chatDefaultAgent = pickDefaultAgentForMode(agents, 'chat');
    if (!chatDefaultAgent || session.agentId === chatDefaultAgent.id) return;
    if (personalChatRepairRef.current === session.id) return;

    personalChatRepairRef.current = session.id;
    normalizePersonalChatSession(session)
      .then((normalizedSession) => {
        agentSelectionSourceRef.current = 'system';
        setSelectedAgentId(normalizedSession.agentId);
        setSelectedModelConfigId(
          resolveChatModelConfigId(normalizedSession.agentId, agents, modelConfigs),
        );
        setSensorDashboard(null);
        setSensorError(null);
        setSensorLoading(false);
        refreshSessions().catch(() => {});
      })
      .catch((repairError) => {
        setSessionError(
          repairError instanceof ApiRequestError
            ? repairError.message
            : 'Failed to prepare personal chat session',
        );
      })
      .finally(() => {
        personalChatRepairRef.current = null;
      });
  }, [
    agents,
    modelConfigs,
    normalizePersonalChatSession,
    refreshSessions,
    selectedMode,
    sessionId,
    sessions,
  ]);

  const handleAgentChange = useCallback(
    (agentId: string) => {
      agentSelectionSourceRef.current = 'user';
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
        globalThis.window.dispatchEvent(new CustomEvent(workspaceNavigationChangedEvent));
      }
      setSelectedMode('chat');
      setActiveProject(null);
      setSessionId(null);
      setSensorDashboard(null);
      setSensorError(null);
      setSensorLoading(false);
      setCommandRunnerHealth(null);
      setSessionError(null);
      setIsResuming(false);
      clearAttachments();
      agentSelectionSourceRef.current = 'system';
      const def = pickDefaultAgentForMode(agents, 'chat');
      if (def) {
        setSelectedAgentId(def.id);
        setSelectedModelConfigId(resolveChatModelConfigId(def.id, agents, modelConfigs));
      }
    },
    [agents, clearAttachments, modelConfigs],
  );

  const handleReturnHome = useCallback(() => {
    if (globalThis.window !== undefined) {
      globalThis.window.history.pushState(null, '', '/');
      globalThis.window.dispatchEvent(new CustomEvent(workspaceNavigationChangedEvent));
    }
    setSelectedMode(null);
    setActiveProject(null);
    setSessionId(null);
    setSensorDashboard(null);
    setSensorError(null);
    setSensorLoading(false);
    setCommandRunnerHealth(null);
    setSessionError(null);
    setIsResuming(false);
    clearAttachments();
  }, [clearAttachments]);

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
        setIsResuming(Boolean(result && !result.created));
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
      setCommandRunnerHealth(null);
      setSessionError(null);
      setIsResuming(false);
      clearAttachments();
      const def = pickDefaultAgentForMode(agents, 'project');
      const nextAgentId = def?.id ?? selectedAgentId;
      if (def) {
        agentSelectionSourceRef.current = 'system';
        setSelectedAgentId(def.id);
        setSelectedModelConfigId(resolveChatModelConfigId(def.id, agents, modelConfigs));
      }
      return nextAgentId ?? null;
    },
    [agents, clearAttachments, modelConfigs, selectedAgentId],
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

  const handleCreateProject = useCallback(async () => {
    const name = newProjectName.trim();
    if (!name) {
      setNewProjectError('Enter a Project name.');
      return;
    }

    setIsCreatingProject(true);
    setNewProjectError(null);
    setSessionError(null);
    try {
      const result = await createAndRegisterDesktopProject({ name });
      if (!result) {
        setNewProjectError('Project creation is available only in the desktop app.');
        return;
      }
      const agentId = openProjectChat(result.project);
      if (agentId) {
        await bindActiveProjectSession(agentId, result.project.id);
      }
      setIsNewProjectDialogOpen(false);
      setNewProjectName('');
      if (globalThis.window !== undefined) {
        globalThis.window.dispatchEvent(new Event(recentProjectsUpdatedEvent));
      }
    } catch (error) {
      let message = 'Failed to create Project';
      if (error instanceof ApiRequestError || error instanceof Error) {
        message = error.message;
      }
      setNewProjectError(message);
    } finally {
      setIsCreatingProject(false);
    }
  }, [bindActiveProjectSession, newProjectName, openProjectChat]);

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
        const projectSessions = (await apiGet<SessionRecord[]>(apiPath('sessions'))) ?? [];
        const reusableSession = mostRecentTitledProjectSession(projectSessions, project.id);
        if (reusableSession) {
          setIsResuming(true);
          setSelectedAgentId(reusableSession.agentId);
          setSelectedModelConfigId(
            resolveChatModelConfigId(reusableSession.agentId, agents, modelConfigs),
          );
          setSessionId(reusableSession.id);
          await refreshSensors(reusableSession.id);
          return;
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
    const project = await apiPost<ProjectDesktopRecord>(
      apiPath('projects', activeProject.id, 'refresh'),
      {},
    );
    if (project) {
      setActiveProject(project);
      setProjectGitRefreshKey((value) => value + 1);
    }
  }, [activeProject?.id]);

  const refreshCommandRunnerHealth = useCallback(async () => {
    try {
      setCommandRunnerHealth(await fetchCommandRunnerDisplay());
    } catch (error) {
      setCommandRunnerHealth({
        canExecute: false,
        message: error instanceof Error ? error.message : 'Command runner health check failed.',
        mode: 'unknown',
        reason: 'health_check_failed',
        status: 'unavailable',
      });
    }
  }, []);

  useEffect(() => {
    if (selectedMode !== 'project-chat') {
      setCommandRunnerHealth(null);
      return;
    }
    refreshCommandRunnerHealth().catch(() => {});
    const interval = globalThis.window.setInterval(() => {
      refreshCommandRunnerHealth().catch(() => {});
    }, 5_000);
    return () => {
      globalThis.window.clearInterval(interval);
    };
  }, [refreshCommandRunnerHealth, selectedMode]);

  useEffect(() => {
    if (selectedMode !== 'project-chat' || !activeProject?.id) return;
    refreshActiveProject().catch(() => {});
  }, [activeProject?.id, refreshActiveProject, selectedMode]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    if (selectedMode !== 'project-chat' || !activeProject?.id) return;
    const handleRefresh = () => {
      if (globalThis.document.visibilityState === 'hidden') return;
      refreshActiveProject().catch(() => {});
    };
    globalThis.window.addEventListener('focus', handleRefresh);
    globalThis.document.addEventListener('visibilitychange', handleRefresh);
    return () => {
      globalThis.window.removeEventListener('focus', handleRefresh);
      globalThis.document.removeEventListener('visibilitychange', handleRefresh);
    };
  }, [activeProject?.id, refreshActiveProject, selectedMode]);

  const scheduleProjectGitRefresh = useCallback(() => {
    if (globalThis.window === undefined) return;
    if (projectGitRefreshTimeoutRef.current !== null) {
      globalThis.window.clearTimeout(projectGitRefreshTimeoutRef.current);
    }
    projectGitRefreshTimeoutRef.current = globalThis.window.setTimeout(() => {
      projectGitRefreshTimeoutRef.current = null;
      refreshActiveProject().catch(() => {});
    }, 350);
  }, [refreshActiveProject]);

  const handleProjectBranchChanged = useCallback(
    (project: ProjectDesktopRecord) => {
      setActiveProject(project);
      setProjectGitRefreshKey((value) => value + 1);
      scheduleProjectGitRefresh();
    },
    [scheduleProjectGitRefresh],
  );

  useEffect(() => {
    return () => {
      if (globalThis.window === undefined || projectGitRefreshTimeoutRef.current === null) return;
      globalThis.window.clearTimeout(projectGitRefreshTimeoutRef.current);
    };
  }, []);

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

  const handleStartProjectInstructions = useCallback(async () => {
    if (!activeProject?.id) return;
    setIsStartingProjectInstructions(true);
    setSessionError(null);
    try {
      const project = await apiPost<ProjectDesktopRecord>(
        apiPath('projects', activeProject.id, 'onboarding', 'draft'),
        {},
      );
      if (!project) throw new ApiRequestError('Failed to prepare Project instructions', 500);
      setActiveProject(project);
      setApprovedProjectInstructions(null);
      setRejectedProjectInstructions(null);
      if (globalThis.window !== undefined) {
        globalThis.window.dispatchEvent(new Event(recentProjectsUpdatedEvent));
      }
    } catch (error) {
      setSessionError(
        error instanceof ApiRequestError ? error.message : 'Failed to prepare Project instructions',
      );
    } finally {
      setIsStartingProjectInstructions(false);
    }
  }, [activeProject?.id]);

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

    reopenRecentProject(projectId, requestedSessionId).catch(() => {});
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
      reopenRecentProject(detail.projectId, null).catch(() => {});
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
      const selectSession = async () => {
        agentSelectionSourceRef.current = 'system';
        setIsResuming(true);
        const normalizedSession = await normalizePersonalChatSession(session);
        const repairedPersonalSession = normalizedSession.agentId !== session.agentId;

        setSelectedMode(normalizedSession.mode === 'project' ? 'project-chat' : 'chat');
        setSelectedAgentId(normalizedSession.agentId);
        setSelectedModelConfigId(
          resolveChatModelConfigId(normalizedSession.agentId, agents, modelConfigs),
        );
        setSessionId(normalizedSession.id);
        clearAttachments();
        if (normalizedSession.mode === 'project') {
          refreshSensors(normalizedSession.id).catch(() => {});
        } else {
          setSensorDashboard(null);
          setSensorError(null);
          setSensorLoading(false);
        }
        if (repairedPersonalSession) {
          refreshSessions().catch(() => {});
        }
      };

      selectSession().catch((error) => {
        setSessionError(
          error instanceof ApiRequestError ? error.message : 'Failed to open chat session',
        );
      });
    },
    [clearAttachments, modelConfigs, normalizePersonalChatSession, refreshSensors, refreshSessions],
  );

  const handleNewChatForAgent = useCallback(
    (agentId: string) => {
      const chatAgentId =
        selectedMode === 'project-chat'
          ? agentId
          : (pickDefaultAgentForMode(agents, 'chat')?.id ?? agentId);
      agentSelectionSourceRef.current = selectedMode === 'project-chat' ? 'user' : 'system';
      setIsResuming(false);
      setSelectedAgentId(chatAgentId);
      setSelectedModelConfigId(resolveChatModelConfigId(chatAgentId, agents, modelConfigs));
      clearAttachments();
      if (selectedMode === 'project-chat' && activeProject?.id) {
        setSessionError(null);
        apiPost<SessionRecord>(apiPath('sessions'), {
          agentId: chatAgentId,
          mode: 'project',
          projectId: activeProject.id,
        })
          .then((session) => {
            if (!session?.id) {
              setSessionError('Failed to create Project chat session');
              return;
            }
            setSessionId(session.id);
            refreshSessions().catch(() => {});
            refreshSensors(session.id).catch(() => {});
          })
          .catch((error) => {
            setSessionError(
              error instanceof ApiRequestError ? error.message : 'Failed to create Project chat',
            );
          });
        return;
      }
      createSessionForAgent(chatAgentId).catch(() => {});
    },
    [
      activeProject?.id,
      agents,
      clearAttachments,
      createSessionForAgent,
      modelConfigs,
      refreshSensors,
      refreshSessions,
      selectedMode,
    ],
  );

  const isLoading = status === 'streaming';
  const hasUsableModelConfig = modelConfigs.length > 0;
  const canSend = Boolean(sessionId) && !hasPendingApproval && hasUsableModelConfig;
  const inputStatusText = hasUsableModelConfig
    ? getInputStatusText(hasPendingApproval, selectedMode, sessionId)
    : 'Create a model in Settings > Models before sending.';
  let workspaceWebViewProjectId: string | null = null;
  if (selectedMode === 'project-chat') {
    workspaceWebViewProjectId = activeProject?.id ?? null;
  }
  const onboardingDraft = projectOnboardingDraft(activeProject);
  let projectInstructionsStatus: 'approved' | 'draft_ready' | 'missing' = 'missing';
  if (projectOnboardingIsApproved(activeProject)) {
    projectInstructionsStatus = 'approved';
  } else if (onboardingDraft) {
    projectInstructionsStatus = 'draft_ready';
  }
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
      setApprovedProjectInstructions(null);
      setRejectedProjectInstructions(null);
      const messageForApi = formattedContext ? `${formattedContext}\n${text}` : text;
      const displayText = formattedContext ? text : undefined;
      sendMessage(messageForApi, displayText, selectedModelConfigId)
        .then(async () => {
          await refreshSessions();
          if (selectedMode === 'project-chat' && sessionId) {
            await refreshSensors(sessionId);
          }
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

  const handleOpenProjectIde = useCallback(() => {
    if (!activeProject?.id) return;
    if (!hasDesktopProjectIdeBridge()) {
      setError(
        'Open local IDE is available in the desktop app when a Project folder is connected.',
      );
      return;
    }
    setIsOpeningProjectIde(true);
    openDesktopProjectIde(activeProject.id)
      .then((result) => {
        if (!result) {
          setError(
            'Open local IDE is available in the desktop app when a Project folder is connected.',
          );
          return;
        }
        if (!result.handled) {
          setError(result.reason);
        }
      })
      .catch(() => {
        setError('Failed to open the Project folder in your local IDE.');
      })
      .finally(() => {
        setIsOpeningProjectIde(false);
      });
  }, [activeProject?.id, setError]);

  if (!selectedMode) {
    return (
      <>
        <HomeEntryScreen
          isCreatingProject={isCreatingProject}
          isDesktopProjectBridgeAvailable={isDesktopProjectBridgeAvailable}
          isOpeningProject={isOpeningProject}
          onCreateProject={() => {
            setIsNewProjectDialogOpen(true);
          }}
          onOpenChat={() => {
            handleOpenChat();
          }}
          onOpenProject={() => {
            handleOpenProject().catch(() => {});
          }}
        />
        <NewProjectDialog
          error={newProjectError}
          isCreating={isCreatingProject}
          isDesktopProjectBridgeAvailable={isDesktopProjectBridgeAvailable}
          name={newProjectName}
          onCreate={() => {
            handleCreateProject().catch(() => {});
          }}
          onNameChange={(name) => {
            setNewProjectName(name);
            setNewProjectError(null);
          }}
          onOpenChange={(open) => {
            setIsNewProjectDialogOpen(open);
            if (!open) {
              setNewProjectError(null);
            }
          }}
          onUseExistingFolder={() => {
            setIsNewProjectDialogOpen(false);
            handleOpenProject().catch(() => {});
          }}
          open={isNewProjectDialogOpen}
        />
      </>
    );
  }

  const alertMessage = [loadError, sessionError, error].filter(Boolean).join(' — ') || null;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        <ErrorBanner
          message={alertMessage}
          onDismiss={() => {
            setLoadError(null);
            setSessionError(null);
            setError(null);
          }}
        />
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50"
          data-workspace-surface={navigationState.surface}
          data-workspace-scope={navigationState.scope}
        >
          <SessionDropdown
            sessions={scopedSessions}
            agents={agents}
            activeSessionId={sessionId}
            selectedAgentId={selectedAgentId}
            scopeLabel={
              selectedMode === 'project-chat' && activeProject
                ? `${activeProject.name} sessions`
                : 'Personal chat sessions'
            }
            newChatLabel={
              selectedMode === 'project-chat' ? 'New Project chat' : 'New personal chat'
            }
            onSelectSession={handleSelectSession}
            onNewChatForAgent={handleNewChatForAgent}
            loading={sessionsLoading}
            disabled={isLoading}
          />
          {selectedMode === 'project-chat' && (
            <ProjectChatHeader
              commandRunner={commandRunnerHealth}
              project={activeProject}
              onReturnHome={handleReturnHome}
              terminalOpen={projectTerminalOpen}
              onToggleTerminal={() => setProjectTerminalOpen((open) => !open)}
              canOpenIde={isDesktopProjectIdeBridgeAvailable}
              isOpeningIde={isOpeningProjectIde}
              onOpenIde={handleOpenProjectIde}
            />
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
              key={`${selectedMode}:${activeProject?.id ?? 'none'}:${sessionId ?? 'none'}`}
              resetKey={`${selectedMode}:${activeProject?.id ?? 'none'}:${sessionId ?? 'none'}`}
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
              workspaceEventsByMessage={workspaceEventsByMessage}
              workspaceWebViewProjectId={workspaceWebViewProjectId}
              approvalEventsByMessage={approvalEventsByMessage}
              onApprovalDecision={handleApprovalDecision}
              showSensors={false}
              sensorDashboard={sensorDashboard}
              sensorLoading={sensorLoading}
              sensorError={sensorError}
              onRetrySensors={() => {
                if (selectedMode === 'project-chat' && sessionId) {
                  refreshSensors(sessionId, true).catch(() => {});
                }
              }}
              inputPlaceholder={projectChatPlaceholder(selectedMode)}
              emptyStateTitle={projectChatEmptyStateTitle(selectedMode, activeProject)}
              emptyStateDescription={projectChatEmptyStateDescription(selectedMode)}
              inputSelectorAccessory={
                selectedMode === 'project-chat' ? (
                  <ProjectBranchSelector
                    projectId={activeProject?.id ?? null}
                    activeBranch={activeProject?.metadata.activeBranch}
                    disabled={isLoading}
                    refreshKey={projectGitRefreshKey}
                    onProjectChanged={handleProjectBranchChanged}
                    onError={setSessionError}
                  />
                ) : null
              }
              conversationAccessory={
                <ProjectInstructionsConversationAccessory
                  draft={onboardingDraft}
                  approved={approvedProjectInstructions}
                  rejected={rejectedProjectInstructions}
                  project={activeProject}
                  selectedMode={selectedMode}
                  isApproving={isApprovingProjectInstructions}
                  isRejecting={isRejectingProjectInstructions}
                  onApprove={handleApproveProjectInstructions}
                  onReject={handleRejectProjectInstructions}
                  onDismissApproved={() => setApprovedProjectInstructions(null)}
                  onDismissRejected={() => setRejectedProjectInstructions(null)}
                />
              }
              bottomAccessory={
                selectedMode === 'project-chat' ? (
                  <ProjectTerminalDock
                    projectId={activeProject?.id ?? null}
                    projectName={activeProject?.name ?? null}
                    activeBranch={activeProject?.metadata.activeBranch}
                    open={projectTerminalOpen}
                    onOpenChange={setProjectTerminalOpen}
                    onActivity={scheduleProjectGitRefresh}
                  />
                ) : null
              }
              sideAccessory={
                selectedMode === 'project-chat' ? (
                  <div className="hidden h-full min-h-0 shrink-0 lg:flex">
                    <ProjectWebViewPanel
                      projectId={activeProject?.id ?? null}
                      viewMode={projectWebViewMode}
                      onViewModeChange={setProjectWebViewMode}
                    />
                    {projectWebViewMode === 'docked' && (
                      <ProjectEvidenceRail
                        projectId={activeProject?.id ?? null}
                        sessionId={sessionId}
                        profile={
                          projectOnboardingAssessmentFromMetadata(activeProject)?.profile ??
                          'unknown'
                        }
                        workspaceEventsByMessage={workspaceEventsByMessage}
                        approvalEventsByMessage={approvalEventsByMessage}
                        toolEventsByMessage={toolEventsByMessage}
                        refreshKey={projectGitRefreshKey}
                        projectInstructionsStatus={projectInstructionsStatus}
                        isStartingProjectInstructions={isStartingProjectInstructions}
                        onStartProjectInstructions={handleStartProjectInstructions}
                      />
                    )}
                  </div>
                ) : null
              }
            />
          </AgentModelProvider>
        </div>
      </div>
    </div>
  );
}
