'use client';

import type { ProjectGitStatusResult } from '@agent-platform/contracts';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
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
import { apiGet, apiPath, ApiRequestError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';

type ProjectGitHubPanelProps = Readonly<{
  projectId: string | null;
  refreshKey?: number;
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

export function ProjectGitHubPanel({ projectId, refreshKey }: ProjectGitHubPanelProps) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<PanelTab>('overview');
  const [status, setStatus] = useState<ProjectGitStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshKey]);

  const currentStatus = status ?? EmptyGitStatus();
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
              onClick={() => void loadStatus()}
              disabled={loading}
              title="Refresh Git state"
              aria-label="Refresh Git state"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
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

            {!currentStatus.available ? (
              <GitCard title="Repository">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>{currentStatus.reason ?? 'This Project is not a Git repository.'}</span>
                </div>
              </GitCard>
            ) : activeTab === 'overview' ? (
              <>
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
                      <div className="text-xs text-muted-foreground">No origin remote configured.</div>
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
                      <span className="truncate">{currentStatus.currentBranch ?? 'Detached HEAD'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Base: {currentStatus.baseBranch ?? currentStatus.upstreamBranch ?? 'No upstream'}
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
                    <StatRow label="Added" value={currentStatus.workingTree.added} tone="text-emerald-700" />
                    <StatRow label="Modified" value={currentStatus.workingTree.modified} tone="text-amber-700" />
                    <StatRow label="Deleted" value={currentStatus.workingTree.deleted} tone="text-red-700" />
                    <StatRow label="Untracked" value={currentStatus.workingTree.untracked} />
                    <StatRow label="Conflicts" value={currentStatus.workingTree.conflicts} tone="text-red-700" />
                  </div>
                </GitCard>

                <GitCard title="Recent Commit">
                  {currentStatus.recentCommit ? (
                    <div className="space-y-2">
                      <div className="font-mono text-xs">{shortSha(currentStatus.recentCommit.sha)}</div>
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
              <GitCard title="Changes">
                <div className="space-y-1">
                  <StatRow label="Staged" value={currentStatus.workingTree.staged} />
                  <StatRow label="Unstaged" value={currentStatus.workingTree.unstaged} />
                  <StatRow label="Added" value={currentStatus.workingTree.added} tone="text-emerald-700" />
                  <StatRow label="Modified" value={currentStatus.workingTree.modified} tone="text-amber-700" />
                  <StatRow label="Deleted" value={currentStatus.workingTree.deleted} tone="text-red-700" />
                  <StatRow label="Renamed" value={currentStatus.workingTree.renamed} />
                  <StatRow label="Untracked" value={currentStatus.workingTree.untracked} />
                </div>
              </GitCard>
            ) : activeTab === 'commits' ? (
              <GitCard title="Commits">
                {currentStatus.recentCommit ? (
                  <div className="space-y-2">
                    <div className="font-mono text-xs">{shortSha(currentStatus.recentCommit.sha)}</div>
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
                    Pull request state is not connected yet. This panel will use GitHub sensors keyed
                    by the current branch and remote.
                  </span>
                </div>
              </GitCard>
            ) : (
              <GitCard title="Checks">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    GitHub Actions, check runs, Sonar, and CodeQL are not connected yet. No check data
                    is being inferred.
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
