import type {
  ProjectGitChangesResult,
  ProjectGitChecksResult,
  ProjectGitPullRequestsResult,
  ProjectProfile,
  WorkspaceResource,
} from '@agent-platform/contracts';
import { workspaceResourceUri } from '@agent-platform/contracts';

export type ProjectActivityTone = 'neutral' | 'success' | 'warning' | 'danger' | 'running';
export type ProjectActivityState = 'ready' | 'empty' | 'unavailable' | 'disconnected';

export type ProjectActivityEntry = Readonly<{
  id: string;
  kind:
    | 'changed_file'
    | 'generated_file'
    | 'preview'
    | 'check'
    | 'review'
    | 'finding'
    | 'approval'
    | 'next_action';
  title: string;
  detail?: string;
  tone: ProjectActivityTone;
  resource?: WorkspaceResource;
  url?: string;
}>;

export type ProjectActivitySection = Readonly<{
  id: 'changes' | 'generated' | 'checks' | 'reviews' | 'findings' | 'next_actions';
  title: string;
  entries: readonly ProjectActivityEntry[];
  unavailableMessage?: string;
}>;

export type ProjectActivitySnapshot = Readonly<{
  state: ProjectActivityState;
  summary: string;
  profileMessage?: string;
  sections: readonly ProjectActivitySection[];
}>;

export type ProjectActivityApproval = Readonly<{
  id: string;
  title: string;
  detail?: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed' | 'executed';
}>;

export type ProjectActivityFinding = Readonly<{
  id: string;
  title: string;
  detail?: string;
  status: 'success' | 'error' | 'denied';
  category?: 'check' | 'finding';
}>;

export type ProjectActivitySource = Readonly<{
  projectId: string | null;
  profile: ProjectProfile;
  changes?: ProjectGitChangesResult | null;
  checks?: ProjectGitChecksResult | null;
  pullRequests?: ProjectGitPullRequestsResult | null;
  resources?: readonly WorkspaceResource[];
  approvals?: readonly ProjectActivityApproval[];
  findings?: readonly ProjectActivityFinding[];
  gitError?: string | null;
  checksError?: string | null;
  reviewsError?: string | null;
}>;

const RESOURCE_DATE = '1970-01-01T00:00:00.000Z';

function safeCopy(value: string | undefined, fallback: string): string {
  if (!value?.trim()) return fallback;
  const normalized = value
    .trim()
    .replaceAll('\\', '/')
    .replace(/\/workspace\/([^\s,;]+)/gu, '$1')
    .replace(/\/(?:Users|home)\/[^\s,;]+/gu, (path) => path.split('/').at(-1) ?? fallback)
    .replace(/^\/workspace\/?/u, '');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//u.test(normalized)) {
    return normalized.split('/').findLast(Boolean) ?? fallback;
  }
  return normalized.replace(/\b[0-9a-f]{40}\b/giu, 'a recent commit');
}

function fileTone(status: string): ProjectActivityTone {
  if (status === 'conflict' || status === 'deleted') return 'warning';
  return 'neutral';
}

function resultTone(status: string): ProjectActivityTone {
  if (status === 'success') return 'success';
  if (status === 'error') return 'danger';
  return 'warning';
}

function checkTone(
  running: boolean,
  failed: boolean,
  conclusion: string | null | undefined,
): ProjectActivityTone {
  if (running) return 'running';
  if (failed) return 'danger';
  if (conclusion === 'success') return 'success';
  return 'neutral';
}

function reviewTone(decision: string): ProjectActivityTone {
  if (decision === 'approved') return 'success';
  if (decision === 'changes_requested') return 'danger';
  return 'warning';
}

function approvalTone(status: string): ProjectActivityTone {
  if (status === 'approved' || status === 'executed') return 'success';
  if (status === 'rejected' || status === 'failed') return 'danger';
  return 'warning';
}

function changedFileEntries(source: ProjectActivitySource): ProjectActivityEntry[] {
  const projectId = source.projectId;
  if (!projectId || !source.changes?.available) return [];
  return source.changes.files.map((file) => {
    const label = safeCopy(file.path, 'Changed file');
    const mode = file.staged && !file.unstaged ? 'staged' : 'unstaged';
    const resource: WorkspaceResource = {
      uri: workspaceResourceUri({ projectId, kind: 'diff', target: file.path }),
      kind: 'diff',
      projectId,
      label,
      metadata: { path: file.path, diffMode: mode },
      createdAt: RESOURCE_DATE,
    };
    return {
      id: `change:${file.path}:${mode}`,
      kind: 'changed_file',
      title: label,
      detail: `${file.status}${file.staged ? ' · staged' : ''}${file.unstaged ? ' · unstaged' : ''}`,
      tone: fileTone(file.status),
      resource,
    };
  });
}

