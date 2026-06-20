'use client';

import type {
  ProjectBranchListResult,
  ProjectGitChangedFile,
  ProjectGitChangesResult,
  ProjectGitChecksResult,
  ProjectGitConflictFileResult,
  ProjectGitConflictSummary,
  ProjectGitCreatePullRequestResult,
  ProjectGitDiffMode,
  ProjectGitFileDiffResult,
  ProjectGitHubRepositoryConnectionResult,
  ProjectGitPullResult,
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
  Link,
  PanelRightClose,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { getDesktopWorkspaceBridge, openWorkspaceWebUrl } from '@/lib/desktop-workspace';
import { openDesktopProjectIde } from '@/lib/desktop-projects';

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
  canPull: boolean;
  canClearStaleUpstream: boolean;
  pushed: boolean;
  detail?: string;
}>;

type GitPullRequestCreateState = Readonly<{
  canCreate: boolean;
  currentPullRequest: ProjectGitPullRequestSummary | null;
  defaultTitle: string;
  baseBranch: string;
  repositoryUrl: string | null;
  reason?: string;
}>;

export function derivePullRequestBaseBranchOptions({
  status,
  branches,
}: Readonly<{
  status: ProjectGitStatusResult;
  branches?: ProjectBranchListResult | null;
}>): string[] {
  const seen = new Set<string>();
  const add = (branch: string | undefined) => {
    const trimmed = branch?.trim();
    if (!trimmed || trimmed === status.currentBranch || seen.has(trimmed)) return;
    seen.add(trimmed);
  };

  add(status.baseBranch && status.baseBranch !== status.currentBranch ? status.baseBranch : 'main');
  add('staging');
  add('develop');
  for (const branch of branches?.branches ?? []) {
    add(branch.name);
  }
  return [...seen];
}

export function resolvePullRequestBaseBranchValue({
  selectedBaseBranch,
  fallbackBaseBranch,
}: Readonly<{
  selectedBaseBranch: string;
  fallbackBaseBranch: string;
}>): string {
  return selectedBaseBranch.trim() || fallbackBaseBranch.trim();
}

export function recommendPullRequestBaseBranch({
  fallbackBaseBranch,
  options,
}: Readonly<{
  fallbackBaseBranch: string;
  options: readonly string[];
}>): string {
  if (options.includes('staging')) return 'staging';
  if (options.includes(fallbackBaseBranch)) return fallbackBaseBranch;
  return options[0] ?? fallbackBaseBranch;
}

type RepositoryConnectionMode = 'create' | 'connect';
type ConflictResolutionStrategy = 'current' | 'incoming' | 'both';

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

function openWorkspaceWebLink(
  event: React.MouseEvent<HTMLAnchorElement>,
  url: string,
  projectId: string | null,
): void {
  const bridge = getDesktopWorkspaceBridge();
  if (!bridge) return;
  event.preventDefault();
  openWorkspaceWebUrl({ url, projectId }).catch(() => undefined);
}

function runAsyncAction(action: () => Promise<unknown>): void {
  action().catch(() => undefined);
}

function getGitStateSummary(statusLoading: boolean, currentStatus: ProjectGitStatusResult): string {
  if (statusLoading) return 'Loading Git state';
  if (currentStatus.available) return 'Local Git state';
  return 'No local Git repository';
}

function getPublishActionLabel(
  actionPending: string | null,
  publishState: GitPublishState,
): string | undefined {
  if (actionPending === 'pull') return 'Pulling...';
  if (actionPending === 'push' || actionPending === 'publish') return 'Publishing...';
  return publishState.actionLabel;
}

function getRepositoryDialogTitle(mode: RepositoryConnectionMode): string {
  if (mode === 'create') return 'Create GitHub Repository';
  return 'Connect Existing Repository';
}

function getRepositoryDialogDescription(mode: RepositoryConnectionMode): string {
  if (mode === 'create') {
    return 'Create a GitHub repository, set it as origin, and push this project.';
  }
  return 'Connect this local project to a GitHub repository you already have.';
}

function getConflictPreviewText(
  loading: boolean,
  content: string | undefined,
  fallback = 'Select a conflicted file.',
): string {
  if (loading) return 'Loading...';
  return content || fallback;
}

