'use client';

import type {
  ProjectGitChangedFile,
  ProjectGitChangesResult,
  ProjectGitDiffMode,
  ProjectGitFileDiffResult,
  ProjectGitStatusResult,
} from '@agent-platform/contracts';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  PanelRightClose,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';

type ProjectGitHubPanelProps = Readonly<{
  projectId: string | null;
  refreshKey?: number;
  projectInstructionsStatus?: 'approved' | 'draft_ready' | 'missing';
  isStartingProjectInstructions?: boolean;
  onStartProjectInstructions?: () => void;
}>;

type PanelTab = 'overview' | 'changes' | 'commits' | 'prs' | 'checks';

const ZERO_WORKING_TREE = {
  total: 0,
  staged: 0,
  unstaged: 0,
  added: 0,
  modified: 0,
  deleted: 0,
  renamed: 0,
  untracked: 0,
  conflicts: 0,
};

function normalizeGitHubUrl(remoteUrl: string | undefined): string | null {
  if (!remoteUrl) return null;
  const sshMatch = /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i.exec(remoteUrl);
  if (sshMatch?.[1]) return `https://github.com/${sshMatch[1]}`;
  const httpsMatch = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i.exec(remoteUrl);
  if (httpsMatch?.[1]) return `https://github.com/${httpsMatch[1]}`;
  return null;
}

function shortSha(sha: string | undefined): string {
  return sha ? sha.slice(0, 7) : 'No commit';
}

function relativeCommitLabel(committedAt: string | undefined): string {
  if (!committedAt) return 'Commit time unavailable';
  const timestamp = Date.parse(committedAt);
  if (Number.isNaN(timestamp)) return committedAt;
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function EmptyGitStatus(): ProjectGitStatusResult {
  return {
    available: false,
    reason: 'Project Git state is unavailable.',
    clean: true,
    ahead: 0,
    behind: 0,
    githubRemoteDetected: false,
    workingTree: ZERO_WORKING_TREE,
  };
}

function StatusPill({ status }: Readonly<{ status: ProjectGitStatusResult }>) {
  if (!status.available) {
    return <Badge variant="outline">No Git</Badge>;
  }
  if (status.workingTree.conflicts > 0) {
    return <Badge variant="destructive">Conflicts</Badge>;
  }
  if (!status.clean) {
    return <Badge variant="outline">Changes</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Synced</Badge>;
}

function StatRow({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: number; tone?: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', tone)}>{value}</span>
    </div>
  );
}

function GitCard({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="rounded border border-border bg-background px-3 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ProjectInstructionsCard({
  status,
  isStarting,
  onStart,
}: Readonly<{
  status: 'approved' | 'draft_ready' | 'missing';
  isStarting: boolean;
  onStart?: () => void;
}>) {
  if (status === 'approved') return null;
  return (
    <GitCard title="Project Instructions">
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            {status === 'draft_ready'
              ? 'An AGENTS.md draft is ready for review in Project Chat.'
              : 'AGENTS.md has not been prepared for this Project yet.'}
          </span>
        </div>
        {status === 'missing' && (
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={onStart}
            disabled={!onStart || isStarting}
          >
            {isStarting ? 'Preparing...' : 'Generate AGENTS.md'}
          </Button>
        )}
      </div>
    </GitCard>
  );
}

function shortPath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 2) return path;
  return `${parts[0]}/.../${parts.at(-1)}`;
}

function statusLabel(file: ProjectGitChangedFile): string {
  if (file.status === 'untracked') return 'U';
  if (file.status === 'modified') return 'M';
  if (file.status === 'deleted') return 'D';
  if (file.status === 'added') return 'A';
  if (file.status === 'renamed') return 'R';
  return '!';
}

function statusTone(file: ProjectGitChangedFile): string {
  if (file.status === 'deleted' || file.status === 'conflict') return 'text-red-700 bg-red-50';
  if (file.status === 'added' || file.status === 'untracked')
    return 'text-emerald-700 bg-emerald-50';
  if (file.status === 'renamed') return 'text-blue-700 bg-blue-50';
  return 'text-amber-700 bg-amber-50';
}

function DiffPreview({ diff }: Readonly<{ diff: string }>) {
  if (!diff.trim()) {
    return (
      <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
        No diff available for this selection.
      </div>
    );
  }
  return (
    <pre className="max-h-[360px] overflow-auto rounded border border-border bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">
      <code>{diff}</code>
    </pre>
  );
}

