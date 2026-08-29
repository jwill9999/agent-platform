'use client';

import type {
  ProjectGitChangesResult,
  ProjectGitChecksResult,
  ProjectGitPullRequestsResult,
  ProjectProfile,
  WorkspaceEvent,
} from '@agent-platform/contracts';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FileDiff,
  FileOutput,
  LoaderCircle,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWorkspaceResourcePreviewActions } from '@/components/chat/workspace-resource-cards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ApprovalCardState, ToolTraceEvent } from '@/hooks/use-harness-chat';
import { apiGet, apiPath, ApiRequestError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { getDesktopWorkspaceBridge, openWorkspaceWebUrl } from '@/lib/desktop-workspace';
import {
  normalizeProjectActivity,
  type ProjectActivityEntry,
  type ProjectActivityFinding,
  type ProjectActivitySection,
  type ProjectActivityTone,
} from '@/lib/project-activity';

type ProjectActivityPanelProps = Readonly<{
  projectId: string | null;
  sessionId: string | null;
  profile: ProjectProfile;
  workspaceEventsByMessage?: Readonly<Record<string, readonly WorkspaceEvent[]>>;
  approvalEventsByMessage?: Readonly<Record<string, readonly ApprovalCardState[]>>;
  toolEventsByMessage?: Readonly<Record<string, readonly ToolTraceEvent[]>>;
  refreshKey?: number;
  embedded?: boolean;
}>;

type ActivityProviderState = Readonly<{
  changes: ProjectGitChangesResult | null;
  checks: ProjectGitChecksResult | null;
  pullRequests: ProjectGitPullRequestsResult | null;
  gitError: string | null;
  checksError: string | null;
  reviewsError: string | null;
}>;

const EMPTY_PROVIDER_STATE: ActivityProviderState = {
  changes: null,
  checks: null,
  pullRequests: null,
  gitError: null,
  checksError: null,
  reviewsError: null,
};

function userFacingError(cause: unknown, fallback: string): string {
  if (cause instanceof ApiRequestError && cause.status === 0) return 'Provider disconnected';
  return fallback;
}

function approvalStatus(status: ApprovalCardState['status']) {
  if (status === 'approved' || status === 'executed' || status === 'rejected') return status;
  if (status === 'failed' || status === 'expired') return 'failed' as const;
  return 'pending' as const;
}

function toolLabel(toolId: string): string {
  return toolId
    .replace(/^coding_/u, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function toolResultDetail(status: string): string {
  if (status === 'success') return 'Completed successfully';
  if (status === 'denied') return 'Action was denied';
  return 'Action reported an issue';
}

function normalizedFindings(
  eventsByMessage?: Readonly<Record<string, readonly ToolTraceEvent[]>>,
): ProjectActivityFinding[] {
  const entries: ProjectActivityFinding[] = [];
  for (const [messageId, events] of Object.entries(eventsByMessage ?? {})) {
    events.forEach((event, index) => {
      if (event.type === 'error') {
        entries.push({
          id: `${messageId}:error:${index}`,
          title: 'Tool issue',
          detail: event.message,
          status: 'error',
        });
        return;
      }
      if (event.type !== 'result') return;
      const category = /(?:test|check|lint|typecheck|build|quality)/iu.test(event.toolId)
        ? 'check'
        : 'finding';
      if (event.status === 'success' && category !== 'check') return;
      entries.push({
        id: `${messageId}:${event.toolId}:${index}`,
        title: toolLabel(event.toolId),
        detail: toolResultDetail(event.status),
        status: event.status,
        category,
      });
    });
  }
  return entries;
}

function toneClass(tone: ProjectActivityTone): string {
  if (tone === 'success') return 'text-emerald-700';
  if (tone === 'warning') return 'text-amber-700';
  if (tone === 'danger') return 'text-red-700';
  if (tone === 'running') return 'text-blue-700';
  return 'text-muted-foreground';
}

function EntryIcon({ entry }: Readonly<{ entry: ProjectActivityEntry }>) {
  if (entry.kind === 'changed_file') return <FileDiff className="h-4 w-4" aria-hidden />;
  if (entry.kind === 'generated_file' || entry.kind === 'preview') {
    return <FileOutput className="h-4 w-4" aria-hidden />;
  }
  if (entry.kind === 'approval' || entry.kind === 'review') {
    return <ShieldCheck className="h-4 w-4" aria-hidden />;
  }
  if (entry.tone === 'success') return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (entry.tone === 'danger' || entry.tone === 'warning') {
    return <AlertCircle className="h-4 w-4" aria-hidden />;
  }
  return <CircleDot className="h-4 w-4" aria-hidden />;
}

function openWebLink(event: React.MouseEvent<HTMLAnchorElement>, url: string, projectId: string) {
  if (!getDesktopWorkspaceBridge()) return;
  event.preventDefault();
  void openWorkspaceWebUrl({ url, projectId });
}

function ActivityEntryRow({
  entry,
  projectId,
}: Readonly<{ entry: ProjectActivityEntry; projectId: string }>) {
  const previews = useWorkspaceResourcePreviewActions();
  const content = (
    <>
      <span className={cn('mt-0.5 shrink-0', toneClass(entry.tone))}>
        <EntryIcon entry={entry} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">{entry.title}</span>
        {entry.detail && (
          <span className="block truncate text-[11px] text-muted-foreground">{entry.detail}</span>
        )}
      </span>
      {(entry.resource || entry.url) && (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </>
  );
  const className =
    'flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const resource = entry.resource;
  if (resource) {
    return (
      <button
        type="button"
        className={className}
        onClick={(event) => previews?.openResource(resource, event.currentTarget)}
      >
        {content}
      </button>
    );
  }
  const url = entry.url;
  if (url) {
    return (
      <a
        className={className}
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => openWebLink(event, url, projectId)}
      >
        {content}
        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}

function ActivitySectionView({
  projectId,
  section,
}: Readonly<{ projectId: string; section: ProjectActivitySection }>) {
  return (
    <section aria-labelledby={`project-activity-${section.id}`}>
      <div className="mb-1 flex items-center justify-between gap-2 px-2">
        <h3
          id={`project-activity-${section.id}`}
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {section.title}
        </h3>
        {section.entries.length > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {section.entries.length}
          </Badge>
        )}
      </div>
      {section.entries.length > 0 ? (
        <div className="space-y-0.5">
          {section.entries.map((entry) => (
            <ActivityEntryRow key={entry.id} entry={entry} projectId={projectId} />
          ))}
        </div>
      ) : (
        <p className="px-2 py-1 text-[11px] text-muted-foreground">
          {section.unavailableMessage ?? 'Nothing to show.'}
        </p>
      )}
    </section>
  );
}

export function ProjectActivityPanel({
  projectId,
  sessionId,
  profile,
  workspaceEventsByMessage,
  approvalEventsByMessage,
  toolEventsByMessage,
  refreshKey,
  embedded = false,
}: ProjectActivityPanelProps) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ActivityProviderState>(EMPTY_PROVIDER_STATE);
  const loadGenerationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    if (!projectId) {
      setProvider(EMPTY_PROVIDER_STATE);
      return;
    }
    setLoading(true);
    const [changes, checks, pullRequests] = await Promise.allSettled([
      apiGet<ProjectGitChangesResult>(apiPath('projects', projectId, 'git', 'changes')),
      apiGet<ProjectGitChecksResult>(apiPath('projects', projectId, 'git', 'checks')),
      apiGet<ProjectGitPullRequestsResult>(
        apiPath('projects', projectId, 'github', 'pull-requests'),
      ),
    ]);
    if (loadGenerationRef.current !== generation) return;
    setProvider({
      changes: changes.status === 'fulfilled' ? (changes.value ?? null) : null,
      checks: checks.status === 'fulfilled' ? (checks.value ?? null) : null,
      pullRequests: pullRequests.status === 'fulfilled' ? (pullRequests.value ?? null) : null,
      gitError:
        changes.status === 'rejected'
          ? userFacingError(changes.reason, 'Local changes are unavailable')
          : null,
      checksError:
        checks.status === 'rejected'
          ? userFacingError(checks.reason, 'Checks are unavailable')
          : null,
      reviewsError:
        pullRequests.status === 'rejected'
          ? userFacingError(pullRequests.reason, 'Reviews are unavailable')
          : null,
    });
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    setProvider(EMPTY_PROVIDER_STATE);
    void load();
  }, [load, refreshKey, sessionId]);

  const resources = useMemo(
    () =>
      Object.values(workspaceEventsByMessage ?? {})
        .flat()
        .map((event) => event.resource)
        .filter((resource) => resource !== undefined),
    [workspaceEventsByMessage],
  );
  const approvals = useMemo(
    () =>
      Object.values(approvalEventsByMessage ?? {})
        .flat()
        .map((approval) => ({
          id: approval.approvalRequestId,
          title: `${toolLabel(approval.toolName)} approval`,
          detail: approval.message,
          status: approvalStatus(approval.status),
        })),
    [approvalEventsByMessage],
  );
  const findings = useMemo(() => normalizedFindings(toolEventsByMessage), [toolEventsByMessage]);
  const snapshot = useMemo(
    () =>
      normalizeProjectActivity({
        projectId,
        profile,
        changes: provider.changes,
        checks: provider.checks,
        pullRequests: provider.pullRequests,
        resources,
        approvals,
        findings,
        gitError: provider.gitError,
        checksError: provider.checksError,
        reviewsError: provider.reviewsError,
      }),
    [approvals, findings, profile, projectId, provider, resources],
  );

  if (!projectId) return null;
  return (
    <aside
      className={cn(
        'h-full max-h-full min-h-0 shrink-0 overflow-hidden bg-background/95',
        embedded ? 'flex w-full' : 'hidden border-l border-border lg:flex',
        !embedded && (open ? 'w-[320px] max-w-[28vw]' : 'w-12'),
      )}
      aria-label="Project activity"
      data-project-id={projectId}
      data-session-id={sessionId ?? undefined}
    >
      {open || embedded ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
            <CircleDot className="h-4 w-4" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium">Activity</h2>
              <p className="truncate text-[11px] text-muted-foreground">{snapshot.summary}</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh Project activity"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
            </Button>
            {!embedded && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Close Project activity panel"
              >
                <PanelRightClose className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {loading && !provider.changes && !provider.checks && !provider.pullRequests ? (
              <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                Loading Project activity…
              </div>
            ) : (
              <div className="space-y-4">
                {snapshot.profileMessage && (
                  <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {snapshot.profileMessage}
                  </p>
                )}
                {snapshot.state === 'unavailable' && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Activity providers are currently unavailable. Conversation evidence remains
                    safe.
                  </p>
                )}
                {snapshot.sections.map((section) => (
                  <ActivitySectionView key={section.id} projectId={projectId} section={section} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="h-full w-12 rounded-none px-0"
          onClick={() => setOpen(true)}
          aria-label="Open Project activity panel"
          title="Open Project activity panel"
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </aside>
  );
}