export function deriveGitPullRequestCreateState({
  status,
  pullRequests,
}: Readonly<{
  status: ProjectGitStatusResult;
  pullRequests?: ProjectGitPullRequestsResult | null;
}>): GitPullRequestCreateState {
  const currentPullRequest =
    pullRequests?.pullRequests.find((pullRequest) => pullRequest.currentBranch) ?? null;
  const defaultTitle =
    status.recentCommit?.subject ??
    status.currentBranch ??
    pullRequests?.currentBranch ??
    'Pull request';
  const baseBranch =
    status.baseBranch && status.baseBranch !== status.currentBranch ? status.baseBranch : 'main';
  const repositoryUrl = normalizeGitHubUrl(status.remoteUrl ?? pullRequests?.remoteUrl);

  if (!status.available) {
    return {
      canCreate: false,
      currentPullRequest,
      defaultTitle,
      baseBranch,
      repositoryUrl,
      reason: status.reason ?? 'Git state is unavailable.',
    };
  }

  if (currentPullRequest) {
    return { canCreate: false, currentPullRequest, defaultTitle, baseBranch, repositoryUrl };
  }

  if (!status.githubRemoteDetected || !repositoryUrl) {
    return {
      canCreate: false,
      currentPullRequest,
      defaultTitle,
      baseBranch,
      repositoryUrl,
      reason: 'Connect this Project to GitHub before creating a pull request.',
    };
  }

  if (!pullRequests?.available) {
    return {
      canCreate: false,
      currentPullRequest,
      defaultTitle,
      baseBranch,
      repositoryUrl,
      reason: pullRequests?.reason ?? 'GitHub pull requests are unavailable.',
    };
  }

  if (!status.currentBranch || isLikelyPrimaryBranch(status.currentBranch)) {
    return {
      canCreate: false,
      currentPullRequest,
      defaultTitle,
      baseBranch,
      repositoryUrl,
      reason: 'Create pull requests from feature branches after publishing them.',
    };
  }

  if (status.upstreamState !== 'active') {
    return {
      canCreate: false,
      currentPullRequest,
      defaultTitle,
      baseBranch,
      repositoryUrl,
      reason: 'Publish this branch before creating a pull request.',
    };
  }

  if (status.ahead > 0) {
    return {
      canCreate: false,
      currentPullRequest,
      defaultTitle,
      baseBranch,
      repositoryUrl,
      reason: 'Push local commits before creating a pull request.',
    };
  }

  return { canCreate: true, currentPullRequest, defaultTitle, baseBranch, repositoryUrl };
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

export function defaultRepositoryName(repositoryName: string | undefined): string {
  const source = (repositoryName ?? 'new-project').trim().toLowerCase();
  const parts: string[] = [];
  for (const char of source) {
    if (isRepositoryNameCharacter(char)) {
      parts.push(char);
      continue;
    }
    if (parts.length > 0 && parts.at(-1) !== '-') {
      parts.push('-');
    }
  }

  let start = 0;
  let end = parts.length;
  while (start < end && parts[start] === '-') start += 1;
  while (end > start && parts[end - 1] === '-') end -= 1;
  const normalized = parts.slice(start, end).join('');
  return normalized || 'new-project';
}

function isRepositoryNameCharacter(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) {
    return false;
  }
  return (
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    char === '.' ||
    char === '_' ||
    char === '-'
  );
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

function currentStatusHasConflicts(status: ProjectGitStatusResult | null): boolean {
  return Boolean(status?.available && status.workingTree.conflicts > 0);
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

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function getUpstreamMissingOverview(status: ProjectGitStatusResult): GitWorkflowOverview | null {
  if (status.upstreamState !== 'missing') return null;

  return {
    title: 'Publish this branch',
    description:
      'This local branch tracks a remote branch that no longer exists. Publish it again or clear the stale upstream before pushing.',
    tone: 'warning',
    primaryAction: { label: 'Review publish options', tab: 'push' },
    detail: status.upstreamBranch ? `Missing upstream: ${status.upstreamBranch}` : undefined,
  };
}

function getWorkingTreeOverview(status: ProjectGitStatusResult): GitWorkflowOverview | null {
  if (status.workingTree.conflicts > 0) {
    return getWorkingTreeConflictOverview(status.workingTree.conflicts);
  }

  if (status.clean) return null;

  return getWorkingTreeChangeOverview(status.workingTree);
}

function getWorkingTreeConflictOverview(conflicts: number): GitWorkflowOverview {
  return {
    title: 'Resolve merge conflicts',
    description: `${conflicts} conflicted ${pluralize(
      conflicts,
      'file',
    )} need attention before this branch can continue.`,
    tone: 'danger',
    primaryAction: { label: 'Resolve conflicts', tab: 'push' },
  };
}

function getWorkingTreeChangeOverview(
  workingTree: ProjectGitStatusResult['workingTree'],
): GitWorkflowOverview {
  const { staged, total } = workingTree;
  const hasStaged = staged > 0;
  const description = hasStaged
    ? `${staged} staged ${pluralize(staged, 'file')} ready to commit.`
    : `${total} changed ${pluralize(total, 'file')} need review before committing.`;

  return {
    title: hasStaged ? 'Commit staged changes' : 'Review local changes',
    description,
    tone: 'warning',
    primaryAction: {
      label: hasStaged ? 'Commit changes' : 'Review changes',
      tab: hasStaged ? 'commit' : 'changes',
    },
  };
}

function getSyncOverview(status: ProjectGitStatusResult): GitWorkflowOverview | null {
  if (status.behind > 0) {
    return {
      title: 'Pull remote changes',
      description: `${status.behind} remote commit${status.behind === 1 ? '' : 's'} ${
        status.behind === 1 ? 'is' : 'are'
      } waiting on ${status.upstreamBranch ?? 'the upstream branch'}. Pull before pushing local work.`,
      tone: 'warning',
      primaryAction: { label: 'Review pull options', tab: 'push' },
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

  return null;
}

function getCurrentPullRequestOverview(
  currentPullRequest: ProjectGitPullRequestSummary | undefined,
  checks?: ProjectGitChecksResult | null,
): GitWorkflowOverview | null {
  if (!currentPullRequest) return null;

  const failingChecks =
    checks?.available && checks.summary.failure + checks.summary.cancelled > 0
      ? checks.summary.failure + checks.summary.cancelled
      : 0;
  const runningChecks =
    checks?.available && checks.summary.inProgress + checks.summary.queued > 0
      ? checks.summary.inProgress + checks.summary.queued
      : 0;

  if (failingChecks > 0 || currentPullRequest.checks.failure > 0) {
    const totalFailing = failingChecks || currentPullRequest.checks.failure;
    const checkLabel = totalFailing === 1 ? 'check' : 'checks';

    return {
      title: 'Pull request checks need attention',
      description: `${totalFailing} ${checkLabel} failing on PR #${currentPullRequest.number}.`,
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

function getCreatePullRequestOverview(
  status: ProjectGitStatusResult,
  pullRequests?: ProjectGitPullRequestsResult | null,
): GitWorkflowOverview | null {
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
  return null;
}

function getNoGithubRemoteOverview(status: ProjectGitStatusResult): GitWorkflowOverview {
  if (
    !status.githubRemoteDetected &&
    status.available &&
    !status.remoteUrl &&
    status.recentCommit
  ) {
    return {
      title: 'Connect this project to GitHub',
      description: 'This local repository has commits, but no GitHub repository is connected yet.',
      tone: 'warning',
      primaryAction: { label: 'Create or connect repository', tab: 'push' },
    };
  }

  return {
    title: 'Local repository only',
    description:
      'This repository has no GitHub remote configured, so pull requests and GitHub checks are unavailable.',
    tone: 'neutral',
  };
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

  const upstreamOverview = getUpstreamMissingOverview(status);
  if (upstreamOverview) return upstreamOverview;

  const workingTreeOverview = getWorkingTreeOverview(status);
  if (workingTreeOverview) return workingTreeOverview;

  const syncOverview = getSyncOverview(status);
  if (syncOverview) return syncOverview;

  const currentPullRequest = pullRequests?.pullRequests.find(
    (pullRequest) => pullRequest.currentBranch,
  );
  const currentPullRequestOverview = getCurrentPullRequestOverview(currentPullRequest, checks);
  if (currentPullRequestOverview) return currentPullRequestOverview;

  const createPullRequestOverview = getCreatePullRequestOverview(status, pullRequests);
  if (createPullRequestOverview) return createPullRequestOverview;

  if (!status.githubRemoteDetected) {
    return getNoGithubRemoteOverview(status);
  }

  return {
    title: 'Branch is up to date',
    description: 'No local changes, local commits, or pull request issues need attention.',
    tone: 'success',
  };
}

function shouldShowChangesTab(workingTree: ProjectGitStatusResult['workingTree']): boolean {
  return workingTree.total > 0 || workingTree.conflicts > 0;
}

function shouldShowCommitTab(workingTree: ProjectGitStatusResult['workingTree']): boolean {
  return workingTree.staged > 0;
}

function shouldShowPushTab(
  status: ProjectGitStatusResult,
  workingTree: ProjectGitStatusResult['workingTree'],
  pushSuccess?: string | null,
): boolean {
  const hasSyncWork =
    status.ahead > 0 ||
    status.behind > 0 ||
    status.upstreamState === 'missing' ||
    status.upstreamState === 'none';

  return Boolean(pushSuccess) || workingTree.conflicts > 0 || (status.clean && hasSyncWork);
}

function getPushTabLabel(
  status: ProjectGitStatusResult,
  workingTree: ProjectGitStatusResult['workingTree'],
): string {
  if (workingTree.conflicts > 0) return 'Resolve';
  if (status.behind > 0) return 'Pull';
  if (status.upstreamState === 'none') return 'Publish';
  return 'Push';
}

function getPushTabBadge(status: ProjectGitStatusResult): number | undefined {
  if (status.behind > 0) return status.behind;
  if (status.ahead > 0) return status.ahead;
  return undefined;
}

function shouldShowPullRequestTab(
  status: ProjectGitStatusResult,
  currentPullRequest: ProjectGitPullRequestsResult['pullRequests'][number] | undefined,
  pushSuccess?: string | null,
): boolean {
  return (
    Boolean(currentPullRequest) ||
    Boolean(
      status.githubRemoteDetected &&
      status.clean &&
      status.currentBranch &&
      !isLikelyPrimaryBranch(status.currentBranch) &&
      status.upstreamState === 'active',
    ) ||
    Boolean(pushSuccess)
  );
}

function getPullRequestTabBadge(
  pullRequests?: ProjectGitPullRequestsResult | null,
): number | undefined {
  return pullRequests?.pullRequests.length ? pullRequests.pullRequests.length : undefined;
}

function shouldShowChecksTab(
  checks: ProjectGitChecksResult | null | undefined,
  currentPullRequest: ProjectGitPullRequestsResult['pullRequests'][number] | undefined,
): boolean {
  const hasChecks =
    checks?.available &&
    (checks.scope === 'pull_request' || checks.summary.total > 0 || currentPullRequest);

  return Boolean(hasChecks) || Boolean(currentPullRequest?.checks.total);
}

function getChecksTabBadge(checks?: ProjectGitChecksResult | null): number | undefined {
  return checks?.summary.total && checks.summary.total > 0 ? checks.summary.total : undefined;
}

export function deriveGitWorkflowTabs({
  status,
  pullRequests,
  checks,
  pushSuccess,
}: Readonly<{
  status: ProjectGitStatusResult;
  pullRequests?: ProjectGitPullRequestsResult | null;
  checks?: ProjectGitChecksResult | null;
  commitSuccess?: string | null;
  pushSuccess?: string | null;
}>): GitWorkflowTab[] {
  const tabs: GitWorkflowTab[] = [{ id: 'overview', label: 'Overview' }];
  if (!status.available) return tabs;

  const { workingTree } = status;
  const currentPullRequest = pullRequests?.pullRequests.find((pr) => pr.currentBranch);

  if (shouldShowChangesTab(workingTree)) {
    tabs.push({ id: 'changes', label: 'Changes', badge: workingTree.total });
  }

  if (shouldShowCommitTab(workingTree)) {
    tabs.push({ id: 'commit', label: 'Commit', badge: workingTree.staged });
  }

  if (shouldShowPushTab(status, workingTree, pushSuccess)) {
    tabs.push({
      id: 'push',
      label: getPushTabLabel(status, workingTree),
      badge: getPushTabBadge(status),
    });
  }

  if (shouldShowPullRequestTab(status, currentPullRequest, pushSuccess)) {
    tabs.push({
      id: 'prs',
      label: 'PRs',
      badge: getPullRequestTabBadge(pullRequests),
    });
  }

  if (shouldShowChecksTab(checks, currentPullRequest)) {
    tabs.push({
      id: 'checks',
      label: 'Checks',
      badge: getChecksTabBadge(checks),
    });
  }

  return tabs;
}

export function resolveGitWorkflowActiveTab({
  activeTab,
  tabs,
  preferredTab,
}: Readonly<{
  activeTab: PanelTab;
  tabs: readonly GitWorkflowTab[];
  preferredTab?: PanelTab | null;
}>): PanelTab {
  if (tabs.some((tab) => tab.id === activeTab)) return activeTab;
  if (preferredTab && tabs.some((tab) => tab.id === preferredTab)) return preferredTab;
  return 'overview';
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
  if (status.workingTree.conflicts > 0) return getMergeConflictState();
  if (status.clean && status.behind > 0) return getPullRemoteChangesState(status);
  if (pushSuccess || (status.clean && status.upstreamState === 'active' && status.ahead === 0))
    return getPublishedState(pushSuccess);
  if (!status.remoteUrl) return getNotConnectedState(commitSuccess);
  if (status.upstreamState === 'missing') return getStaleUpstreamState(status);
  if (status.upstreamState === 'none') return getPublishBranchState(commitSuccess);
  if (status.ahead > 0) return getPushLocalCommitsState(status);

  return getNothingToPublishState();
}

function getMergeConflictState(): GitPublishState {
  return {
    title: 'Resolve merge conflicts',
    description:
      'This branch has unresolved merge conflicts. Resolve them before committing or pushing.',
    statusLabel: 'Conflicts',
    actionLabel: 'Resolve conflicts',
    canPublish: false,
    canPull: false,
    canClearStaleUpstream: false,
    pushed: false,
  };
}

function getPullRemoteChangesState(status: ProjectGitStatusResult): GitPublishState {
  return {
    title: 'Pull remote changes',
    description:
      status.ahead > 0
        ? 'This branch has local commits and remote commits. Pull remote changes before pushing.'
        : 'Remote commits are waiting on this branch. Pull them before continuing.',
    statusLabel: 'Pull required',
    actionLabel: 'Pull remote changes',
    canPublish: false,
    canPull: true,
    canClearStaleUpstream: false,
    pushed: false,
    detail: status.upstreamBranch ? `Upstream: ${status.upstreamBranch}` : undefined,
  };
}

function getPublishedState(pushSuccess?: string | null): GitPublishState {
  return {
    title: 'Published',
    description: 'This branch is published and up to date with its upstream.',
    statusLabel: 'Published',
    canPublish: false,
    canPull: false,
    canClearStaleUpstream: false,
    pushed: true,
    detail: pushSuccess ?? undefined,
  };
}

function getNotConnectedState(commitSuccess?: string | null): GitPublishState {
  return {
    title: 'Connect this project to GitHub',
    description:
      'This local repository has no origin remote. You can keep working locally, or connect it to GitHub before publishing.',
    statusLabel: 'Not connected',
    actionLabel: undefined,
    canPublish: false,
    canPull: false,
    canClearStaleUpstream: false,
    pushed: false,
    detail: commitSuccess ?? undefined,
  };
}

function getStaleUpstreamState(status: ProjectGitStatusResult): GitPublishState {
  return {
    title: 'Publish this branch again',
    description:
      'This branch tracks a remote branch that no longer exists. Publish it again, or clear the stale upstream and choose another route.',
    statusLabel: 'Stale upstream',
    actionLabel: 'Publish branch',
    canPublish: true,
    canPull: false,
    canClearStaleUpstream: true,
    pushed: false,
    detail: status.upstreamBranch ? `Missing upstream: ${status.upstreamBranch}` : undefined,
  };
}

function getPublishBranchState(commitSuccess?: string | null): GitPublishState {
  return {
    title: 'Publish this branch',
    description:
      'This branch has not been published yet. Publishing creates the remote branch and links future pushes to it.',
    statusLabel: 'Ready to publish',
    actionLabel: 'Publish branch',
    canPublish: true,
    canPull: false,
    canClearStaleUpstream: false,
    pushed: false,
    detail: commitSuccess ?? undefined,
  };
}

function getPushLocalCommitsState(status: ProjectGitStatusResult): GitPublishState {
  return {
    title: 'Push local commits',
    description: `${status.ahead} local commit${status.ahead === 1 ? '' : 's'} ${
      status.ahead === 1 ? 'is' : 'are'
    } ready to push.`,
    statusLabel: 'Ready to push',
    actionLabel: 'Push',
    canPublish: true,
    canPull: false,
    canClearStaleUpstream: false,
    pushed: false,
    detail: status.upstreamBranch ? `Upstream: ${status.upstreamBranch}` : undefined,
  };
}

function getNothingToPublishState(): GitPublishState {
  return {
    title: 'Nothing to publish',
    description: 'There are no unpublished commits on this branch.',
    statusLabel: 'Up to date',
    canPublish: false,
    canPull: false,
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

function canContinueToCommit(stagedFileCount: number, actionPending: string | null): boolean {
  return stagedFileCount > 0 && actionPending === null;
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

function ClosedGitHubPanelButton({ onOpen }: Readonly<{ onOpen: () => void }>) {
  return (
    <button
      type="button"
      className="flex h-full w-full flex-col items-center gap-3 px-2 py-4 text-xs text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      onClick={onOpen}
      aria-label="Open Git and GitHub panel"
      title="Open Git and GitHub panel"
    >
      <GitBranch className="h-5 w-5" />
      <span className="[writing-mode:vertical-rl] rotate-180 font-medium tracking-wide">Git</span>
    </button>
  );
}

function LiveStatusBadge() {
  return (
    <Badge
      variant="outline"
      className="inline-flex items-center gap-1 border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      <span>Live</span>
    </Badge>
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

type DiffLineKind = 'added' | 'deleted' | 'hunk' | 'file' | 'context';

function diffLineKind(line: string): DiffLineKind {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) {
    return 'file';
  }
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+')) return 'added';
  if (line.startsWith('-')) return 'deleted';
  return 'context';
}

function diffLineClass(kind: DiffLineKind): string {
  if (kind === 'added') return 'border-l-emerald-500 bg-emerald-950/35 text-emerald-100';
  if (kind === 'deleted') return 'border-l-red-500 bg-red-950/35 text-red-100';
  if (kind === 'hunk') return 'border-l-sky-500 bg-sky-950/45 text-sky-100';
  if (kind === 'file') return 'border-l-slate-500 bg-slate-900 text-slate-200';
  return 'border-l-transparent text-slate-300';
}

function diffPrefixClass(kind: DiffLineKind): string {
  if (kind === 'added') return 'text-emerald-300';
  if (kind === 'deleted') return 'text-red-300';
  if (kind === 'hunk') return 'text-sky-300';
  return 'text-slate-500';
}

function DiffPreview({ diff }: Readonly<{ diff: string }>) {
  const lines = diff.split('\n');

  if (!diff.trim()) {
    return (
      <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
        No diff available for this selection.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
          Unified diff
        </div>
        <div className="text-[11px] text-slate-500">
          {lines.length} line{lines.length === 1 ? '' : 's'}
        </div>
      </div>
      <div
        className="max-h-[430px] overflow-auto overscroll-contain"
        data-testid="project-git-diff-preview"
      >
        <div className="min-w-max py-1 font-mono text-[11px] leading-5">
          {lines.map((line, index) => {
            const kind = diffLineKind(line);
            const prefix = line[0] && ['+', '-', '@'].includes(line[0]) ? line[0] : ' ';
            return (
              <div
                key={`${index}:${line}`}
                className={cn(
                  'grid grid-cols-[3rem_1.25rem_minmax(0,1fr)] border-l-2',
                  diffLineClass(kind),
                )}
                data-diff-line-kind={kind}
              >
                <span className="select-none border-r border-slate-800/80 pr-2 text-right text-slate-600">
                  {index + 1}
                </span>
                <span className={cn('select-none text-center', diffPrefixClass(kind))}>
                  {prefix}
                </span>
                <code className="whitespace-pre pr-4">{line || ' '}</code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
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

function runWhenTabActive(
  activeTab: PanelTab,
  matchingTabs: readonly PanelTab[],
  action: () => Promise<unknown>,
): void {
  if (matchingTabs.includes(activeTab)) runAsyncAction(action);
}

function useConflictFileLoader({
  conflictResolverOpen,
  projectId,
  selectedConflictPath,
  setConflictError,
  setConflictFile,
  setConflictFileLoading,
}: Readonly<{
  conflictResolverOpen: boolean;
  projectId: string | null;
  selectedConflictPath: string | null;
  setConflictError: React.Dispatch<React.SetStateAction<string | null>>;
  setConflictFile: React.Dispatch<React.SetStateAction<ProjectGitConflictFileResult | null>>;
  setConflictFileLoading: React.Dispatch<React.SetStateAction<boolean>>;
}>) {
  useEffect(() => {
    if (!projectId || !selectedConflictPath || !conflictResolverOpen) {
      setConflictFile(null);
      return;
    }
    let cancelled = false;
    setConflictFileLoading(true);
    const params = new URLSearchParams({ path: selectedConflictPath });
    apiGet<ProjectGitConflictFileResult>(
      `${apiPath('projects', projectId, 'git', 'conflicts', 'file')}?${params.toString()}`,
    )
      .then((next) => {
        if (!cancelled) setConflictFile(next ?? null);
      })
      .catch((cause) => {
        if (!cancelled) {
          setConflictFile(null);
          setConflictError(
            cause instanceof ApiRequestError ? cause.message : 'Failed to load conflict file.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setConflictFileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    conflictResolverOpen,
    projectId,
    selectedConflictPath,
    setConflictError,
    setConflictFile,
    setConflictFileLoading,
  ]);
}

function useSelectedDiffLoader({
  activeTab,
  changes,
  changesProjectId,
  projectId,
  selectedChange,
  selectedDiffMode,
  setChangesError,
  setDiff,
  setDiffLoading,
}: Readonly<{
  activeTab: PanelTab;
  changes: ProjectGitChangesResult | null;
  changesProjectId: string | null;
  projectId: string | null;
  selectedChange: ProjectGitChangedFile | null;
  selectedDiffMode: ProjectGitDiffMode;
  setChangesError: React.Dispatch<React.SetStateAction<string | null>>;
  setDiff: React.Dispatch<React.SetStateAction<ProjectGitFileDiffResult | null>>;
  setDiffLoading: React.Dispatch<React.SetStateAction<boolean>>;
}>) {
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
  }, [
    activeTab,
    changes,
    changesProjectId,
    projectId,
    selectedChange,
    selectedDiffMode,
    setChangesError,
    setDiff,
    setDiffLoading,
  ]);
}

function useConflictSummaryLoader({
  conflictResolverOpen,
  loadConflicts,
  refreshKey,
  status,
}: Readonly<{
  conflictResolverOpen: boolean;
  loadConflicts: () => Promise<unknown>;
  refreshKey: number | undefined;
  status: ProjectGitStatusResult | null;
}>) {
  useEffect(() => {
    if (conflictResolverOpen || currentStatusHasConflicts(status)) runAsyncAction(loadConflicts);
  }, [conflictResolverOpen, loadConflicts, refreshKey, status]);
}

function usePullRequestDraftDefaults({
  activeTab,
  pullRequestBaseBranch,
  pullRequestCreateState,
  pullRequestTitle,
  recommendedPullRequestBaseBranch,
  setPullRequestBaseBranch,
  setPullRequestTitle,
}: Readonly<{
  activeTab: PanelTab;
  pullRequestBaseBranch: string;
  pullRequestCreateState: GitPullRequestCreateState;
  pullRequestTitle: string;
  recommendedPullRequestBaseBranch: string;
  setPullRequestBaseBranch: React.Dispatch<React.SetStateAction<string>>;
  setPullRequestTitle: React.Dispatch<React.SetStateAction<string>>;
}>) {
  useEffect(() => {
    if (activeTab === 'prs' && pullRequestCreateState.canCreate && !pullRequestTitle) {
      setPullRequestTitle(pullRequestCreateState.defaultTitle);
    }
    if (
      activeTab === 'prs' &&
      pullRequestCreateState.canCreate &&
      (!pullRequestBaseBranch || pullRequestBaseBranch === pullRequestCreateState.baseBranch)
    ) {
      setPullRequestBaseBranch(recommendedPullRequestBaseBranch);
    }
  }, [
    activeTab,
    pullRequestBaseBranch,
    pullRequestCreateState.baseBranch,
    pullRequestCreateState.canCreate,
    pullRequestCreateState.defaultTitle,
    pullRequestTitle,
    recommendedPullRequestBaseBranch,
    setPullRequestBaseBranch,
    setPullRequestTitle,
  ]);
}

function useResolvedGitWorkflowTab({
  activeTab,
  preferredTab,
  setActiveTab,
  setPreferredTab,
  tabs,
}: Readonly<{
  activeTab: PanelTab;
  preferredTab: PanelTab | null;
  setActiveTab: React.Dispatch<React.SetStateAction<PanelTab>>;
  setPreferredTab: React.Dispatch<React.SetStateAction<PanelTab | null>>;
  tabs: readonly GitWorkflowTab[];
}>) {
  useEffect(() => {
    const nextTab = resolveGitWorkflowActiveTab({ activeTab, tabs, preferredTab });
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    if (preferredTab && tabs.some((tab) => tab.id === preferredTab)) {
      setPreferredTab(null);
    }
  }, [activeTab, preferredTab, setActiveTab, setPreferredTab, tabs]);
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
        <span className="flex shrink-0 gap-1 text-[10px] text-muted-foreground">
          <span className="text-emerald-700">+{file.additions ?? 0}</span>
          <span className="text-red-700">-{file.deletions ?? 0}</span>
        </span>
      )}
    </button>
  );
}

type RepositoryConnectionDialogProps = {
  open: boolean;
  mode: RepositoryConnectionMode;
  actionPending: string | null;
  owner: string;
  name: string;
  description: string;
  visibility: 'private' | 'public';
  connectRepository: string;
  error: string | null;
  setMode: React.Dispatch<React.SetStateAction<RepositoryConnectionMode>>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOwner: React.Dispatch<React.SetStateAction<string>>;
  setName: React.Dispatch<React.SetStateAction<string>>;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  setVisibility: React.Dispatch<React.SetStateAction<'private' | 'public'>>;
  setConnectRepository: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  createRepository: () => Promise<void>;
  connectExistingRepository: () => Promise<void>;
};

function RepositoryConnectionDialog({
  open,
  mode,
  actionPending,
  owner,
  name,
  description,
  visibility,
  connectRepository,
  error,
  setMode,
  setOpen,
  setOwner,
  setName,
  setDescription,
  setVisibility,
  setConnectRepository,
  setError,
  createRepository,
  connectExistingRepository,
}: Readonly<RepositoryConnectionDialogProps>) {
  if (!open) return null;

  const createPending = actionPending === 'github-create-repository';
  const connectPending = actionPending === 'github-connect-repository';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{getRepositoryDialogTitle(mode)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {getRepositoryDialogDescription(mode)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close repository connection dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4 px-5 py-5 md:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <RepositoryDialogModeButton
              active={mode === 'create'}
              icon={<Plus className="h-4 w-4" />}
              label="Create repository"
              onClick={() => {
                setMode('create');
                setError(null);
              }}
            />
            <RepositoryDialogModeButton
              active={mode === 'connect'}
              icon={<Link className="h-4 w-4" />}
              label="Connect existing"
              onClick={() => {
                setMode('connect');
                setError(null);
              }}
            />
          </div>

          <div className="space-y-4">
            {error && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {error}
              </div>
            )}

            {mode === 'create' ? (
              <RepositoryCreateForm
                actionPending={actionPending}
                owner={owner}
                name={name}
                description={description}
                visibility={visibility}
                setOwner={setOwner}
                setName={setName}
                setDescription={setDescription}
                setVisibility={setVisibility}
                onCancel={() => setOpen(false)}
                onSubmit={() => runAsyncAction(createRepository)}
                createPending={createPending}
              />
            ) : (
              <RepositoryConnectForm
                actionPending={actionPending}
                connectRepository={connectRepository}
                setConnectRepository={setConnectRepository}
                onCancel={() => setOpen(false)}
                onSubmit={() => runAsyncAction(connectExistingRepository)}
                connectPending={connectPending}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RepositoryDialogModeButton({
  active,
  icon,
  label,
  onClick,
}: Readonly<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm',
        active ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-secondary/50',
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function RepositoryCreateForm({
  actionPending,
  owner,
  name,
  description,
  visibility,
  setOwner,
  setName,
  setDescription,
  setVisibility,
  onCancel,
  onSubmit,
  createPending,
}: Readonly<{
  actionPending: string | null;
  owner: string;
  name: string;
  description: string;
  visibility: 'private' | 'public';
  setOwner: React.Dispatch<React.SetStateAction<string>>;
  setName: React.Dispatch<React.SetStateAction<string>>;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  setVisibility: React.Dispatch<React.SetStateAction<'private' | 'public'>>;
  onCancel: () => void;
  onSubmit: () => void;
  createPending: boolean;
}>) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Owner</span>
          <Input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="GitHub user or organization"
            disabled={createPending}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Repository name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="repository-name"
            disabled={createPending}
          />
        </label>
      </div>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Description</span>
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional repository description"
          disabled={createPending}
        />
      </label>
      <div className="space-y-2 text-sm">
        <div className="font-medium">Visibility</div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={visibility === 'private' ? 'default' : 'outline'}
            onClick={() => setVisibility('private')}
            disabled={createPending}
          >
            Private
          </Button>
          <Button
            type="button"
            size="sm"
            variant={visibility === 'public' ? 'default' : 'outline'}
            onClick={() => setVisibility('public')}
            disabled={createPending}
          >
            Public
          </Button>
        </div>
      </div>
      <div className="rounded border border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
        This will create the repository on GitHub, add it as origin, and push the current branch.
      </div>
      <RepositoryDialogActions
        pendingLabel="Creating..."
        submitLabel="Create repository & push"
        pending={createPending}
        actionPending={actionPending}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </>
  );
}

function RepositoryConnectForm({
  actionPending,
  connectRepository,
  setConnectRepository,
  onCancel,
  onSubmit,
  connectPending,
}: Readonly<{
  actionPending: string | null;
  connectRepository: string;
  setConnectRepository: React.Dispatch<React.SetStateAction<string>>;
  onCancel: () => void;
  onSubmit: () => void;
  connectPending: boolean;
}>) {
  return (
    <>
      <label className="space-y-1 text-sm">
        <span className="font-medium">GitHub repository</span>
        <Input
          value={connectRepository}
          onChange={(event) => setConnectRepository(event.target.value)}
          placeholder="owner/repository or https://github.com/owner/repository"
          disabled={connectPending}
        />
      </label>
      <div className="rounded border border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
        AI Studio will validate the repository with GitHub CLI, add it as origin, and fetch it. If
        the remote already has commits, you will be guided through pull or conflict resolution
        before pushing.
      </div>
      <RepositoryDialogActions
        pendingLabel="Connecting..."
        submitLabel="Connect repository"
        pending={connectPending}
        actionPending={actionPending}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </>
  );
}

function RepositoryDialogActions({
  pendingLabel,
  submitLabel,
  pending,
  actionPending,
  onCancel,
  onSubmit,
}: Readonly<{
  pendingLabel: string;
  submitLabel: string;
  pending: boolean;
  actionPending: string | null;
  onCancel: () => void;
  onSubmit: () => void;
}>) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="button" onClick={onSubmit} disabled={actionPending !== null}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}

type ConflictResolverDialogProps = {
  open: boolean;
  projectId: string;
  status: ProjectGitStatusResult;
  conflictResolved: boolean;
  conflictCountText: string;
  conflictsLoading: boolean;
  conflictFiles: ProjectGitConflictSummary['files'];
  unresolvedConflictText: string;
  selectedConflictPath: string | null;
  conflictError: string | null;
  conflictFileLoading: boolean;
  conflictFile: ProjectGitConflictFileResult | null;
  mergeCommitMessage: string;
  actionPending: string | null;
  loadConflicts: () => Promise<void>;
  openProjectInSystemIde: () => Promise<void>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedConflictPath: React.Dispatch<React.SetStateAction<string | null>>;
  setConflictFile: React.Dispatch<React.SetStateAction<ProjectGitConflictFileResult | null>>;
  setMergeCommitMessage: React.Dispatch<React.SetStateAction<string>>;
  applyConflictChoice: (strategy: ConflictResolutionStrategy) => Promise<void>;
  commitMergeResolution: (push: boolean) => Promise<void>;
};

function ConflictResolverDialog({
  open,
  projectId,
  status,
  conflictResolved,
  conflictCountText,
  conflictsLoading,
  conflictFiles,
  unresolvedConflictText,
  selectedConflictPath,
  conflictError,
  conflictFileLoading,
  conflictFile,
  mergeCommitMessage,
  actionPending,
  loadConflicts,
  openProjectInSystemIde,
  setOpen,
  setSelectedConflictPath,
  setConflictFile,
  setMergeCommitMessage,
  applyConflictChoice,
  commitMergeResolution,
}: Readonly<ConflictResolverDialogProps>) {
  if (!open) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex bg-background text-foreground"
      aria-label="Merge conflict resolver"
    >
      <ConflictResolverSidebar
        projectId={projectId}
        status={status}
        conflictResolved={conflictResolved}
        conflictCountText={conflictCountText}
        conflictsLoading={conflictsLoading}
        loadConflicts={loadConflicts}
        openProjectInSystemIde={openProjectInSystemIde}
        setOpen={setOpen}
      />
      <ConflictFileList
        files={conflictFiles}
        conflictsLoading={conflictsLoading}
        unresolvedConflictText={unresolvedConflictText}
        selectedConflictPath={selectedConflictPath}
        setSelectedConflictPath={setSelectedConflictPath}
      />
      <ConflictResolverMain
        status={status}
        conflictResolved={conflictResolved}
        conflictFiles={conflictFiles}
        conflictError={conflictError}
        conflictFileLoading={conflictFileLoading}
        conflictFile={conflictFile}
        selectedConflictPath={selectedConflictPath}
        mergeCommitMessage={mergeCommitMessage}
        actionPending={actionPending}
        setOpen={setOpen}
        setConflictFile={setConflictFile}
        setSelectedConflictPath={setSelectedConflictPath}
        setMergeCommitMessage={setMergeCommitMessage}
        applyConflictChoice={applyConflictChoice}
        commitMergeResolution={commitMergeResolution}
      />
    </dialog>
  );
}

function ConflictResolverSidebar({
  projectId,
  status,
  conflictResolved,
  conflictCountText,
  conflictsLoading,
  loadConflicts,
  openProjectInSystemIde,
  setOpen,
}: Readonly<{
  projectId: string;
  status: ProjectGitStatusResult;
  conflictResolved: boolean;
  conflictCountText: string;
  conflictsLoading: boolean;
  loadConflicts: () => Promise<void>;
  openProjectInSystemIde: () => Promise<void>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>) {
  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-border bg-muted/20 p-4">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Git & GitHub</div>
          <div className="text-xs text-muted-foreground">Merge conflict workflow</div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setOpen(false)}
          aria-label="Close merge conflict resolver"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <GitCard title="Repository">
          <div className="space-y-2 text-sm">
            <div className="font-medium">{status.repositoryName}</div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="truncate">{status.currentBranch}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              ↑ {status.ahead} ↓ {status.behind}
            </div>
          </div>
        </GitCard>

        <section className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <div className="font-medium">
            {conflictResolved ? 'All conflicts resolved' : 'Merge conflicts detected'}
          </div>
          <div className="mt-1 text-xs">{conflictCountText}</div>
        </section>

        <Button
          type="button"
          className="w-full"
          variant={conflictResolved ? 'outline' : 'default'}
          onClick={() => runAsyncAction(loadConflicts)}
          disabled={conflictsLoading}
        >
          {conflictsLoading ? 'Refreshing...' : 'Refresh conflicts'}
        </Button>
        <Button type="button" className="w-full" variant="outline" onClick={() => setOpen(false)}>
          Exit resolver
        </Button>

        <GitCard title="Working Tree">
          <div className="space-y-1">
            <StatRow label="Staged" value={status.workingTree.staged} />
            <StatRow label="Conflicts" value={status.workingTree.conflicts} tone="text-red-700" />
            <StatRow label="Modified" value={status.workingTree.modified} />
            <StatRow label="Untracked" value={status.workingTree.untracked} />
          </div>
        </GitCard>

        <div className="rounded border border-border bg-background px-3 py-3 text-xs text-muted-foreground">
          <div className="mb-2">
            You can also open this Project folder in your local IDE if a file needs deeper edits.
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={!projectId}
            onClick={() => {
              runAsyncAction(openProjectInSystemIde);
            }}
          >
            Open local IDE
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConflictFileList({
  files,
  conflictsLoading,
  unresolvedConflictText,
  selectedConflictPath,
  setSelectedConflictPath,
}: Readonly<{
  files: ProjectGitConflictSummary['files'];
  conflictsLoading: boolean;
  unresolvedConflictText: string;
  selectedConflictPath: string | null;
  setSelectedConflictPath: React.Dispatch<React.SetStateAction<string | null>>;
}>) {
  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-border p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Files with conflicts</h2>
        <p className="text-xs text-muted-foreground">
          {conflictsLoading ? 'Loading conflicts...' : unresolvedConflictText}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {files.length === 0 && (
          <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
            No conflicted files are currently reported.
          </div>
        )}
        {files.map((file) => (
          <button
            type="button"
            key={file.path}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-xs',
              selectedConflictPath === file.path
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background hover:bg-secondary/50',
            )}
            onClick={() => setSelectedConflictPath(file.path)}
          >
            <span className="min-w-0 flex-1 truncate font-mono">{file.path}</span>
            <Badge variant={file.resolved ? 'outline' : 'destructive'}>
              {file.resolved ? 'resolved' : file.conflictCount}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConflictResolverMain({
  status,
  conflictResolved,
  conflictFiles,
  conflictError,
  conflictFileLoading,
  conflictFile,
  selectedConflictPath,
  mergeCommitMessage,
  actionPending,
  setOpen,
  setConflictFile,
  setSelectedConflictPath,
  setMergeCommitMessage,
  applyConflictChoice,
  commitMergeResolution,
}: Readonly<{
  status: ProjectGitStatusResult;
  conflictResolved: boolean;
  conflictFiles: ProjectGitConflictSummary['files'];
  conflictError: string | null;
  conflictFileLoading: boolean;
  conflictFile: ProjectGitConflictFileResult | null;
  selectedConflictPath: string | null;
  mergeCommitMessage: string;
  actionPending: string | null;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setConflictFile: React.Dispatch<React.SetStateAction<ProjectGitConflictFileResult | null>>;
  setSelectedConflictPath: React.Dispatch<React.SetStateAction<string | null>>;
  setMergeCommitMessage: React.Dispatch<React.SetStateAction<string>>;
  applyConflictChoice: (strategy: ConflictResolutionStrategy) => Promise<void>;
  commitMergeResolution: (push: boolean) => Promise<void>;
}>) {
  return (
    <div className="flex min-w-0 flex-1 flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {conflictResolved ? 'Merge Conflicts Resolved' : 'Resolve Merge Conflicts'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the code to keep for each conflicted file, then commit the merge resolution.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      {conflictError && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {conflictError}
        </div>
      )}

      {conflictResolved ? (
        <ResolvedConflictPanel
          status={status}
          conflictFiles={conflictFiles}
          mergeCommitMessage={mergeCommitMessage}
          actionPending={actionPending}
          setMergeCommitMessage={setMergeCommitMessage}
          commitMergeResolution={commitMergeResolution}
        />
      ) : (
        <UnresolvedConflictPanel
          selectedConflictPath={selectedConflictPath}
          conflictFileLoading={conflictFileLoading}
          conflictFile={conflictFile}
          actionPending={actionPending}
          setConflictFile={setConflictFile}
          setSelectedConflictPath={setSelectedConflictPath}
          applyConflictChoice={applyConflictChoice}
        />
      )}
    </div>
  );
}

function ResolvedConflictPanel({
  status,
  conflictFiles,
  mergeCommitMessage,
  actionPending,
  setMergeCommitMessage,
  commitMergeResolution,
}: Readonly<{
  status: ProjectGitStatusResult;
  conflictFiles: ProjectGitConflictSummary['files'];
  mergeCommitMessage: string;
  actionPending: string | null;
  setMergeCommitMessage: React.Dispatch<React.SetStateAction<string>>;
  commitMergeResolution: (push: boolean) => Promise<void>;
}>) {
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-4">
      <div className="grid grid-cols-4 gap-3">
        <ConflictMetric label="Files reviewed" value={conflictFiles.length} />
        <ConflictMetric label="Conflicts remaining" value={0} className="text-emerald-700" />
        <ConflictMetric label="Commits ahead" value={status.ahead} />
        <ConflictMetric label="Commits behind" value={status.behind} />
      </div>
      <div className="min-h-0 overflow-y-auto rounded border border-border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Resolved files</h2>
        <div className="space-y-2">
          {conflictFiles.map((file) => (
            <div
              key={file.path}
              className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
            >
              <span className="font-mono">{file.path}</span>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                Resolved
              </Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded border border-border bg-background p-4">
        <div className="mb-3 font-medium">Commit merge resolution</div>
        <div className="flex gap-2">
          <Input
            value={mergeCommitMessage}
            onChange={(event) => setMergeCommitMessage(event.target.value)}
            placeholder="Merge commit message"
            disabled={actionPending !== null}
          />
          <Button
            type="button"
            onClick={() => runAsyncAction(() => commitMergeResolution(false))}
            disabled={actionPending !== null || !mergeCommitMessage.trim()}
          >
            {actionPending === 'merge-commit' ? 'Committing...' : 'Commit merge'}
          </Button>
          <Button
            type="button"
            onClick={() => runAsyncAction(() => commitMergeResolution(true))}
            disabled={actionPending !== null || !mergeCommitMessage.trim()}
          >
            {actionPending === 'merge-commit-push' ? 'Pushing...' : 'Commit & push'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConflictMetric({
  label,
  value,
  className,
}: Readonly<{ label: string; value: number; className?: string }>) {
  return (
    <div className="rounded border border-border px-4 py-3">
      <div className={cn('text-2xl font-semibold', className)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function UnresolvedConflictPanel({
  selectedConflictPath,
  conflictFileLoading,
  conflictFile,
  actionPending,
  setConflictFile,
  setSelectedConflictPath,
  applyConflictChoice,
}: Readonly<{
  selectedConflictPath: string | null;
  conflictFileLoading: boolean;
  conflictFile: ProjectGitConflictFileResult | null;
  actionPending: string | null;
  setConflictFile: React.Dispatch<React.SetStateAction<ProjectGitConflictFileResult | null>>;
  setSelectedConflictPath: React.Dispatch<React.SetStateAction<string | null>>;
  applyConflictChoice: (strategy: ConflictResolutionStrategy) => Promise<void>;
}>) {
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-4">
      <div className="grid min-h-0 grid-cols-3 overflow-hidden rounded border border-border">
        <ConflictPreviewColumn
          title="Current"
          titleClassName="bg-emerald-50"
          text={getConflictPreviewText(
            conflictFileLoading,
            conflictFile?.hunks.map((hunk) => hunk.current).join('\n'),
          )}
        />
        <ConflictPreviewColumn
          title="Incoming"
          titleClassName="bg-red-50"
          text={getConflictPreviewText(
            conflictFileLoading,
            conflictFile?.hunks.map((hunk) => hunk.incoming).join('\n'),
          )}
        />
        <ConflictPreviewColumn
          title="Result"
          titleClassName="bg-primary/5"
          text={getConflictPreviewText(conflictFileLoading, conflictFile?.content)}
          last
        />
      </div>
      <div className="flex flex-wrap gap-2 rounded border border-border bg-background p-3">
        <ConflictChoiceButton
          label="Accept current"
          disabled={!selectedConflictPath || actionPending !== null}
          onClick={() => runAsyncAction(() => applyConflictChoice('current'))}
        />
        <ConflictChoiceButton
          label="Accept incoming"
          disabled={!selectedConflictPath || actionPending !== null}
          onClick={() => runAsyncAction(() => applyConflictChoice('incoming'))}
        />
        <ConflictChoiceButton
          label="Accept both"
          disabled={!selectedConflictPath || actionPending !== null}
          onClick={() => runAsyncAction(() => applyConflictChoice('both'))}
        />
        <Button
          type="button"
          variant="ghost"
          disabled={!selectedConflictPath || conflictFileLoading}
          onClick={() => {
            setConflictFile(null);
            const currentPath = selectedConflictPath;
            setSelectedConflictPath(null);
            globalThis.setTimeout(() => setSelectedConflictPath(currentPath), 0);
          }}
        >
          Reset view
        </Button>
      </div>
    </div>
  );
}

function ConflictPreviewColumn({
  title,
  titleClassName,
  text,
  last = false,
}: Readonly<{ title: string; titleClassName: string; text: string; last?: boolean }>) {
  return (
    <div className={cn('min-h-0 overflow-y-auto', !last && 'border-r border-border')}>
      <div className={cn('border-b border-border px-3 py-2 text-sm font-medium', titleClassName)}>
        {title}
      </div>
      <pre className="whitespace-pre-wrap p-3 font-mono text-xs">{text}</pre>
    </div>
  );
}

function ConflictChoiceButton({
  label,
  disabled,
  onClick,
}: Readonly<{ label: string; disabled: boolean; onClick: () => void }>) {
  return (
    <Button type="button" variant="outline" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
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
  const [preferredTab, setPreferredTab] = useState<PanelTab | null>(null);
  const [status, setStatus] = useState<ProjectGitStatusResult | null>(null);
  const [statusProjectId, setStatusProjectId] = useState<string | null>(null);
  const [changes, setChanges] = useState<ProjectGitChangesResult | null>(null);
  const [changesProjectId, setChangesProjectId] = useState<string | null>(null);
  const [checks, setChecks] = useState<ProjectGitChecksResult | null>(null);
  const [checksProjectId, setChecksProjectId] = useState<string | null>(null);
  const [pullRequests, setPullRequests] = useState<ProjectGitPullRequestsResult | null>(null);
  const [pullRequestsProjectId, setPullRequestsProjectId] = useState<string | null>(null);
  const [branches, setBranches] = useState<ProjectBranchListResult | null>(null);
  const [branchesProjectId, setBranchesProjectId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ProjectGitConflictSummary | null>(null);
  const [conflictFile, setConflictFile] = useState<ProjectGitConflictFileResult | null>(null);
  const [selectedConflictPath, setSelectedConflictPath] = useState<string | null>(null);
  const [conflictResolverOpen, setConflictResolverOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<ProjectGitChangedFile | null>(null);
  const [selectedDiffMode, setSelectedDiffMode] = useState<ProjectGitDiffMode>('unstaged');
  const [diff, setDiff] = useState<ProjectGitFileDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [changesLoading, setChangesLoading] = useState(false);
  const [checksLoading, setChecksLoading] = useState(false);
  const [pullRequestsLoading, setPullRequestsLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictFileLoading, setConflictFileLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [checksError, setChecksError] = useState<string | null>(null);
  const [pullRequestsError, setPullRequestsError] = useState<string | null>(null);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [pullRequestTitle, setPullRequestTitle] = useState('');
  const [pullRequestBaseBranch, setPullRequestBaseBranch] = useState('');
  const [pullRequestBody, setPullRequestBody] = useState('');
  const [pullRequestSuccess, setPullRequestSuccess] = useState<string | null>(null);
  const [mergeCommitMessage, setMergeCommitMessage] = useState('Resolve merge conflicts');
  const [repositoryDialogOpen, setRepositoryDialogOpen] = useState(false);
  const [repositoryDialogMode, setRepositoryDialogMode] =
    useState<RepositoryConnectionMode>('create');
  const [repositoryOwner, setRepositoryOwner] = useState('');
  const [repositoryName, setRepositoryName] = useState('');
  const [repositoryDescription, setRepositoryDescription] = useState('');
  const [repositoryVisibility, setRepositoryVisibility] = useState<'private' | 'public'>('private');
  const [connectRepository, setConnectRepository] = useState('');
  const [repositoryActionError, setRepositoryActionError] = useState<string | null>(null);
  const [repositoryActionSuccess, setRepositoryActionSuccess] = useState<string | null>(null);
  const [lastRepositoryUrl, setLastRepositoryUrl] = useState<string | null>(null);

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

  const loadBranches = useCallback(async () => {
    if (!projectId) {
      setBranches(null);
      setBranchesProjectId(null);
      setBranchesError(null);
      return;
    }
    setBranchesLoading(true);
    try {
      const next = await apiGet<ProjectBranchListResult>(
        apiPath('projects', projectId, 'branches'),
      );
      setBranches(next ?? null);
      setBranchesProjectId(projectId);
      setBranchesError(null);
    } catch (cause) {
      setBranches(null);
      setBranchesProjectId(projectId);
      if (cause instanceof ApiRequestError && cause.code === 'PROJECT_GIT_UNAVAILABLE') {
        setBranchesError(null);
      } else {
        setBranchesError(
          cause instanceof ApiRequestError ? cause.message : 'Branch information is unavailable.',
        );
      }
    } finally {
      setBranchesLoading(false);
    }
  }, [projectId]);

  const loadConflicts = useCallback(async () => {
    if (!projectId) {
      setConflicts(null);
      setConflictFile(null);
      setSelectedConflictPath(null);
      setConflictError(null);
      return;
    }
    setConflictsLoading(true);
    try {
      const next = await apiGet<ProjectGitConflictSummary>(
        apiPath('projects', projectId, 'git', 'conflicts'),
      );
      setConflicts(next ?? null);
      setConflictError(null);
      setSelectedConflictPath((current) => {
        if (!next?.files.length) return null;
        if (current && next.files.some((file) => file.path === current)) return current;
        return next.files[0]?.path ?? null;
      });
    } catch (cause) {
      setConflicts(null);
      setConflictError(
        cause instanceof ApiRequestError ? cause.message : 'Failed to load merge conflicts.',
      );
    } finally {
      setConflictsLoading(false);
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
    setBranches(null);
    setBranchesProjectId(null);
    setConflicts(null);
    setConflictFile(null);
    setSelectedConflictPath(null);
    setConflictResolverOpen(false);
    setSelectedChange(null);
    setDiff(null);
    setError(null);
    setChangesError(null);
    setChecksError(null);
    setPullRequestsError(null);
    setBranchesError(null);
    setConflictError(null);
    setPullRequestTitle('');
    setPullRequestBaseBranch('');
    setPullRequestBody('');
    setPullRequestSuccess(null);
    setCommitSuccess(null);
    setPushSuccess(null);
    setLastRepositoryUrl(null);
    setRepositoryDialogOpen(false);
    setRepositoryActionError(null);
    setRepositoryActionSuccess(null);
  }, [projectId]);

  useEffect(() => {
    runAsyncAction(loadStatus);
  }, [loadStatus, refreshKey]);

  useEffect(() => {
    runWhenTabActive(activeTab, ['changes', 'commit'], loadChanges);
  }, [activeTab, loadChanges, refreshKey]);

  useEffect(() => {
    runWhenTabActive(activeTab, ['checks', 'overview'], loadChecks);
  }, [activeTab, loadChecks, refreshKey]);

  useEffect(() => {
    runWhenTabActive(activeTab, ['prs', 'overview'], loadPullRequests);
  }, [activeTab, loadPullRequests, refreshKey]);

  useEffect(() => {
    runWhenTabActive(activeTab, ['prs'], loadBranches);
  }, [activeTab, loadBranches, refreshKey]);

  useConflictSummaryLoader({
    conflictResolverOpen,
    loadConflicts,
    refreshKey,
    status,
  });

  useConflictFileLoader({
    conflictResolverOpen,
    projectId,
    selectedConflictPath,
    setConflictError,
    setConflictFile,
    setConflictFileLoading,
  });

  useSelectedDiffLoader({
    activeTab,
    changes,
    changesProjectId,
    projectId,
    selectedChange,
    selectedDiffMode,
    setChangesError,
    setDiff,
    setDiffLoading,
  });

  const refreshGitViews = useCallback(async () => {
    await Promise.all([
      loadStatus(),
      loadChanges(),
      activeTab === 'prs' || activeTab === 'overview' ? loadPullRequests() : null,
      activeTab === 'checks' || activeTab === 'overview' ? loadChecks() : null,
      conflictResolverOpen || currentStatusHasConflicts(status) ? loadConflicts() : null,
    ]);
  }, [
    activeTab,
    conflictResolverOpen,
    loadChanges,
    loadChecks,
    loadConflicts,
    loadPullRequests,
    loadStatus,
    status,
  ]);

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

  const stashPaths = useCallback(
    async (paths: string[]) => {
      if (!projectId || paths.length === 0) return;
      setActionPending(`stash:${paths.join('\0')}`);
      try {
        const next = await apiPost<ProjectGitChangesResult>(
          apiPath('projects', projectId, 'git', 'stash'),
          { paths },
        );
        setChanges(next ?? null);
        setChangesProjectId(projectId);
        setSelectedChange((current) =>
          current && next
            ? (next.files.find((file) => file.path === current.path) ?? null)
            : current,
        );
        setDiff((current) =>
          current && next?.files.some((file) => file.path === current.path) ? current : null,
        );
        setSelectedDiffMode('unstaged');
        setChangesError(null);
        await loadStatus();
      } catch (cause) {
        setChangesError(cause instanceof ApiRequestError ? cause.message : 'Failed to stash file.');
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
      setPreferredTab('push');
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
      setCommitSuccess(null);
      setPullRequestSuccess(null);
      setLastRepositoryUrl(normalizeGitHubUrl(nextStatus?.remoteUrl));
      if (
        nextStatus?.githubRemoteDetected &&
        nextStatus.currentBranch &&
        !isLikelyPrimaryBranch(nextStatus.currentBranch)
      ) {
        setPreferredTab('prs');
        setActiveTab('prs');
      } else {
        setPreferredTab('push');
      }
      setError(null);
      await Promise.all([
        activeTab === 'changes' || activeTab === 'commit' ? loadChanges() : null,
        loadChecks(),
        loadPullRequests(),
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
      setPullRequestSuccess(null);
      setLastRepositoryUrl(normalizeGitHubUrl(nextStatus?.remoteUrl));
      if (
        nextStatus?.githubRemoteDetected &&
        nextStatus.currentBranch &&
        !isLikelyPrimaryBranch(nextStatus.currentBranch)
      ) {
        setPreferredTab('prs');
        setActiveTab('prs');
      } else {
        setPreferredTab('push');
      }
      setError(null);
      await Promise.all([loadChecks(), loadPullRequests()]);
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : 'Failed to publish branch.');
    } finally {
      setActionPending(null);
    }
  }, [activeTab, loadChecks, loadPullRequests, projectId]);

  const openRepositoryDialog = useCallback(
    (mode: RepositoryConnectionMode) => {
      setRepositoryDialogMode(mode);
      setRepositoryName((current) => current || defaultRepositoryName(status?.repositoryName));
      setRepositoryDescription(
        (current) =>
          current || (status?.repositoryName ? `Project for ${status.repositoryName}` : ''),
      );
      setRepositoryActionError(null);
      setRepositoryActionSuccess(null);
      setRepositoryDialogOpen(true);
    },
    [status?.repositoryName],
  );

  const createGitHubRepository = useCallback(async () => {
    if (!projectId) return;
    if (!repositoryOwner.trim() || !repositoryName.trim()) {
      setRepositoryActionError('Enter a GitHub owner and repository name.');
      return;
    }
    setActionPending('github-create-repository');
    try {
      const result = await apiPost<ProjectGitHubRepositoryConnectionResult>(
        apiPath('projects', projectId, 'git', 'github', 'create-repository'),
        {
          owner: repositoryOwner.trim(),
          name: repositoryName.trim(),
          description: repositoryDescription.trim() || undefined,
          visibility: repositoryVisibility,
          pushCurrentBranch: true,
        },
      );
      if (result?.status) {
        setStatus(result.status);
        setStatusProjectId(projectId);
      }
      setPushSuccess(
        result?.pushed
          ? `Created ${result.repositoryUrl} and pushed the current branch.`
          : `Created ${result?.repositoryUrl ?? 'GitHub repository'}.`,
      );
      setCommitSuccess(null);
      setPullRequestSuccess(null);
      setLastRepositoryUrl(result?.repositoryUrl ?? null);
      setRepositoryActionSuccess('Repository connected successfully.');
      setRepositoryActionError(null);
      setRepositoryDialogOpen(false);
      if (
        result?.pushed &&
        result.status?.currentBranch &&
        !isLikelyPrimaryBranch(result.status.currentBranch)
      ) {
        setPreferredTab('prs');
        setActiveTab('prs');
      } else {
        setPreferredTab('push');
        setActiveTab('push');
      }
      await Promise.all([loadChanges(), loadChecks(), loadPullRequests()]);
    } catch (cause) {
      setRepositoryActionError(
        cause instanceof ApiRequestError ? cause.message : 'Failed to create GitHub repository.',
      );
    } finally {
      setActionPending(null);
    }
  }, [
    loadChanges,
    loadChecks,
    loadPullRequests,
    projectId,
    repositoryDescription,
    repositoryName,
    repositoryOwner,
    repositoryVisibility,
  ]);

  const connectGitHubRepository = useCallback(async () => {
    if (!projectId) return;
    if (!connectRepository.trim()) {
      setRepositoryActionError('Enter an existing GitHub repository.');
      return;
    }
    setActionPending('github-connect-repository');
    try {
      const result = await apiPost<ProjectGitHubRepositoryConnectionResult>(
        apiPath('projects', projectId, 'git', 'github', 'connect-repository'),
        { repository: connectRepository.trim() },
      );
      if (result?.status) {
        setStatus(result.status);
        setStatusProjectId(projectId);
      }
      setPushSuccess(null);
      setPullRequestSuccess(null);
      setLastRepositoryUrl(result?.repositoryUrl ?? normalizeGitHubUrl(result?.status.remoteUrl));
      setCommitSuccess(
        result?.status.behind
          ? 'Repository connected. Pull remote changes before pushing.'
          : 'Repository connected.',
      );
      setRepositoryActionSuccess('Repository connected successfully.');
      setRepositoryActionError(null);
      setRepositoryDialogOpen(false);
      setPreferredTab('push');
      setActiveTab('push');
      await Promise.all([loadChanges(), loadChecks(), loadPullRequests()]);
    } catch (cause) {
      setRepositoryActionError(
        cause instanceof ApiRequestError ? cause.message : 'Failed to connect GitHub repository.',
      );
    } finally {
      setActionPending(null);
    }
  }, [connectRepository, loadChanges, loadChecks, loadPullRequests, projectId]);

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

  const openConflictResolver = useCallback(async () => {
    setConflictResolverOpen(true);
    await loadConflicts();
  }, [loadConflicts]);

  const openProjectInSystemIde = useCallback(async () => {
    if (!projectId) return;
    const result = await openDesktopProjectIde(projectId);
    if (!result) {
      setError(
        'Open local IDE is available in the desktop app when a Project folder is connected.',
      );
      return;
    }
    if (!result.handled) {
      setError(result.reason);
    }
  }, [projectId]);

  const pullRemoteChanges = useCallback(async () => {
    if (!projectId) return;
    setActionPending('pull');
    try {
      const result = await apiPost<ProjectGitPullResult>(
        apiPath('projects', projectId, 'git', 'pull'),
        {},
      );
      if (result?.status) {
        setStatus(result.status);
        setStatusProjectId(projectId);
      }
      setPushSuccess(null);
      setError(null);
      if (result?.outcome === 'conflicts') {
        setConflicts(result.conflicts ?? null);
        setConflictResolverOpen(true);
        setPreferredTab('push');
        setActiveTab('push');
      } else {
        setCommitSuccess('Pulled remote changes.');
        setPreferredTab('push');
        setActiveTab('push');
      }
      await Promise.all([loadChanges(), loadChecks(), loadPullRequests()]);
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : 'Failed to pull remote changes.');
    } finally {
      setActionPending(null);
    }
  }, [loadChanges, loadChecks, loadPullRequests, projectId]);

  const applyConflictChoice = useCallback(
    async (strategy: ConflictResolutionStrategy) => {
      if (!projectId || !selectedConflictPath) return;
      setActionPending(`resolve:${selectedConflictPath}:${strategy}`);
      try {
        await apiPost<ProjectGitConflictSummary>(
          apiPath('projects', projectId, 'git', 'conflicts', 'resolve'),
          { path: selectedConflictPath, strategy },
        );
        setConflictFile(null);
        setConflictError(null);
        await Promise.all([loadConflicts(), loadStatus(), loadChanges()]);
      } catch (cause) {
        setConflictError(
          cause instanceof ApiRequestError ? cause.message : 'Failed to resolve conflict.',
        );
      } finally {
        setActionPending(null);
      }
    },
    [loadChanges, loadConflicts, loadStatus, projectId, selectedConflictPath],
  );

  const commitMergeResolution = useCallback(
    async (push: boolean) => {
      if (!projectId) return;
      const message = mergeCommitMessage.trim();
      if (!message) {
        setConflictError('Enter a merge commit message before continuing.');
        return;
      }
      setActionPending(push ? 'merge-commit-push' : 'merge-commit');
      try {
        const nextStatus = await apiPost<ProjectGitStatusResult>(
          apiPath('projects', projectId, 'git', 'conflicts', 'commit'),
          { message, push },
        );
        setStatus(nextStatus ?? null);
        setStatusProjectId(projectId);
        setCommitSuccess(
          nextStatus?.recentCommit
            ? `Committed ${shortSha(nextStatus.recentCommit.sha)}: ${nextStatus.recentCommit.subject}`
            : 'Merge resolution committed.',
        );
        setPushSuccess(push ? 'Merge resolution pushed.' : null);
        setConflictResolverOpen(false);
        setConflicts(null);
        setConflictFile(null);
        setSelectedConflictPath(null);
        setPreferredTab('push');
        setActiveTab('push');
        setConflictError(null);
        await Promise.all([loadChanges(), loadChecks(), loadPullRequests()]);
      } catch (cause) {
        setConflictError(
          cause instanceof ApiRequestError ? cause.message : 'Failed to commit merge resolution.',
        );
      } finally {
        setActionPending(null);
      }
    },
    [loadChanges, loadChecks, loadPullRequests, mergeCommitMessage, projectId],
  );

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
  const currentBranches = branchesProjectId === projectId ? branches : null;
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
  const currentGitHubUrl = lastRepositoryUrl ?? githubUrl;
  const pullRequestCreateState = deriveGitPullRequestCreateState({
    status: currentStatus,
    pullRequests: currentPullRequests,
  });
  const pullRequestBaseBranchOptions = derivePullRequestBaseBranchOptions({
    status: currentStatus,
    branches: currentBranches,
  });
  const recommendedPullRequestBaseBranch = recommendPullRequestBaseBranch({
    fallbackBaseBranch: pullRequestCreateState.baseBranch,
    options: pullRequestBaseBranchOptions,
  });
  const effectivePullRequestBaseBranch = resolvePullRequestBaseBranchValue({
    selectedBaseBranch: pullRequestBaseBranch,
    fallbackBaseBranch: recommendedPullRequestBaseBranch,
  });
  const pullRequestTargetBranch =
    effectivePullRequestBaseBranch || pullRequestCreateState.baseBranch;
  const pullRequestBaseBranchHelperText = branchesLoading
    ? 'Loading branch options...'
    : (branchesError ??
      `This will open a pull request from ${
        currentStatus.currentBranch ?? 'this branch'
      } into ${pullRequestTargetBranch}.`);
  const currentBranchPullRequest = pullRequestCreateState.currentPullRequest;
  const sortedPullRequests = currentPullRequests?.pullRequests
    ? [
        ...currentPullRequests.pullRequests.filter((pullRequest) => pullRequest.currentBranch),
        ...currentPullRequests.pullRequests.filter((pullRequest) => !pullRequest.currentBranch),
      ]
    : [];
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
        pushSuccess,
      }),
    [currentChecks, currentPullRequests, currentStatus, pushSuccess],
  );
  const conflictFiles = conflicts?.files ?? [];
  const unresolvedConflictFiles = conflictFiles.filter((file) => !file.resolved);
  const conflictResolved = currentStatus.available && currentStatus.workingTree.conflicts === 0;
  const conflictFileCount = conflicts?.totalFiles ?? currentStatus.workingTree.conflicts;
  const changedFileCount = currentStatus.workingTree.total;
  const conflictCountText = conflictResolved
    ? 'Review the resolved files and commit the merge resolution.'
    : `${conflictFileCount} ${pluralize(
        conflictFileCount,
        'file',
      )} need resolution before pushing.`;
  const unresolvedConflictText = `${unresolvedConflictFiles.length} unresolved ${pluralize(
    unresolvedConflictFiles.length,
    'file',
  )}`;
  const gitStateSummary = getGitStateSummary(statusLoading, currentStatus);
  const changeCountLabel = currentStatus.clean
    ? 'Clean'
    : `${changedFileCount} ${pluralize(changedFileCount, 'change')}`;
  const changedFilesLabel = currentStatus.clean
    ? 'Working tree clean'
    : `${changedFileCount} changed ${pluralize(changedFileCount, 'file')}`;
  const publishActionLabel = getPublishActionLabel(actionPending, publishState);

  const createPullRequest = useCallback(async () => {
    if (!projectId) return;
    const title = (pullRequestTitle || pullRequestCreateState.defaultTitle).trim();
    if (!title) {
      setPullRequestsError('Enter a pull request title.');
      return;
    }
    if (!effectivePullRequestBaseBranch) {
      setPullRequestsError('Enter a base branch.');
      return;
    }
    setActionPending('create-pull-request');
    try {
      const result = await apiPost<ProjectGitCreatePullRequestResult>(
        apiPath('projects', projectId, 'github', 'pull-requests'),
        {
          title,
          body: pullRequestBody.trim() || undefined,
          baseBranch: effectivePullRequestBaseBranch,
          draft: false,
        },
      );
      if (result?.pullRequests) {
        setPullRequests(result.pullRequests);
        setPullRequestsProjectId(projectId);
      }
      if (result?.checks) {
        setChecks(result.checks);
        setChecksProjectId(projectId);
      }
      setPullRequestSuccess(
        result?.pullRequest
          ? `Created PR #${result.pullRequest.number}: ${result.pullRequest.title}`
          : 'Pull request created.',
      );
      setPullRequestsError(null);
      setPullRequestBody('');
      setPreferredTab('prs');
      setActiveTab('prs');
      await Promise.all([loadStatus(), loadChecks()]);
    } catch (cause) {
      setPullRequestsError(
        cause instanceof ApiRequestError ? cause.message : 'Failed to create pull request.',
      );
    } finally {
      setActionPending(null);
    }
  }, [
    effectivePullRequestBaseBranch,
    loadChecks,
    loadStatus,
    projectId,
    pullRequestBody,
    pullRequestCreateState.defaultTitle,
    pullRequestTitle,
  ]);

  usePullRequestDraftDefaults({
    activeTab,
    pullRequestBaseBranch,
    pullRequestCreateState,
    pullRequestTitle,
    recommendedPullRequestBaseBranch,
    setPullRequestBaseBranch,
    setPullRequestTitle,
  });

  useResolvedGitWorkflowTab({
    activeTab,
    preferredTab,
    setActiveTab,
    setPreferredTab,
    tabs,
  });

  if (!projectId) return null;

  return (
    <>
      <RepositoryConnectionDialog
        open={repositoryDialogOpen}
        mode={repositoryDialogMode}
        actionPending={actionPending}
        owner={repositoryOwner}
        name={repositoryName}
        description={repositoryDescription}
        visibility={repositoryVisibility}
        connectRepository={connectRepository}
        error={repositoryActionError}
        setMode={setRepositoryDialogMode}
        setOpen={setRepositoryDialogOpen}
        setOwner={setRepositoryOwner}
        setName={setRepositoryName}
        setDescription={setRepositoryDescription}
        setVisibility={setRepositoryVisibility}
        setConnectRepository={setConnectRepository}
        setError={setRepositoryActionError}
        createRepository={createGitHubRepository}
        connectExistingRepository={connectGitHubRepository}
      />

      <ConflictResolverDialog
        open={conflictResolverOpen}
        projectId={projectId}
        status={currentStatus}
        conflictResolved={conflictResolved}
        conflictCountText={conflictCountText}
        conflictsLoading={conflictsLoading}
        conflictFiles={conflictFiles}
        unresolvedConflictText={unresolvedConflictText}
        selectedConflictPath={selectedConflictPath}
        conflictError={conflictError}
        conflictFileLoading={conflictFileLoading}
        conflictFile={conflictFile}
        mergeCommitMessage={mergeCommitMessage}
        actionPending={actionPending}
        loadConflicts={loadConflicts}
        openProjectInSystemIde={openProjectInSystemIde}
        setOpen={setConflictResolverOpen}
        setSelectedConflictPath={setSelectedConflictPath}
        setConflictFile={setConflictFile}
        setMergeCommitMessage={setMergeCommitMessage}
        applyConflictChoice={applyConflictChoice}
        commitMergeResolution={commitMergeResolution}
      />

      <aside
        className={cn(
          'hidden h-full max-h-full min-h-0 shrink-0 overflow-hidden border-l border-border bg-background/95 lg:flex',
          open ? 'w-[360px] max-w-[30vw]' : 'w-12',
        )}
        aria-label="Git and GitHub"
      >
        {open && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
              <GitBranch className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Git & GitHub</span>
                  <LiveStatusBadge />
                </div>
                <div className="truncate text-xs text-muted-foreground">{gitStateSummary}</div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => runAsyncAction(refreshGitViews)}
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
                  {id !== 'push' && badge !== undefined && badge > 0 && (
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
              {changesError && activeTab === 'commit' && (
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

              {statusLoading && (
                <>
                  <ProjectInstructionsCard
                    status={projectInstructionsStatus}
                    isStarting={isStartingProjectInstructions}
                    onStart={onStartProjectInstructions}
                  />
                  <GitStatusLoadingCard />
                </>
              )}
              {!statusLoading && !currentStatus.available && (
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
              )}
              {!statusLoading && currentStatus.available && activeTab === 'overview' && (
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
                          {githubUrl && (
                            <a
                              href={githubUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Open remote repository"
                              className="inline-flex min-w-0 items-center gap-1 hover:text-foreground hover:underline"
                              onClick={(event) => openWorkspaceWebLink(event, githubUrl, projectId)}
                            >
                              <span className="truncate">{currentStatus.remoteUrl}</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {!githubUrl && (
                            <span className="truncate">{currentStatus.remoteUrl}</span>
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
                      <div className="mb-2 font-medium">{changeCountLabel}</div>
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
              )}
              {!statusLoading && currentStatus.available && activeTab === 'changes' && (
                <>
                  <GitCard title="Changes">
                    <div className="flex min-h-0 flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">{changedFilesLabel}</div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            changesLoading ||
                            actionPending !== null ||
                            currentStatus.workingTree.total === 0
                          }
                          onClick={() => runAsyncAction(() => stagePaths('all'))}
                        >
                          {actionPending === 'stage-all' ? 'Staging...' : 'Stage all'}
                        </Button>
                      </div>

                      {changesLoading && (
                        <div className="text-xs text-muted-foreground">
                          Loading changed files...
                        </div>
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
                                  selectedChange?.path === file.path &&
                                  selectedDiffMode === 'staged'
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

                      {stagedFiles.length > 0 && (
                        <div className="rounded border border-primary/20 bg-primary/5 px-3 py-3">
                          <div className="mb-2 text-xs text-muted-foreground">
                            {stagedFiles.length} staged file{stagedFiles.length === 1 ? '' : 's'}{' '}
                            ready to commit.
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            disabled={!canContinueToCommit(stagedFiles.length, actionPending)}
                            onClick={() => setActiveTab('commit')}
                          >
                            Continue to commit
                          </Button>
                        </div>
                      )}
                    </div>
                  </GitCard>

                  <GitCard title="Diff">
                    {selectedChange && (
                      <div className="space-y-3">
                        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div
                                className="truncate font-mono text-xs font-medium"
                                title={selectedChange.path}
                              >
                                {selectedChange.path}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                  {selectedDiffMode}
                                </Badge>
                                {(selectedChange.additions !== undefined ||
                                  selectedChange.deletions !== undefined) && (
                                  <span className="flex gap-1 text-[10px] text-muted-foreground">
                                    <span className="font-medium text-emerald-700">
                                      +{selectedChange.additions ?? 0}
                                    </span>
                                    <span className="font-medium text-red-700">
                                      -{selectedChange.deletions ?? 0}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedChange.unstaged && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                runAsyncAction(() => stagePaths([selectedChange.path]))
                              }
                              disabled={actionPending !== null}
                            >
                              {actionPending === `stage:${selectedChange.path}`
                                ? 'Staging...'
                                : 'Stage file'}
                            </Button>
                          )}
                          {selectedChange.unstaged && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                runAsyncAction(() => stashPaths([selectedChange.path]))
                              }
                              disabled={actionPending !== null}
                            >
                              {actionPending === `stash:${selectedChange.path}`
                                ? 'Stashing...'
                                : 'Stash file'}
                            </Button>
                          )}
                          {selectedChange.staged && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                runAsyncAction(() => unstagePaths([selectedChange.path]))
                              }
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
                    )}
                    {!selectedChange && (
                      <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                        Select a changed file to review its diff.
                      </div>
                    )}
                  </GitCard>
                </>
              )}
              {!statusLoading && currentStatus.available && activeTab === 'commit' && (
                <GitCard title="Commit">
                  <div className="space-y-3">
                    {changesLoading && (
                      <div className="text-xs text-muted-foreground">Loading staged files...</div>
                    )}
                    {stagedFiles.length === 0 && (
                      <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                        No staged files are ready to commit. Go back to Changes to choose files.
                      </div>
                    )}
                    {stagedFiles.length > 0 && (
                      <>
                        <div>
                          <div className="font-medium">Commit staged changes</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {stagedFiles.length} staged file{stagedFiles.length === 1 ? '' : 's'}{' '}
                            ready.
                          </div>
                        </div>
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
                      </>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={commitMessage}
                        onChange={(event) => setCommitMessage(event.target.value)}
                        placeholder="Commit message"
                        disabled={stagedFiles.length === 0 || actionPending !== null}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            runAsyncAction(commitStagedChanges);
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
                        onClick={() => runAsyncAction(commitStagedChanges)}
                      >
                        {actionPending === 'commit' ? 'Committing...' : 'Commit'}
                      </Button>
                    </div>
                    {stagedFiles.length > 0 && (
                      <div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveTab('changes')}
                          disabled={actionPending !== null}
                        >
                          Back to changes
                        </Button>
                      </div>
                    )}
                  </div>
                </GitCard>
              )}
              {!statusLoading && currentStatus.available && activeTab === 'push' && (
                <GitCard title="Publish">
                  {currentStatus.recentCommit && (
                    <div className="space-y-3">
                      {commitSuccess && (
                        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                          {commitSuccess}
                        </div>
                      )}
                      {pushSuccess && (
                        <div className="space-y-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                          <div>{pushSuccess}</div>
                          {currentGitHubUrl && (
                            <a
                              href={currentGitHubUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-emerald-900 hover:underline"
                              onClick={(event) =>
                                openWorkspaceWebLink(event, currentGitHubUrl, projectId)
                              }
                            >
                              Open GitHub
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                      <div className="font-mono text-xs">
                        {shortSha(currentStatus.recentCommit.sha)}
                      </div>
                      <div className="font-medium">{currentStatus.recentCommit.subject}</div>
                      {!currentStatus.remoteUrl && (
                        <div className="rounded border border-border bg-background px-3 py-4">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <GitBranch className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="mt-3 text-center">
                            <div className="font-medium">No repository connected</div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Create a new GitHub repository or connect an existing one to publish
                              this project.
                            </p>
                          </div>
                          {repositoryActionSuccess && (
                            <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                              {repositoryActionSuccess}
                            </div>
                          )}
                          <div className="mt-4 space-y-2">
                            <Button
                              type="button"
                              className="w-full"
                              disabled={actionPending !== null}
                              onClick={() => openRepositoryDialog('create')}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Create Repository
                            </Button>
                            <Button
                              type="button"
                              className="w-full"
                              variant="outline"
                              disabled={actionPending !== null}
                              onClick={() => openRepositoryDialog('connect')}
                            >
                              <Link className="mr-2 h-4 w-4" />
                              Connect Existing Repository
                            </Button>
                          </div>
                          <div className="mt-4 rounded border border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                            You can also add an origin remote from the terminal. After that, refresh
                            this panel to continue the publish workflow here.
                          </div>
                        </div>
                      )}
                      {currentStatus.remoteUrl && (
                        <>
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
                            {publishActionLabel && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  actionPending !== null ||
                                  (!publishState.canPublish &&
                                    !publishState.canPull &&
                                    currentStatus.workingTree.conflicts === 0)
                                }
                                onClick={() => {
                                  if (currentStatus.workingTree.conflicts > 0) {
                                    runAsyncAction(openConflictResolver);
                                    return;
                                  }
                                  if (publishState.canPull) {
                                    runAsyncAction(pullRemoteChanges);
                                    return;
                                  }
                                  if (currentStatus.upstreamState === 'active') {
                                    runAsyncAction(pushCurrentBranch);
                                    return;
                                  }
                                  runAsyncAction(publishCurrentBranch);
                                }}
                              >
                                {publishActionLabel}
                              </Button>
                            )}
                            {publishState.canClearStaleUpstream && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={actionPending !== null}
                                onClick={() => runAsyncAction(clearStaleUpstream)}
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
                        </>
                      )}
                      {!publishState.pushed && (
                        <div className="rounded border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                          Not ready to publish? You can undo the last local commit from the terminal
                          with <span className="font-mono">git reset --soft HEAD~1</span> to keep
                          files staged, or <span className="font-mono">git reset HEAD~1</span> to
                          keep them unstaged.
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        After this branch is published, pull request options appear when they are
                        available.
                        {currentGitHubUrl && (
                          <>
                            {' '}
                            <a
                              href={currentGitHubUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              onClick={(event) =>
                                openWorkspaceWebLink(event, currentGitHubUrl, projectId)
                              }
                            >
                              Open GitHub
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {!currentStatus.recentCommit && (
                    <div className="text-sm text-muted-foreground">No commits found.</div>
                  )}
                </GitCard>
              )}
              {!statusLoading && currentStatus.available && activeTab === 'prs' && (
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
                              {currentGitHubUrl && (
                                <a
                                  href={currentGitHubUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={(event) =>
                                    openWorkspaceWebLink(event, currentGitHubUrl, projectId)
                                  }
                                >
                                  Open GitHub
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
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

                          {pullRequestSuccess && (
                            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                              {pullRequestSuccess}
                            </div>
                          )}

                          {pullRequestCreateState.canCreate && !currentBranchPullRequest && (
                            <div className="space-y-3 rounded border border-border bg-background px-3 py-3">
                              <div>
                                <div className="font-medium">Create a pull request</div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Choose the target branch before creating a pull request for{' '}
                                  {currentStatus.currentBranch}.
                                </p>
                              </div>
                              <div className="space-y-2">
                                <label
                                  htmlFor="project-pull-request-title"
                                  className="block text-xs font-medium text-muted-foreground"
                                >
                                  Title
                                </label>
                                <Input
                                  id="project-pull-request-title"
                                  value={pullRequestTitle}
                                  onChange={(event) => setPullRequestTitle(event.target.value)}
                                  placeholder={pullRequestCreateState.defaultTitle}
                                  disabled={actionPending !== null}
                                />
                              </div>
                              <div className="space-y-2">
                                <label
                                  htmlFor="project-pull-request-target-branch"
                                  className="block text-xs font-medium text-muted-foreground"
                                >
                                  Target branch
                                </label>
                                <Select
                                  value={pullRequestBaseBranch}
                                  onValueChange={setPullRequestBaseBranch}
                                  disabled={actionPending !== null}
                                >
                                  <SelectTrigger
                                    id="project-pull-request-target-branch"
                                    aria-label="Pull request target branch"
                                    className="h-9"
                                  >
                                    <SelectValue placeholder="Select target branch" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {pullRequestBaseBranchOptions.map((branch) => (
                                      <SelectItem key={branch} value={branch}>
                                        {branch}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex min-w-0 items-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-2 py-2 text-xs">
                                  <span className="min-w-0 truncate font-mono">
                                    {currentStatus.currentBranch ?? 'this branch'}
                                  </span>
                                  <span className="text-muted-foreground">-&gt;</span>
                                  <span className="min-w-0 truncate font-mono font-semibold">
                                    {pullRequestTargetBranch}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {pullRequestBaseBranchOptions.map((branch) => (
                                    <Button
                                      key={branch}
                                      type="button"
                                      size="sm"
                                      variant={
                                        effectivePullRequestBaseBranch === branch
                                          ? 'default'
                                          : 'outline'
                                      }
                                      className="h-7 px-2 text-xs"
                                      disabled={actionPending !== null}
                                      onClick={() => setPullRequestBaseBranch(branch)}
                                    >
                                      {branch}
                                    </Button>
                                  ))}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  {pullRequestBaseBranchHelperText}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <label
                                  htmlFor="project-pull-request-description"
                                  className="block text-xs font-medium text-muted-foreground"
                                >
                                  Description
                                </label>
                                <textarea
                                  id="project-pull-request-description"
                                  value={pullRequestBody}
                                  onChange={(event) => setPullRequestBody(event.target.value)}
                                  disabled={actionPending !== null}
                                  rows={3}
                                  placeholder="Optional summary for reviewers"
                                  className="min-h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={actionPending !== null}
                                  onClick={() => runAsyncAction(createPullRequest)}
                                >
                                  {actionPending === 'create-pull-request'
                                    ? 'Creating...'
                                    : 'Create pull request'}
                                </Button>
                                {currentGitHubUrl && (
                                  <Button type="button" size="sm" variant="outline" asChild>
                                    <a
                                      href={currentGitHubUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) =>
                                        openWorkspaceWebLink(event, currentGitHubUrl, projectId)
                                      }
                                    >
                                      Open GitHub
                                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {!pullRequestCreateState.canCreate &&
                            !currentBranchPullRequest &&
                            sortedPullRequests.length === 0 && (
                              <div className="space-y-2 rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                                <div>
                                  {pullRequestCreateState.reason ??
                                    'No open GitHub pull requests were found for this repository.'}
                                </div>
                                {currentGitHubUrl && (
                                  <a
                                    href={currentGitHubUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                    onClick={(event) =>
                                      openWorkspaceWebLink(event, currentGitHubUrl, projectId)
                                    }
                                  >
                                    Open GitHub
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            )}

                          {sortedPullRequests.length > 0 && (
                            <div className="space-y-2">
                              {sortedPullRequests.map((pullRequest) => (
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
                                              onClick={(event) =>
                                                openWorkspaceWebLink(
                                                  event,
                                                  pullRequest.url,
                                                  projectId,
                                                )
                                              }
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
                                          onClick={(event) =>
                                            openWorkspaceWebLink(event, pullRequest.url, projectId)
                                          }
                                        >
                                          Open on GitHub
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                        {pullRequest.currentBranch &&
                                          (pullRequest.checks.failure > 0 ||
                                            pullRequest.checks.pending > 0) && (
                                            <button
                                              type="button"
                                              className="text-primary hover:underline"
                                              onClick={() => setActiveTab('checks')}
                                            >
                                              View checks
                                            </button>
                                          )}
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
                      <div>Create and monitor pull requests from this Project.</div>
                    </div>
                  </GitCard>
                </>
              )}
              {!statusLoading && currentStatus.available && activeTab === 'checks' && (
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

                          {currentChecks.checks.length === 0 && (
                            <div className="rounded border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
                              No GitHub checks were found for {checksScopeLabel(currentChecks)}.
                            </div>
                          )}
                          {currentChecks.checks.length > 0 && (
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
                                        {check.url ? (
                                          <a
                                            href={check.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={`Open ${check.name} on GitHub`}
                                            onClick={(event) =>
                                              openWorkspaceWebLink(
                                                event,
                                                check.url ?? '',
                                                projectId,
                                              )
                                            }
                                          >
                                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                          </a>
                                        ) : null}
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
        {!open && <ClosedGitHubPanelButton onOpen={() => setOpen(true)} />}
      </aside>
    </>
  );
}