function generatedEntries(source: ProjectActivitySource): ProjectActivityEntry[] {
  const seen = new Set<string>();
  const entries: ProjectActivityEntry[] = [];
  for (const resource of source.resources ?? []) {
    if (resource.projectId !== source.projectId || seen.has(resource.uri)) continue;
    seen.add(resource.uri);
    const normalizedResource = { ...resource, label: safeCopy(resource.label, 'Generated output') };
    entries.push({
      id: `resource:${resource.uri}`,
      kind:
        resource.kind === 'preview' || resource.kind === 'webview' ? 'preview' : 'generated_file',
      title: normalizedResource.label,
      detail:
        resource.kind === 'preview' || resource.kind === 'webview'
          ? 'Preview available'
          : 'Generated output',
      tone: 'success',
      resource: normalizedResource,
    });
  }
  return entries;
}

function checkEntries(source: ProjectActivitySource): ProjectActivityEntry[] {
  const localChecks = (source.findings ?? [])
    .filter((finding) => finding.category === 'check')
    .map<ProjectActivityEntry>((finding) => ({
      id: `local-check:${finding.id}`,
      kind: 'check' as const,
      title: safeCopy(finding.title, 'Local check'),
      detail: finding.detail ? safeCopy(finding.detail, 'Completed') : 'Completed',
      tone: resultTone(finding.status),
    }));
  if (!source.checks?.available) return localChecks;
  return [
    ...localChecks,
    ...source.checks.checks.map<ProjectActivityEntry>((check) => {
      const running = check.status !== 'completed';
      const failed = check.conclusion === 'failure' || check.conclusion === 'timed_out';
      return {
        id: `check:${check.id}`,
        kind: 'check',
        title: safeCopy(check.name, 'Project check'),
        detail: running ? 'Running' : safeCopy(check.conclusion, 'Completed').replaceAll('_', ' '),
        tone: checkTone(running, failed, check.conclusion),
        ...(check.url ? { url: check.url } : {}),
      };
    }),
  ];
}

function reviewEntries(source: ProjectActivitySource): ProjectActivityEntry[] {
  const pullRequest = source.pullRequests?.pullRequests.find(
    (candidate) => candidate.currentBranch,
  );
  const entries: ProjectActivityEntry[] = [];
  if (pullRequest) {
    const decision = pullRequest.reviewDecision ?? 'review_required';
    entries.push({
      id: `review:${pullRequest.number}`,
      kind: 'review',
      title: `Pull request #${pullRequest.number}`,
      detail: decision.replaceAll('_', ' '),
      tone: reviewTone(decision),
      url: pullRequest.url,
    });
  }
  for (const approval of source.approvals ?? []) {
    entries.push({
      id: `approval:${approval.id}`,
      kind: 'approval',
      title: safeCopy(approval.title, 'Approval'),
      detail: safeCopy(approval.detail, approval.status).replaceAll('_', ' '),
      tone: approvalTone(approval.status),
    });
  }
  return entries;
}

function findingEntries(source: ProjectActivitySource): ProjectActivityEntry[] {
  return (source.findings ?? [])
    .filter((finding) => finding.category !== 'check')
    .map((finding) => ({
      id: `finding:${finding.id}`,
      kind: 'finding',
      title: safeCopy(finding.title, 'Tool finding'),
      detail: finding.detail ? safeCopy(finding.detail, 'Details unavailable') : undefined,
      tone: resultTone(finding.status),
    }));
}

