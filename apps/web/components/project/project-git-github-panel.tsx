'use client';

import type {
  ProjectGitChangedFile,
  ProjectGitChangesResult,
  ProjectGitChecksResult,
  ProjectGitDiffMode,
  ProjectGitFileDiffResult,
  ProjectGitPullRequestSummary,
  ProjectGitPullRequestsResult,
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

type PanelTab = 'overview' | 'changes' | 'commit' | 'push' | 'prs' | 'checks';

type GitWorkflowTab = Readonly<{
  id: PanelTab;
  label: string;
  badge?: number;
}>;

type GitWorkflowTone = 'neutral' | 'success' | 'warning' | 'danger';

type GitWorkflowOverview = Readonly<{
  title: string;
  description: string;
  tone: GitWorkflowTone;
  primaryAction?: Readonly<{
    label: string;
    tab: PanelTab;
  }>;
  detail?: string;
}>;

type GitPublishState = Readonly<{
  title: string;
  description: string;
  statusLabel: string;
  actionLabel?: string;
  canPublish: boolean;
  canClearStaleUpstream: boolean;
  pushed: boolean;
  detail?: string;
}>;

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
    upstreamState: 'none',
    githubRemoteDetected: false,
    workingTree: ZERO_WORKING_TREE,
  };
}