function ChangeFileRow({
  file,
  selected,
  mode,
  onSelect,
}: Readonly<{
  file: ProjectGitChangedFile;
  selected: boolean;
  mode: ProjectGitDiffMode;
  onSelect: (file: ProjectGitChangedFile, mode: ProjectGitDiffMode) => void;
}>) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded border px-2 py-2 text-left text-xs transition-colors',
        selected
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-border bg-background hover:bg-secondary/50',
      )}
      onClick={() => onSelect(file, mode)}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold',
          statusTone(file),
        )}
      >
        {statusLabel(file)}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono" title={file.path}>
        {shortPath(file.path)}
      </span>
      {(file.additions !== undefined || file.deletions !== undefined) && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          <span className="text-emerald-700">+{file.additions ?? 0}</span>{' '}
          <span className="text-red-700">-{file.deletions ?? 0}</span>
        </span>
      )}
    </button>
  );
}

export function ProjectGitHubPanel({
  projectId,
  refreshKey,
  projectInstructionsStatus = 'approved',
  isStartingProjectInstructions = false,
  onStartProjectInstructions,
}: ProjectGitHubPanelProps) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<PanelTab>('overview');
  const [status, setStatus] = useState<ProjectGitStatusResult | null>(null);
  const [changes, setChanges] = useState<ProjectGitChangesResult | null>(null);
  const [selectedChange, setSelectedChange] = useState<ProjectGitChangedFile | null>(null);
  const [selectedDiffMode, setSelectedDiffMode] = useState<ProjectGitDiffMode>('unstaged');
  const [diff, setDiff] = useState<ProjectGitFileDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [changesLoading, setChangesLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [changesError, setChangesError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!projectId) {
      setStatus(null);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const next = await apiGet<ProjectGitStatusResult>(
        apiPath('projects', projectId, 'git', 'status'),
      );
      setStatus(next ?? EmptyGitStatus());
      setError(null);
    } catch (cause) {
      setStatus(EmptyGitStatus());
      setError(cause instanceof ApiRequestError ? cause.message : 'Failed to load Git state.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadChanges = useCallback(async () => {
    if (!projectId) {
      setChanges(null);
      setSelectedChange(null);
      setDiff(null);
      setChangesError(null);
      return;
    }
    setChangesLoading(true);
    try {
      const next = await apiGet<ProjectGitChangesResult>(
        apiPath('projects', projectId, 'git', 'changes'),
      );
      setChanges(next ?? null);
      setChangesError(null);
      setSelectedChange((current) => {
        if (!next?.files.length) return null;
        if (current && next.files.some((file) => file.path === current.path)) return current;
        return next.files[0] ?? null;
      });
    } catch (cause) {
      setChanges(null);
      setSelectedChange(null);
      setDiff(null);
      setChangesError(cause instanceof ApiRequestError ? cause.message : 'Failed to load changes.');
    } finally {
      setChangesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshKey]);

  useEffect(() => {
    if (activeTab === 'changes') void loadChanges();
  }, [activeTab, loadChanges, refreshKey]);

  useEffect(() => {
    if (!projectId || activeTab !== 'changes' || !selectedChange) {
      setDiff(null);
      return;
    }
    const params = new URLSearchParams({
      path: selectedChange.path,
      mode: selectedDiffMode,
    });
    let cancelled = false;
    setDiffLoading(true);
    apiGet<ProjectGitFileDiffResult>(
      `${apiPath('projects', projectId, 'git', 'diff')}?${params.toString()}`,
    )
      .then((next) => {
        if (!cancelled) setDiff(next ?? null);
      })
      .catch((cause) => {
        if (!cancelled) {
          setDiff(null);
          setChangesError(
            cause instanceof ApiRequestError ? cause.message : 'Failed to load file diff.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDiffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, projectId, selectedChange, selectedDiffMode]);

  const refreshGitViews = useCallback(async () => {
    await Promise.all([loadStatus(), loadChanges()]);
  }, [loadChanges, loadStatus]);

  const stagePaths = useCallback(
    async (paths: string[] | 'all') => {
      if (!projectId) return;
      setActionPending(paths === 'all' ? 'stage-all' : `stage:${paths.join('\0')}`);
      try {
        const next = await apiPost<ProjectGitChangesResult>(
          apiPath('projects', projectId, 'git', 'stage'),
          paths === 'all' ? { all: true } : { paths },
        );
        setChanges(next ?? null);
        setSelectedChange((current) =>
          current && next
            ? (next.files.find((file) => file.path === current.path) ?? null)
            : current,
        );
        if (paths !== 'all') setSelectedDiffMode('staged');
        setChangesError(null);
        await loadStatus();
      } catch (cause) {
        setChangesError(cause instanceof ApiRequestError ? cause.message : 'Failed to stage file.');
      } finally {
        setActionPending(null);
      }
    },
    [loadStatus, projectId],
  );

  const unstagePaths = useCallback(
    async (paths: string[]) => {
      if (!projectId) return;
      setActionPending(`unstage:${paths.join('\0')}`);
      try {
        const next = await apiPost<ProjectGitChangesResult>(
          apiPath('projects', projectId, 'git', 'unstage'),
          { paths },
        );
        setChanges(next ?? null);
        setSelectedChange((current) =>
          current && next
            ? (next.files.find((file) => file.path === current.path) ?? null)
            : current,
        );
        setSelectedDiffMode('unstaged');
        setChangesError(null);
        await loadStatus();
      } catch (cause) {
        setChangesError(
          cause instanceof ApiRequestError ? cause.message : 'Failed to unstage file.',
        );
      } finally {
        setActionPending(null);
      }
    },
    [loadStatus, projectId],
  );

  const commitStagedChanges = useCallback(async () => {
    if (!projectId) return;
    const message = commitMessage.trim();
    if (!message) {
      setChangesError('Enter a commit message before committing staged changes.');
      return;
    }
    setActionPending('commit');
    try {
      const nextStatus = await apiPost<ProjectGitStatusResult>(
        apiPath('projects', projectId, 'git', 'commit'),
        { message },
      );
      setStatus(nextStatus ?? null);
      setCommitMessage('');
      setSelectedChange(null);
      setDiff(null);
      setSelectedDiffMode('unstaged');
      setChangesError(null);
      await loadChanges();
    } catch (cause) {
      setChangesError(cause instanceof ApiRequestError ? cause.message : 'Failed to commit files.');
    } finally {
      setActionPending(null);
    }
  }, [commitMessage, loadChanges, projectId]);

  const currentStatus = status ?? EmptyGitStatus();
  const currentChanges = changes;
  const stagedFiles = currentChanges?.files.filter((file) => file.staged) ?? [];
  const untrackedFiles =
    currentChanges?.files.filter((file) => file.status === 'untracked' && !file.staged) ?? [];
  const unstagedFiles =
    currentChanges?.files.filter((file) => file.unstaged && file.status !== 'untracked') ?? [];
  const githubUrl = normalizeGitHubUrl(currentStatus.remoteUrl);
  const changesBadge = currentStatus.workingTree.total;
  const prsBadge = currentStatus.githubRemoteDetected ? 0 : undefined;
  const checksBadge = currentStatus.githubRemoteDetected ? 0 : undefined;
  const tabs = useMemo(
    () =>
      [
        ['overview', 'Overview', undefined],
        ['changes', 'Changes', changesBadge],
        ['commits', 'Commits', undefined],
        ['prs', 'PRs', prsBadge],
        ['checks', 'Checks', checksBadge],
      ] as const,
    [changesBadge, checksBadge, prsBadge],
  );

  if (!projectId) return null;

  return (
    <aside
      className={cn(
        'hidden shrink-0 border-l border-border bg-background/95 lg:flex',
        open ? 'w-[360px] max-w-[30vw]' : 'w-12',
      )}
      aria-label="Git and GitHub"
    >
      {!open ? (
        <button
          type="button"
          className="flex h-full w-full flex-col items-center gap-3 px-2 py-4 text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label="Open Git and GitHub panel"
          title="Open Git and GitHub panel"
        >
          <GitBranch className="h-5 w-5" />
          <span className="[writing-mode:vertical-rl] rotate-180 font-medium tracking-wide">
            Git
          </span>
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-3">
            <GitBranch className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Git & GitHub</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {currentStatus.available ? 'Local Git state' : 'No local Git repository'}
              </div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => void refreshGitViews()}
              disabled={loading || changesLoading}
              title="Refresh Git state"
              aria-label="Refresh Git state"
            >
              <RefreshCw className={cn('h-4 w-4', (loading || changesLoading) && 'animate-spin')} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setOpen(false)}
              title="Close Git and GitHub panel"
              aria-label="Close Git and GitHub panel"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-1 border-b border-border px-2 pt-2 text-xs">
            {tabs.map(([id, label, badge]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'border-b-2 px-2 py-2 text-muted-foreground hover:text-foreground',
                  activeTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent hover:border-muted-foreground/30',
                )}
                onClick={() => setActiveTab(id)}
              >
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {error && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {error}
              </div>
            )}
            {changesError && activeTab === 'changes' && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {changesError}
              </div>
            )}

            {!currentStatus.available ? (
              <>
                <ProjectInstructionsCard
                  status={projectInstructionsStatus}
                  isStarting={isStartingProjectInstructions}
                  onStart={onStartProjectInstructions}
                />
                <GitCard title="Repository">
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>{currentStatus.reason ?? 'This Project is not a Git repository.'}</span>
                  </div>
                </GitCard>
              </>
            ) : activeTab === 'overview' ? (
              <>
                <ProjectInstructionsCard
                  status={projectInstructionsStatus}
                  isStarting={isStartingProjectInstructions}
                  onStart={onStartProjectInstructions}
                />

                <GitCard title="Repository">
                  <div className="space-y-2">
                    <div className="font-medium">{currentStatus.repositoryName}</div>
                    {currentStatus.remoteUrl ? (
                      <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <span className="truncate">{currentStatus.remoteUrl}</span>
                        {githubUrl && (
                          <a
                            href={githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open remote repository"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        No origin remote configured.
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <StatusPill status={currentStatus} />
                      <span className="text-xs text-muted-foreground">
                        Updated from local Git state
                      </span>
                    </div>
                  </div>
                </GitCard>

                <GitCard title="Current Branch">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">
                        {currentStatus.currentBranch ?? 'Detached HEAD'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Base:{' '}
                      {currentStatus.baseBranch ?? currentStatus.upstreamBranch ?? 'No upstream'}
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-emerald-700">↑ {currentStatus.ahead}</span>
                      <span className="text-red-700">↓ {currentStatus.behind}</span>
                      {!currentStatus.clean && (
                        <span className="text-amber-700">Working tree has changes</span>
                      )}
                    </div>
                  </div>
                </GitCard>

                <GitCard title="Working Tree">
                  <div className="space-y-1">
                    <div className="mb-2 font-medium">
                      {currentStatus.clean
                        ? 'Clean'
                        : `${currentStatus.workingTree.total} change${
                            currentStatus.workingTree.total === 1 ? '' : 's'
                          }`}
                    </div>
                    <StatRow
                      label="Added"
                      value={currentStatus.workingTree.added}
                      tone="text-emerald-700"
                    />
                    <StatRow
                      label="Modified"
                      value={currentStatus.workingTree.modified}
                      tone="text-amber-700"
                    />
                    <StatRow
                      label="Deleted"
                      value={currentStatus.workingTree.deleted}
                      tone="text-red-700"
                    />
                    <StatRow label="Untracked" value={currentStatus.workingTree.untracked} />
                    <StatRow
                      label="Conflicts"
                      value={currentStatus.workingTree.conflicts}
                      tone="text-red-700"
                    />
                  </div>
                </GitCard>

                <GitCard title="Recent Commit">
                  {currentStatus.recentCommit ? (
                    <div className="space-y-2">
                      <div className="font-mono text-xs">
                        {shortSha(currentStatus.recentCommit.sha)}
                      </div>
                      <div className="font-medium">{currentStatus.recentCommit.subject}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <GitCommitHorizontal className="h-3.5 w-3.5" />
                        <span>{currentStatus.recentCommit.authorName ?? 'Unknown author'}</span>
                        <span>·</span>
                        <span>{relativeCommitLabel(currentStatus.recentCommit.committedAt)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No commits found.</div>
                  )}
                </GitCard>

                <GitCard title="GitHub Sensors">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      {currentStatus.githubRemoteDetected ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <span>
                        {currentStatus.githubRemoteDetected
                          ? 'GitHub remote detected. PRs and checks will appear after GitHub sensors are connected.'
                          : 'No GitHub remote detected. PRs and checks are unavailable for this Project.'}
                      </span>
                    </div>
                  </div>
                </GitCard>
              </>
            ) : activeTab === 'changes' ? (
              <>
                <GitCard title="Changes">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {currentStatus.clean
                          ? 'Working tree clean'
                          : `${currentStatus.workingTree.total} changed file${
                              currentStatus.workingTree.total === 1 ? '' : 's'
                            }`}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          changesLoading ||
                          actionPending !== null ||
                          currentStatus.workingTree.total === 0
                        }
                        onClick={() => void stagePaths('all')}
                      >
                        {actionPending === 'stage-all' ? 'Staging...' : 'Stage all'}
                      </Button>
                    </div>

                    <div className="rounded border border-border bg-muted/20 p-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-medium">Commit staged changes</div>
                          <div className="text-[11px] text-muted-foreground">
                            {stagedFiles.length === 0
                              ? 'Stage files before committing.'
                              : `${stagedFiles.length} staged file${
                                  stagedFiles.length === 1 ? '' : 's'
                                } ready.`}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={commitMessage}
                          onChange={(event) => setCommitMessage(event.target.value)}
                          placeholder="Commit message"
                          disabled={actionPending !== null}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              void commitStagedChanges();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            stagedFiles.length === 0 ||
                            actionPending !== null ||
                            commitMessage.trim().length === 0
                          }
                          onClick={() => void commitStagedChanges()}
                        >
                          {actionPending === 'commit' ? 'Committing...' : 'Commit'}
                        </Button>
                      </div>
                    </div>

                    {changesLoading && (
                      <div className="text-xs text-muted-foreground">Loading changed files...</div>
                    )}

                    {!changesLoading && currentChanges?.files.length === 0 && (
                      <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                        No local changes detected.
                      </div>
                    )}

                    {stagedFiles.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Staged
                        </div>
                        {stagedFiles.map((file) => (
                          <ChangeFileRow
                            key={`staged:${file.path}`}
                            file={file}
                            mode="staged"
                            selected={
                              selectedChange?.path === file.path && selectedDiffMode === 'staged'
                            }
                            onSelect={(nextFile, mode) => {
                              setSelectedChange(nextFile);
                              setSelectedDiffMode(mode);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {unstagedFiles.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Unstaged
                        </div>
                        {unstagedFiles.map((file) => (
                          <ChangeFileRow
                            key={`unstaged:${file.path}`}
                            file={file}
                            mode="unstaged"
                            selected={
                              selectedChange?.path === file.path && selectedDiffMode === 'unstaged'
                            }
                            onSelect={(nextFile, mode) => {
                              setSelectedChange(nextFile);
                              setSelectedDiffMode(mode);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {untrackedFiles.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Untracked
                        </div>
                        {untrackedFiles.map((file) => (
                          <ChangeFileRow
                            key={`untracked:${file.path}`}
                            file={file}
                            mode="unstaged"
                            selected={selectedChange?.path === file.path}
                            onSelect={(nextFile, mode) => {
                              setSelectedChange(nextFile);
                              setSelectedDiffMode(mode);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </GitCard>

                <GitCard title="Diff">
                  {selectedChange ? (
                    <div className="space-y-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div
                          className="min-w-0 flex-1 truncate font-mono text-xs"
                          title={selectedChange.path}
                        >
                          {selectedChange.path}
                        </div>
                        <Badge variant="outline">{selectedDiffMode}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedChange.unstaged && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void stagePaths([selectedChange.path])}
                            disabled={actionPending !== null}
                          >
                            {actionPending === `stage:${selectedChange.path}`
                              ? 'Staging...'
                              : 'Stage file'}
                          </Button>
                        )}
                        {selectedChange.staged && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void unstagePaths([selectedChange.path])}
                            disabled={actionPending !== null}
                          >
                            {actionPending === `unstage:${selectedChange.path}`
                              ? 'Unstaging...'
                              : 'Unstage file'}
                          </Button>
                        )}
                      </div>
                      {diffLoading ? (
                        <div className="text-xs text-muted-foreground">Loading diff...</div>
                      ) : (
                        <DiffPreview diff={diff?.diff ?? ''} />
                      )}
                      {diff?.truncated && (
                        <div className="text-xs text-amber-700">
                          Diff preview truncated to keep the panel responsive.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                      Select a changed file to review its diff.
                    </div>
                  )}
                </GitCard>
              </>
            ) : activeTab === 'commits' ? (
              <GitCard title="Commits">
                {currentStatus.recentCommit ? (
                  <div className="space-y-2">
                    <div className="font-mono text-xs">
                      {shortSha(currentStatus.recentCommit.sha)}
                    </div>
                    <div className="font-medium">{currentStatus.recentCommit.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      Full commit history is planned for the GitHub-aware sensor layer.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No commits found.</div>
                )}
              </GitCard>
            ) : activeTab === 'prs' ? (
              <GitCard title="Pull Requests">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <GitPullRequest className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Pull request state is not connected yet. This panel will use GitHub sensors
                    keyed by the current branch and remote.
                  </span>
                </div>
              </GitCard>
            ) : (
              <GitCard title="Checks">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    GitHub Actions, check runs, Sonar, and CodeQL are not connected yet. No check
                    data is being inferred.
                  </span>
                </div>
              </GitCard>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