function nextActionEntries(source: ProjectActivitySource): ProjectActivityEntry[] {
  const entries: ProjectActivityEntry[] = [];
  const pendingApproval = source.approvals?.find((approval) => approval.status === 'pending');
  if (pendingApproval) {
    entries.push({
      id: 'next:approval',
      kind: 'next_action',
      title: 'Review the pending approval',
      detail: 'Return to the conversation to approve or reject the requested action.',
      tone: 'warning',
    });
  }
  if (source.changes?.available && !source.changes.clean) {
    entries.push({
      id: 'next:changes',
      kind: 'next_action',
      title: 'Review project changes',
      detail: `${source.changes.files.length} changed file${source.changes.files.length === 1 ? '' : 's'} need attention.`,
      tone: source.changes.workingTree.conflicts > 0 ? 'danger' : 'neutral',
    });
  }
  if (source.checks?.summary.failure) {
    entries.push({
      id: 'next:checks',
      kind: 'next_action',
      title: 'Investigate failing checks',
      detail: `${source.checks.summary.failure} check${source.checks.summary.failure === 1 ? '' : 's'} failed.`,
      tone: 'danger',
    });
  }
  const currentPullRequest = source.pullRequests?.pullRequests.find(
    (candidate) => candidate.currentBranch,
  );
  if (currentPullRequest?.reviewDecision === 'changes_requested') {
    entries.push({
      id: 'next:review',
      kind: 'next_action',
      title: 'Address requested changes',
      detail: `Pull request #${currentPullRequest.number} needs updates before approval.`,
      tone: 'danger',
      url: currentPullRequest.url,
    });
  }
  if (entries.length === 0 && source.projectId) {
    entries.push({
      id: 'next:clear',
      kind: 'next_action',
      title: 'No action needed',
      detail: 'Available project evidence has no outstanding actions.',
      tone: 'success',
    });
  }
  return entries;
}

function profileMessage(profile: ProjectProfile): string | undefined {
  if (profile === 'coding') return undefined;
  if (profile === 'docs_content')
    return 'Docs and content evidence appears as outputs become available.';
  if (profile === 'research')
    return 'Research evidence appears as sources and outputs become available.';
  if (profile === 'automation')
    return 'Automation evidence appears as runs and outputs become available.';
  if (profile === 'mixed') return 'Evidence is grouped across this mixed Project.';
  return 'Activity will appear as this Project produces normalized evidence.';
}

function changesUnavailableMessage(source: ProjectActivitySource): string | undefined {
  if (source.gitError) return 'Local changes are unavailable.';
  if (source.changes?.available === false) return 'This Project does not have local Git changes.';
  return undefined;
}

function snapshotState(
  allProvidersUnavailable: boolean,
  evidenceCount: number,
): ProjectActivitySnapshot['state'] {
  if (allProvidersUnavailable) return 'unavailable';
  if (evidenceCount === 0) return 'empty';
  return 'ready';
}

function evidenceSummary(evidenceCount: number): string {
  if (evidenceCount === 0) return 'No activity has been recorded for this Project yet.';
  const itemLabel = evidenceCount === 1 ? 'item' : 'items';
  return `${evidenceCount} evidence ${itemLabel} in this Project session.`;
}

export function normalizeProjectActivity(source: ProjectActivitySource): ProjectActivitySnapshot {
  if (!source.projectId) {
    return { state: 'disconnected', summary: 'Open a Project to see its activity.', sections: [] };
  }

  const changes = changedFileEntries(source);
  const generated = generatedEntries(source);
  const checks = checkEntries(source);
  const reviews = reviewEntries(source);
  const findings = findingEntries(source);
  const nextActions = nextActionEntries(source);
  const sections: ProjectActivitySection[] = [
    {
      id: 'changes',
      title: 'Changed files',
      entries: changes,
      unavailableMessage: changesUnavailableMessage(source),
    },
    { id: 'generated', title: 'Generated outputs', entries: generated },
    {
      id: 'checks',
      title: 'Checks and CI',
      entries: checks,
      unavailableMessage:
        source.checksError || source.checks?.available === false
          ? 'Checks are unavailable for this branch.'
          : undefined,
    },
    {
      id: 'reviews',
      title: 'Reviews and approvals',
      entries: reviews,
      unavailableMessage: source.reviewsError ? 'Review status is unavailable.' : undefined,
    },
    { id: 'findings', title: 'Findings', entries: findings },
    { id: 'next_actions', title: 'Next actions', entries: nextActions },
  ];
  const evidenceCount =
    changes.length + generated.length + checks.length + reviews.length + findings.length;
  const allProvidersUnavailable = Boolean(
    source.gitError && source.checksError && source.reviewsError && evidenceCount === 0,
  );
  return {
    state: snapshotState(allProvidersUnavailable, evidenceCount),
    summary: evidenceSummary(evidenceCount),
    profileMessage: profileMessage(source.profile),
    sections,
  };
}