function StatusPill({ status }: Readonly<{ status: ProjectGitStatusResult }>) {
  if (!status.available) {
    return <Badge variant="outline">No Git</Badge>;
  }
  if (status.upstreamState === 'missing') {
    return <Badge variant="outline">Upstream missing</Badge>;
  }
  if (status.workingTree.conflicts > 0) {
    return <Badge variant="destructive">Conflicts</Badge>;
  }
  if (!status.clean) {
    return <Badge variant="outline">Changes</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Synced</Badge>;
}

function upstreamStateLabel(status: ProjectGitStatusResult): string {
  if (status.upstreamState === 'missing') return 'Upstream missing';
  if (status.upstreamBranch) return status.upstreamBranch;
  return 'No upstream';
}

function isLikelyPrimaryBranch(branch: string | undefined): boolean {
  return Boolean(branch && ['main', 'master', 'trunk', 'develop', 'development'].includes(branch));
}

export function deriveGitWorkflowOverview({
  status,
  pullRequests,
  checks,
}: Readonly<{
  status: ProjectGitStatusResult;
  pullRequests?: ProjectGitPullRequestsResult | null;
  checks?: ProjectGitChecksResult | null;
}>): GitWorkflowOverview {
  if (!status.available) {
    return {
      title: 'Git is unavailable',
      description: status.reason ?? 'This Project is not currently backed by a Git repository.',
      tone: 'warning',
    };
  }

  if (status.workingTree.conflicts > 0) {
    return {
      title: 'Resolve merge conflicts',
      description: `${status.workingTree.conflicts} conflicted file${
        status.workingTree.conflicts === 1 ? '' : 's'
      } need attention before this branch can continue.`,
      tone: 'danger',
      primaryAction: { label: 'Review changes', tab: 'changes' },
    };
  }

  if (status.upstreamState === 'missing') {
    return {
      title: 'Publish this branch',
      description:
        'This local branch tracks a remote branch that no longer exists. Publish it again or clear the stale upstream before pushing.',
      tone: 'warning',
      primaryAction: { label: 'Review publish options', tab: 'push' },
      detail: status.upstreamBranch ? `Missing upstream: ${status.upstreamBranch}` : undefined,
    };
  }

  if (!status.clean) {
    const staged = status.workingTree.staged;
    const total = status.workingTree.total;
    return {
      title: staged > 0 ? 'Commit staged changes' : 'Review local changes',
      description:
        staged > 0
          ? `${staged} staged file${staged === 1 ? '' : 's'} ready to commit.`
          : `${total} changed file${total === 1 ? '' : 's'} need review before committing.`,
      tone: 'warning',
      primaryAction: {
        label: staged > 0 ? 'Commit changes' : 'Review changes',
        tab: staged > 0 ? 'commit' : 'changes',
      },
    };
  }

  if (status.ahead > 0) {
    return {
      title: 'Push local commits',
      description: `${status.ahead} local commit${status.ahead === 1 ? '' : 's'} ${
        status.ahead === 1 ? 'is' : 'are'
      } ready to push to ${status.upstreamBranch ?? 'the upstream branch'}.`,
      tone: 'warning',
      primaryAction: { label: 'Push commits', tab: 'push' },
    };
  }

  const currentPullRequest = pullRequests?.pullRequests.find(
    (pullRequest) => pullRequest.currentBranch,
  );
  const failingChecks =
    checks?.available && checks.summary.failure + checks.summary.cancelled > 0
      ? checks.summary.failure + checks.summary.cancelled
      : 0;
  const runningChecks =
    checks?.available && checks.summary.inProgress + checks.summary.queued > 0
      ? checks.summary.inProgress + checks.summary.queued
      : 0;

  if (currentPullRequest) {
    if (failingChecks > 0 || currentPullRequest.checks.failure > 0) {
      return {
        title: 'Pull request checks need attention',
        description: `${failingChecks || currentPullRequest.checks.failure} check${
          (failingChecks || currentPullRequest.checks.failure) === 1 ? '' : 's'
        } failing on PR #${currentPullRequest.number}.`,
        tone: 'danger',
        primaryAction: { label: 'Review checks', tab: 'checks' },
      };
    }
    if (runningChecks > 0 || currentPullRequest.checks.pending > 0) {
      return {
        title: 'Pull request checks are running',
        description: `${runningChecks || currentPullRequest.checks.pending} check${
          (runningChecks || currentPullRequest.checks.pending) === 1 ? '' : 's'
        } still running on PR #${currentPullRequest.number}.`,
        tone: 'neutral',
        primaryAction: { label: 'View checks', tab: 'checks' },
      };
    }
    return {
      title: 'Pull request is open',
      description: `PR #${currentPullRequest.number} is open for ${currentPullRequest.headRefName}.`,
      tone: 'success',
      primaryAction: { label: 'View pull request', tab: 'prs' },
    };
  }

  if (
    status.githubRemoteDetected &&
    pullRequests?.available &&
    status.currentBranch &&
    !isLikelyPrimaryBranch(status.currentBranch)
  ) {
    return {
      title: 'Create a pull request',
      description: `${status.currentBranch} is pushed and has no open pull request yet.`,
      tone: 'neutral',
      primaryAction: { label: 'Review pull request options', tab: 'prs' },
    };
  }

  if (!status.githubRemoteDetected) {
    return {
      title: 'Local repository only',
      description:
        'This repository has no GitHub remote configured, so pull requests and GitHub checks are unavailable.',
      tone: 'neutral',
    };
  }

  return {
    title: 'Branch is up to date',
    description: 'No local changes, local commits, or pull request issues need attention.',
    tone: 'success',
  };
}

export function deriveGitWorkflowTabs({
  status,
  pullRequests,
  checks,
  commitSuccess,
  pushSuccess,
}: Readonly<{
  status: ProjectGitStatusResult;
  pullRequests?: ProjectGitPullRequestsResult | null;
  checks?: ProjectGitChecksResult | null;
  commitSuccess?: string | null;
  pushSuccess?: string | null;
}>): GitWorkflowTab[] {
  void commitSuccess;
  const tabs: GitWorkflowTab[] = [{ id: 'overview', label: 'Overview' }];
  if (!status.available) return tabs;

  const workingTree = status.workingTree;
  const hasChanges = workingTree.total > 0 || workingTree.conflicts > 0;
  const hasStagedChanges = workingTree.staged > 0;
  const hasPublishWork =
    status.clean &&
    (status.ahead > 0 || status.upstreamState === 'missing' || status.upstreamState === 'none');
  const currentPullRequest = pullRequests?.pullRequests.find(
    (pullRequest) => pullRequest.currentBranch,
  );
  const hasPullRequestStep =
    Boolean(currentPullRequest) ||
    Boolean(
      status.githubRemoteDetected &&
      status.clean &&
      status.currentBranch &&
      !isLikelyPrimaryBranch(status.currentBranch) &&
      status.upstreamState === 'active',
    ) ||
    Boolean(pushSuccess);
  const hasChecksStep =
    Boolean(
      checks?.available &&
      (checks.scope === 'pull_request' || checks.summary.total > 0 || currentPullRequest),
    ) || Boolean(currentPullRequest?.checks.total);

  if (hasChanges) {
    tabs.push({ id: 'changes', label: 'Changes', badge: workingTree.total });
  }

  if (hasStagedChanges) {
    tabs.push({
      id: 'commit',
      label: 'Commit',
      badge: workingTree.staged,
    });
  }

  if (hasPublishWork || pushSuccess) {
    const badge = status.ahead > 0 ? status.ahead : undefined;
    tabs.push({ id: 'push', label: status.upstreamState === 'none' ? 'Publish' : 'Push', badge });
  }

  if (hasPullRequestStep) {
    const badge =
      pullRequests?.pullRequests.length && pullRequests.pullRequests.length > 0
        ? pullRequests.pullRequests.length
        : undefined;
    tabs.push({ id: 'prs', label: 'PRs', badge });
  }

  if (hasChecksStep) {
    const badge =
      checks?.summary.total && checks.summary.total > 0 ? checks.summary.total : undefined;
    tabs.push({ id: 'checks', label: 'Checks', badge });
  }

  return tabs;
}

export function deriveGitPublishState({
  status,
  commitSuccess,
  pushSuccess,
}: Readonly<{
  status: ProjectGitStatusResult;
  commitSuccess?: string | null;
  pushSuccess?: string | null;
}>): GitPublishState {
  if (pushSuccess || (status.clean && status.upstreamState === 'active' && status.ahead === 0)) {
    return {
      title: 'Published',
      description: 'This branch is published and up to date with its upstream.',
      statusLabel: 'Published',
      canPublish: false,
      canClearStaleUpstream: false,
      pushed: true,
      detail: pushSuccess ?? undefined,
    };
  }

  if (!status.remoteUrl) {
    return {
      title: 'Connect this project to GitHub',
      description:
        'This local repository has no origin remote. You can keep working locally, or connect it to GitHub before publishing.',
      statusLabel: 'Not connected',
      actionLabel: undefined,
      canPublish: false,
      canClearStaleUpstream: false,
      pushed: false,
      detail: commitSuccess ?? undefined,
    };
  }

  if (status.upstreamState === 'missing') {
    return {
      title: 'Publish this branch again',
      description:
        'This branch tracks a remote branch that no longer exists. Publish it again, or clear the stale upstream and choose another route.',
      statusLabel: 'Stale upstream',
      actionLabel: 'Publish branch',
      canPublish: true,
      canClearStaleUpstream: true,
      pushed: false,
      detail: status.upstreamBranch ? `Missing upstream: ${status.upstreamBranch}` : undefined,
    };
  }

  if (status.upstreamState === 'none') {
    return {
      title: 'Publish this branch',
      description:
        'This branch has not been published yet. Publishing creates the remote branch and links future pushes to it.',
      statusLabel: 'Ready to publish',
      actionLabel: 'Publish branch',
      canPublish: true,
      canClearStaleUpstream: false,
      pushed: false,
      detail: commitSuccess ?? undefined,
    };
  }

  if (status.ahead > 0) {
    return {
      title: 'Push local commits',
      description: `${status.ahead} local commit${status.ahead === 1 ? '' : 's'} ${
        status.ahead === 1 ? 'is' : 'are'
      } ready to push.`,
      statusLabel: 'Ready to push',
      actionLabel: `Push ${status.ahead}`,
      canPublish: true,
      canClearStaleUpstream: false,
      pushed: false,
      detail: status.upstreamBranch ? `Upstream: ${status.upstreamBranch}` : undefined,
    };
  }

  return {
    title: 'Nothing to publish',
    description: 'There are no unpublished commits on this branch.',
    statusLabel: 'Up to date',
    canPublish: false,
    canClearStaleUpstream: false,
    pushed: false,
  };
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

function workflowToneClass(tone: GitWorkflowTone): string {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50/60';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50/60';
  if (tone === 'danger') return 'border-red-200 bg-red-50/60';
  return 'border-border bg-background';
}

function WorkflowOverviewCard({
  overview,
  onSelectTab,
}: Readonly<{
  overview: GitWorkflowOverview;
  onSelectTab: (tab: PanelTab) => void;
}>) {
  return (
    <section className={cn('rounded border px-3 py-3', workflowToneClass(overview.tone))}>
      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Next step
          </div>
          <div className="mt-1 font-medium">{overview.title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{overview.description}</p>
          {overview.detail && (
            <p className="mt-1 text-xs text-muted-foreground">{overview.detail}</p>
          )}
        </div>
        {overview.primaryAction && (
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => onSelectTab(overview.primaryAction?.tab ?? 'overview')}
          >
            {overview.primaryAction.label}
          </Button>
        )}
      </div>
    </section>
  );
}

export function shouldRenderGitStatusLoader({
  projectId,
  statusProjectId,
  loading,
  error,
}: Readonly<{
  projectId: string | null;
  statusProjectId: string | null;
  loading: boolean;
  error: string | null;
}>): boolean {
  if (!projectId || error) return false;
  return loading || statusProjectId !== projectId;
}

export function shouldRequestProjectGitDiff({
  projectId,
  activeTab,
  selectedChange,
  changesProjectId,
  changes,
}: Readonly<{
  projectId: string | null;
  activeTab: PanelTab;
  selectedChange: Pick<ProjectGitChangedFile, 'path'> | null;
  changesProjectId: string | null;
  changes: ProjectGitChangesResult | null;
}>): boolean {
  if (!projectId || activeTab !== 'changes' || !selectedChange) return false;
  if (changesProjectId !== projectId || !changes?.files.length) return false;
  return changes.files.some((file) => file.path === selectedChange.path);
}

function GitStatusLoadingCard() {
  return (
    <GitCard title="Git state">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Loading Git state...</span>
      </div>
    </GitCard>
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

function CheckStateIcon({ check }: Readonly<{ check: ProjectGitChecksResult['checks'][number] }>) {
  if (check.status === 'in_progress' || check.status === 'queued' || check.status === 'requested') {
    return <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" />;
  }
  if (check.conclusion === 'success' || check.conclusion === 'skipped') {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
  }
  if (
    check.conclusion === 'failure' ||
    check.conclusion === 'timed_out' ||
    check.conclusion === 'cancelled' ||
    check.conclusion === 'action_required'
  ) {
    return <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />;
  }
  return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />;
}

function CheckStateBadge({ check }: Readonly<{ check: ProjectGitChecksResult['checks'][number] }>) {
  if (check.status === 'in_progress' || check.status === 'queued' || check.status === 'requested') {
    return <Badge variant="outline">Running</Badge>;
  }
  if (check.conclusion === 'success') {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Success</Badge>;
  }
  if (check.conclusion === 'failure' || check.conclusion === 'timed_out') {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (check.conclusion === 'cancelled') {
    return <Badge variant="outline">Cancelled</Badge>;
  }
  if (check.conclusion === 'skipped') {
    return <Badge variant="outline">Skipped</Badge>;
  }
  return <Badge variant="outline">{check.conclusion ?? check.status}</Badge>;
}

function PullRequestStateBadge({
  pullRequest,
}: Readonly<{ pullRequest: ProjectGitPullRequestSummary }>) {
  if (pullRequest.isDraft) {
    return <Badge variant="outline">Draft</Badge>;
  }
  if (pullRequest.state === 'open') {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Open</Badge>;
  }
  if (pullRequest.state === 'merged') {
    return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Merged</Badge>;
  }
  if (pullRequest.state === 'closed') {
    return <Badge variant="outline">Closed</Badge>;
  }
  return <Badge variant="outline">Unknown</Badge>;
}

function reviewDecisionLabel(
  reviewDecision: ProjectGitPullRequestSummary['reviewDecision'],
): string {
  if (reviewDecision === 'approved') return 'Approved';
  if (reviewDecision === 'changes_requested') return 'Changes requested';
  if (reviewDecision === 'review_required') return 'Review required';
  return 'Review unknown';
}

function reviewDecisionTone(
  reviewDecision: ProjectGitPullRequestSummary['reviewDecision'],
): string {
  if (reviewDecision === 'approved') return 'text-emerald-700';
  if (reviewDecision === 'changes_requested') return 'text-red-700';
  if (reviewDecision === 'review_required') return 'text-amber-700';
  return 'text-muted-foreground';
}

function checkSummaryLabel(checks: ProjectGitPullRequestSummary['checks']): string {
  if (checks.total === 0) return 'No checks';
  if (checks.failure > 0) return `${checks.failure} failing`;
  if (checks.pending > 0) return `${checks.pending} pending`;
  if (checks.success === checks.total) return 'Checks passing';
  return `${checks.total} checks`;
}

function checkSummaryTone(checks: ProjectGitPullRequestSummary['checks']): string {
  if (checks.failure > 0) return 'text-red-700';
  if (checks.pending > 0) return 'text-amber-700';
  if (checks.total > 0 && checks.success === checks.total) return 'text-emerald-700';
  return 'text-muted-foreground';
}

function checksScopeLabel(checks: ProjectGitChecksResult): string {
  if (checks.scope === 'pull_request' && checks.pullRequestNumber) {
    return `Current PR #${checks.pullRequestNumber}`;
  }
  if (checks.scope === 'head_commit') return 'Current branch HEAD';
  return 'Current branch';
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
  const [statusProjectId, setStatusProjectId] = useState<string | null>(null);
  const [changes, setChanges] = useState<ProjectGitChangesResult | null>(null);
  const [changesProjectId, setChangesProjectId] = useState<string | null>(null);
  const [checks, setChecks] = useState<ProjectGitChecksResult | null>(null);
  const [checksProjectId, setChecksProjectId] = useState<string | null>(null);
  const [pullRequests, setPullRequests] = useState<ProjectGitPullRequestsResult | null>(null);
  const [pullRequestsProjectId, setPullRequestsProjectId] = useState<string | null>(null);
  const [selectedChange, setSelectedChange] = useState<ProjectGitChangedFile | null>(null);
  const [selectedDiffMode, setSelectedDiffMode] = useState<ProjectGitDiffMode>('unstaged');
  const [diff, setDiff] = useState<ProjectGitFileDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [changesLoading, setChangesLoading] = useState(false);
  const [checksLoading, setChecksLoading] = useState(false);
  const [pullRequestsLoading, setPullRequestsLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [checksError, setChecksError] = useState<string | null>(null);
  const [pullRequestsError, setPullRequestsError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!projectId) {
      setStatus(null);
      setStatusProjectId(null);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const next = await apiGet<ProjectGitStatusResult>(
        apiPath('projects', projectId, 'git', 'status'),
      );
      setStatus(next ?? EmptyGitStatus());
      setStatusProjectId(projectId);
      setError(null);
    } catch (cause) {
      setStatus(EmptyGitStatus());
      setStatusProjectId(projectId);
      setError(cause instanceof ApiRequestError ? cause.message : 'Failed to load Git state.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadChanges = useCallback(async () => {
    if (!projectId) {
      setChanges(null);
      setChangesProjectId(null);
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
      setChangesProjectId(projectId);
      setChangesError(null);
      setSelectedChange((current) => {
        if (!next?.files.length) return null;
        if (current && next.files.some((file) => file.path === current.path)) return current;
        return next.files[0] ?? null;
      });
    } catch (cause) {
      setChanges(null);
      setChangesProjectId(projectId);
      setSelectedChange(null);
      setDiff(null);
      setChangesError(cause instanceof ApiRequestError ? cause.message : 'Failed to load changes.');
    } finally {
      setChangesLoading(false);
    }
  }, [projectId]);

  const loadChecks = useCallback(async () => {
    if (!projectId) {
      setChecks(null);
      setChecksProjectId(null);
      setChecksError(null);
      return;
    }
    setChecksLoading(true);
    try {
      const next = await apiGet<ProjectGitChecksResult>(
        apiPath('projects', projectId, 'git', 'checks'),
      );
      setChecks(next ?? null);
      setChecksProjectId(projectId);
      setChecksError(null);
    } catch (cause) {
      setChecks(null);
      setChecksProjectId(projectId);
      setChecksError(cause instanceof ApiRequestError ? cause.message : 'Failed to load checks.');
    } finally {
      setChecksLoading(false);
    }
  }, [projectId]);

  const loadPullRequests = useCallback(async () => {
    if (!projectId) {
      setPullRequests(null);
      setPullRequestsProjectId(null);
      setPullRequestsError(null);
      return;
    }
    setPullRequestsLoading(true);
    try {
      const next = await apiGet<ProjectGitPullRequestsResult>(
        apiPath('projects', projectId, 'github', 'pull-requests'),
      );
      setPullRequests(next ?? null);
      setPullRequestsProjectId(projectId);
      setPullRequestsError(null);
    } catch (cause) {
      setPullRequests(null);
      setPullRequestsProjectId(projectId);
      setPullRequestsError(
        cause instanceof ApiRequestError ? cause.message : 'Failed to load pull requests.',
      );
    } finally {
      setPullRequestsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setStatus(null);
    setStatusProjectId(null);
    setChanges(null);
    setChangesProjectId(null);
    setChecks(null);
    setChecksProjectId(null);
    setPullRequests(null);
    setPullRequestsProjectId(null);
    setSelectedChange(null);
    setDiff(null);
    setError(null);
    setChangesError(null);
    setChecksError(null);
    setPullRequestsError(null);
    setCommitSuccess(null);
    setPushSuccess(null);
  }, [projectId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, refreshKey]);

  useEffect(() => {
    if (activeTab === 'changes' || activeTab === 'commit') void loadChanges();
  }, [activeTab, loadChanges, refreshKey]);

  useEffect(() => {
    if (activeTab === 'checks' || activeTab === 'overview') void loadChecks();
  }, [activeTab, loadChecks, refreshKey]);

  useEffect(() => {
    if (activeTab === 'prs' || activeTab === 'overview') void loadPullRequests();
  }, [activeTab, loadPullRequests, refreshKey]);

  useEffect(() => {
    const selectedPath = selectedChange?.path;
    if (
      !projectId ||
      !selectedPath ||
      !shouldRequestProjectGitDiff({
        projectId,
        activeTab,
        selectedChange,
        changesProjectId,
        changes,
      })
    ) {
      setDiff(null);
      return;
    }
    const params = new URLSearchParams({
      path: selectedPath,
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
  }, [activeTab, changes, changesProjectId, projectId, selectedChange, selectedDiffMode]);

  const refreshGitViews = useCallback(async () => {
    await Promise.all([
      loadStatus(),
      loadChanges(),
      activeTab === 'prs' || activeTab === 'overview' ? loadPullRequests() : null,
      activeTab === 'checks' || activeTab === 'overview' ? loadChecks() : null,
    ]);
  }, [activeTab, loadChanges, loadChecks, loadPullRequests, loadStatus]);

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
        setChangesProjectId(projectId);
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
        setChangesProjectId(projectId);
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
      setStatusProjectId(projectId);
      setCommitMessage('');
      setCommitSuccess(
        nextStatus?.recentCommit
          ? `Committed ${shortSha(nextStatus.recentCommit.sha)}: ${nextStatus.recentCommit.subject}`
          : 'Commit completed.',
      );
      setPushSuccess(null);
      setActiveTab('push');
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

  const pushCurrentBranch = useCallback(async () => {
    if (!projectId) return;
    setActionPending('push');
    try {
      const nextStatus = await apiPost<ProjectGitStatusResult>(
        apiPath('projects', projectId, 'git', 'push'),
        {},
      );
      setStatus(nextStatus ?? null);
      setStatusProjectId(projectId);
      setPushSuccess(
        nextStatus?.currentBranch
          ? `Pushed ${nextStatus.currentBranch} to ${nextStatus.upstreamBranch ?? 'upstream'}.`
          : 'Push completed.',
      );
      setError(null);
      await Promise.all([
        activeTab === 'changes' || activeTab === 'commit' ? loadChanges() : null,
        activeTab === 'checks' ? loadChecks() : Promise.resolve(),
        activeTab === 'prs' ? loadPullRequests() : Promise.resolve(),
      ]);
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : 'Failed to push branch.');
    } finally {
      setActionPending(null);
    }
  }, [activeTab, loadChanges, loadChecks, loadPullRequests, projectId]);

  const publishCurrentBranch = useCallback(async () => {
    if (!projectId) return;
    setActionPending('publish');
    try {
      const nextStatus = await apiPost<ProjectGitStatusResult>(
        apiPath('projects', projectId, 'git', 'publish'),
        {},
      );
      setStatus(nextStatus ?? null);
      setStatusProjectId(projectId);
      setPushSuccess(
        nextStatus?.currentBranch
          ? `Published ${nextStatus.currentBranch} to ${nextStatus.upstreamBranch ?? 'origin'}.`
          : 'Branch published.',
      );
      setCommitSuccess(null);
      setError(null);
      await Promise.all([
        activeTab === 'checks' ? loadChecks() : Promise.resolve(),
        activeTab === 'prs' ? loadPullRequests() : Promise.resolve(),
      ]);
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : 'Failed to publish branch.');
    } finally {
      setActionPending(null);
    }
  }, [activeTab, loadChecks, loadPullRequests, projectId]);

  const clearStaleUpstream = useCallback(async () => {
    if (!projectId) return;
    setActionPending('clear-upstream');
    try {
      const nextStatus = await apiPost<ProjectGitStatusResult>(
        apiPath('projects', projectId, 'git', 'clear-upstream'),
        {},
      );
      setStatus(nextStatus ?? null);
      setStatusProjectId(projectId);
      setPushSuccess(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : 'Failed to clear upstream.');
    } finally {
      setActionPending(null);
    }
  }, [projectId]);

  const statusLoading = shouldRenderGitStatusLoader({
    projectId,
    statusProjectId,
    loading,
    error,
  });
  const currentStatus = statusProjectId === projectId && status ? status : EmptyGitStatus();
  const currentChanges = changesProjectId === projectId ? changes : null;
  const currentChecks = checksProjectId === projectId ? checks : null;
  const currentPullRequests = pullRequestsProjectId === projectId ? pullRequests : null;
  const workflowOverview = deriveGitWorkflowOverview({
    status: currentStatus,
    pullRequests: currentPullRequests,
    checks: currentChecks,
  });
  const stagedFiles = currentChanges?.files.filter((file) => file.staged) ?? [];
  const untrackedFiles =
    currentChanges?.files.filter((file) => file.status === 'untracked' && !file.staged) ?? [];
  const unstagedFiles =
    currentChanges?.files.filter((file) => file.unstaged && file.status !== 'untracked') ?? [];
  const githubUrl = normalizeGitHubUrl(currentStatus.remoteUrl);
  const publishState = deriveGitPublishState({
    status: currentStatus,
    commitSuccess,
    pushSuccess,
  });
  const tabs = useMemo(
    () =>
      deriveGitWorkflowTabs({
        status: currentStatus,
        pullRequests: currentPullRequests,
        checks: currentChecks,
        commitSuccess,
        pushSuccess,
      }),
    [commitSuccess, currentChecks, currentPullRequests, currentStatus, pushSuccess],
  );

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, tabs]);

  if (!projectId) return null;

  return (
    <aside
      className={cn(
        'hidden h-full max-h-full min-h-0 shrink-0 overflow-hidden border-l border-border bg-background/95 lg:flex',
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
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
                {statusLoading
                  ? 'Loading Git state'
                  : currentStatus.available
                    ? 'Local Git state'
                    : 'No local Git repository'}
              </div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => void refreshGitViews()}
              disabled={loading || changesLoading || pullRequestsLoading || checksLoading}
              title="Refresh Git state"
              aria-label="Refresh Git state"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  (loading || changesLoading || pullRequestsLoading || checksLoading) &&
                    'animate-spin',
                )}
              />
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

          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 pt-2 text-xs">
            {tabs.map(({ id, label, badge }) => (
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

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 text-sm">
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
            {checksError && activeTab === 'checks' && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {checksError}
              </div>
            )}
            {pullRequestsError && activeTab === 'prs' && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {pullRequestsError}
              </div>
            )}

            {statusLoading ? (
              <>
                <ProjectInstructionsCard
                  status={projectInstructionsStatus}
                  isStarting={isStartingProjectInstructions}
                  onStart={onStartProjectInstructions}
                />
                <GitStatusLoadingCard />
              </>
            ) : !currentStatus.available ? (
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

                <WorkflowOverviewCard overview={workflowOverview} onSelectTab={setActiveTab} />

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
                      Base: {currentStatus.baseBranch ?? upstreamStateLabel(currentStatus)}
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-emerald-700">↑ {currentStatus.ahead}</span>
                      <span className="text-red-700">↓ {currentStatus.behind}</span>
                      {currentStatus.upstreamState === 'missing' && (
                        <span className="text-amber-700">Upstream missing</span>
                      )}
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
              </>
            ) : activeTab === 'changes' ? (
              <>
                <GitCard title="Changes">
                  <div className="flex min-h-0 flex-col gap-3">
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

                    {changesLoading && (
                      <div className="text-xs text-muted-foreground">Loading changed files...</div>
                    )}

                    {!changesLoading && currentChanges?.files.length === 0 && (
                      <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                        No local changes detected.
                      </div>
                    )}

                    <div className="max-h-[45vh] min-h-0 space-y-3 overflow-y-auto pr-1">
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
                                selectedChange?.path === file.path &&
                                selectedDiffMode === 'unstaged'
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
            ) : activeTab === 'commit' ? (
              <GitCard title="Commit">
                <div className="space-y-3">
                  {changesLoading && (
                    <div className="text-xs text-muted-foreground">Loading staged files...</div>
                  )}
                  <div>
                    <div className="font-medium">Commit staged changes</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {stagedFiles.length === 0
                        ? 'Stage files before committing.'
                        : `${stagedFiles.length} staged file${
                            stagedFiles.length === 1 ? '' : 's'
                          } ready.`}
                    </div>
                  </div>
                  {stagedFiles.length > 0 && (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                      {stagedFiles.map((file) => (
                        <ChangeFileRow
                          key={`commit:${file.path}`}
                          file={file}
                          mode="staged"
                          selected={
                            selectedChange?.path === file.path && selectedDiffMode === 'staged'
                          }
                          onSelect={(nextFile, mode) => {
                            setSelectedChange(nextFile);
                            setSelectedDiffMode(mode);
                            setActiveTab('changes');
                          }}
                        />
                      ))}
                    </div>
                  )}
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
              </GitCard>
            ) : activeTab === 'push' ? (
              <GitCard title="Publish">
                {currentStatus.recentCommit ? (
                  <div className="space-y-3">
                    {commitSuccess && (
                      <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        {commitSuccess}
                      </div>
                    )}
                    {pushSuccess && (
                      <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        {pushSuccess}
                      </div>
                    )}
                    <div className="font-mono text-xs">
                      {shortSha(currentStatus.recentCommit.sha)}
                    </div>
                    <div className="font-medium">{currentStatus.recentCommit.subject}</div>
                    <div className="rounded border border-border bg-muted/20 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{publishState.title}</div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {publishState.description}
                          </p>
                          {publishState.detail && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {publishState.detail}
                            </p>
                          )}
                        </div>
                        <Badge variant={publishState.pushed ? 'default' : 'outline'}>
                          {publishState.statusLabel}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {publishState.actionLabel && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={actionPending !== null || !publishState.canPublish}
                          onClick={() =>
                            currentStatus.upstreamState === 'active'
                              ? void pushCurrentBranch()
                              : void publishCurrentBranch()
                          }
                        >
                          {actionPending === 'push' || actionPending === 'publish'
                            ? 'Publishing...'
                            : publishState.actionLabel}
                        </Button>
                      )}
                      {publishState.canClearStaleUpstream && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actionPending !== null}
                          onClick={() => void clearStaleUpstream()}
                        >
                          {actionPending === 'clear-upstream'
                            ? 'Clearing...'
                            : 'Clear stale upstream'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setActiveTab('overview')}
                      >
                        Back to overview
                      </Button>
                    </div>
                    {!publishState.pushed &&
                      !publishState.canPublish &&
                      !currentStatus.remoteUrl && (
                        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          GitHub access is not connected for this Project yet. Use the terminal to
                          add an origin remote, or continue working locally until the GitHub
                          connection flow is available.
                        </div>
                      )}
                    {!publishState.pushed && (
                      <div className="rounded border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                        Not ready to publish? You can undo the last local commit from the terminal
                        with <span className="font-mono">git reset --soft HEAD~1</span> to keep
                        files staged, or <span className="font-mono">git reset HEAD~1</span> to keep
                        them unstaged.
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      After this branch is published, pull request options appear when they are
                      available.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No commits found.</div>
                )}
              </GitCard>
            ) : activeTab === 'prs' ? (
              <>
                <GitCard title="Pull Requests">
                  <div className="space-y-3">
                    {pullRequestsLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading GitHub pull requests...
                      </div>
                    )}

                    {!pullRequestsLoading &&
                      currentPullRequests &&
                      !currentPullRequests.available && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          {currentPullRequests.githubRemoteDetected ? (
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          ) : (
                            <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                          )}
                          <div className="space-y-1">
                            <div>
                              {currentPullRequests.reason ??
                                'GitHub pull requests are unavailable.'}
                            </div>
                            {currentPullRequests.githubRemoteDetected &&
                              !currentPullRequests.authenticated && (
                                <div className="text-xs">
                                  Authenticate with GitHub CLI in the terminal to enable live PRs.
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                    {!pullRequestsLoading && !currentPullRequests && (
                      <div className="text-sm text-muted-foreground">
                        Select refresh or open this tab again to load pull request state.
                      </div>
                    )}

                    {!pullRequestsLoading && currentPullRequests?.available && (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded border border-border bg-muted/20 px-2 py-2">
                            <div className="text-muted-foreground">Open PRs</div>
                            <div className="text-lg font-semibold">
                              {currentPullRequests.pullRequests.length}
                            </div>
                          </div>
                          <div className="rounded border border-border bg-muted/20 px-2 py-2">
                            <div className="text-muted-foreground">Current branch</div>
                            <div className="truncate text-sm font-semibold">
                              {currentPullRequests.currentBranch ?? 'Detached HEAD'}
                            </div>
                          </div>
                        </div>

                        {currentPullRequests.pullRequests.length === 0 ? (
                          <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                            No open GitHub pull requests were found for this repository.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {currentPullRequests.pullRequests.map((pullRequest) => (
                              <div
                                key={pullRequest.number}
                                className={cn(
                                  'rounded border bg-background px-3 py-2',
                                  pullRequest.currentBranch
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border',
                                )}
                              >
                                <div className="flex min-w-0 items-start gap-2">
                                  <GitPullRequest className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex min-w-0 items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                            #{pullRequest.number}
                                          </span>
                                          <a
                                            href={pullRequest.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="truncate text-sm font-medium hover:underline"
                                          >
                                            {pullRequest.title}
                                          </a>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                          <span className="font-mono">
                                            {pullRequest.headRefName} → {pullRequest.baseRefName}
                                          </span>
                                          {pullRequest.authorLogin && (
                                            <span>{pullRequest.authorLogin}</span>
                                          )}
                                          {pullRequest.updatedAt && (
                                            <span>
                                              {relativeCommitLabel(pullRequest.updatedAt)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <PullRequestStateBadge pullRequest={pullRequest} />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      {pullRequest.currentBranch && (
                                        <Badge
                                          variant="outline"
                                          className="border-primary/40 text-primary"
                                        >
                                          Current branch
                                        </Badge>
                                      )}
                                      <span
                                        className={reviewDecisionTone(pullRequest.reviewDecision)}
                                      >
                                        {reviewDecisionLabel(pullRequest.reviewDecision)}
                                      </span>
                                      <span className={checkSummaryTone(pullRequest.checks)}>
                                        {checkSummaryLabel(pullRequest.checks)}
                                      </span>
                                      <a
                                        href={pullRequest.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                      >
                                        Open on GitHub
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </GitCard>

                <GitCard title="Source">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>
                      {currentPullRequests?.repositoryName ??
                        currentStatus.repositoryName ??
                        'Repository'}{' '}
                      {(currentPullRequests?.currentBranch ?? currentStatus.currentBranch)
                        ? `· ${currentPullRequests?.currentBranch ?? currentStatus.currentBranch}`
                        : ''}
                    </div>
                    <div>
                      {currentPullRequests?.ghAvailable
                        ? 'GitHub CLI detected'
                        : 'GitHub CLI not confirmed for this Project'}
                    </div>
                    <div>
                      {currentPullRequests?.authenticated
                        ? 'Authenticated with github.com'
                        : 'GitHub authentication not confirmed'}
                    </div>
                    <div>Read-only PR visibility. PR actions are planned separately.</div>
                  </div>
                </GitCard>
              </>
            ) : (
              <>
                <GitCard title="Checks">
                  <div className="space-y-3">
                    {checksLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading GitHub checks...
                      </div>
                    )}

                    {!checksLoading && currentChecks && !currentChecks.available && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        {currentChecks.githubRemoteDetected ? (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        ) : (
                          <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        )}
                        <div className="space-y-1">
                          <div>{currentChecks.reason ?? 'GitHub checks are unavailable.'}</div>
                          {currentChecks.githubRemoteDetected && !currentChecks.authenticated && (
                            <div className="text-xs">
                              Authenticate with GitHub CLI in the terminal to enable live checks.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!checksLoading && !currentChecks && (
                      <div className="text-sm text-muted-foreground">
                        Select refresh or open this tab again to load check state.
                      </div>
                    )}

                    {!checksLoading && currentChecks?.available && (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded border border-border bg-muted/20 px-2 py-2">
                            <div className="text-muted-foreground">Total</div>
                            <div className="text-lg font-semibold">
                              {currentChecks.summary.total}
                            </div>
                          </div>
                          <div className="rounded border border-border bg-muted/20 px-2 py-2">
                            <div className="text-muted-foreground">Passing</div>
                            <div className="text-lg font-semibold text-emerald-700">
                              {currentChecks.summary.success}
                            </div>
                          </div>
                          <div className="rounded border border-border bg-muted/20 px-2 py-2">
                            <div className="text-muted-foreground">Failing</div>
                            <div className="text-lg font-semibold text-red-700">
                              {currentChecks.summary.failure}
                            </div>
                          </div>
                          <div className="rounded border border-border bg-muted/20 px-2 py-2">
                            <div className="text-muted-foreground">Running</div>
                            <div className="text-lg font-semibold text-blue-700">
                              {currentChecks.summary.inProgress + currentChecks.summary.queued}
                            </div>
                          </div>
                        </div>

                        {currentChecks.checks.length === 0 ? (
                          <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                            No GitHub checks were found for {checksScopeLabel(currentChecks)}.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {currentChecks.checks.map((check) => (
                              <div
                                key={check.id}
                                className="rounded border border-border bg-background px-3 py-2"
                              >
                                <div className="flex min-w-0 items-start gap-2">
                                  <CheckStateIcon check={check} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <div className="truncate text-sm font-medium">
                                        {check.name}
                                      </div>
                                      {check.url && (
                                        <a
                                          href={check.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          aria-label={`Open ${check.name} on GitHub`}
                                        >
                                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                        </a>
                                      )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                      {check.displayTitle && <span>{check.displayTitle}</span>}
                                      {check.workflowName && <span>{check.workflowName}</span>}
                                      {check.completedAt && (
                                        <span>{relativeCommitLabel(check.completedAt)}</span>
                                      )}
                                    </div>
                                  </div>
                                  <CheckStateBadge check={check} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </GitCard>

                <GitCard title="Source">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>
                      {currentChecks?.repositoryName ??
                        currentStatus.repositoryName ??
                        'Repository'}{' '}
                      {(currentChecks?.currentBranch ?? currentStatus.currentBranch)
                        ? `· ${currentChecks?.currentBranch ?? currentStatus.currentBranch}`
                        : ''}
                    </div>
                    {currentChecks?.available && <div>{checksScopeLabel(currentChecks)}</div>}
                    <div>
                      {currentChecks?.ghAvailable
                        ? 'GitHub CLI detected'
                        : 'GitHub CLI not confirmed for this Project'}
                    </div>
                    <div>
                      {currentChecks?.authenticated
                        ? 'Authenticated with github.com'
                        : 'GitHub authentication not confirmed'}
                    </div>
                  </div>
                </GitCard>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
