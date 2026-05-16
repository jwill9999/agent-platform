import {
  ProjectCreateBodySchema,
  ProjectDesktopRegistrationBodySchema,
  ProjectDesktopRecentProjectsResultSchema,
  ProjectDesktopRegistrationResultSchema,
  ProjectBranchCheckoutBodySchema,
  ProjectBranchListResultSchema,
  ProjectGitCommitBodySchema,
  ProjectGitChecksResultSchema,
  ProjectGitChangesResultSchema,
  ProjectGitFileDiffResultSchema,
  ProjectGitPullRequestsResultSchema,
  ProjectGitStageBodySchema,
  ProjectGitStatusResultSchema,
  ProjectFileReadResultSchema,
  ProjectFileTreeResultSchema,
  type ProjectOpenBody,
  ProjectOpenBodySchema,
  ProjectOnboardingAnswerBodySchema,
  ProjectOnboardingApprovalDecisionSchema,
  ProjectOnboardingAssessmentSchema,
  ProjectOnboardingRefreshResultSchema,
  ProjectOnboardingReviewBodySchema,
  ProjectOnboardingStateSchema,
  ProjectQuerySchema,
  ProjectInstructionUpdateCandidateBodySchema,
  ProjectInstructionUpdateCandidateSchema,
  ProjectInstructionUpdateDecisionBodySchema,
  ProjectInstructionUpdateProposalSchema,
  type ProjectInstructionUpdateCandidate,
  type ProjectInstructionFileReference,
  type ProjectFileNode,
  type ProjectRecord,
  type ProjectBranchListResult,
  type ProjectGitChangedFile,
  type ProjectGitCheckConclusion,
  type ProjectGitCheckRun,
  type ProjectGitCheckStatus,
  type ProjectGitChecksSummary,
  type ProjectGitCommitBody,
  type ProjectGitFileStatus,
  type ProjectGitPullRequestCheckSummary,
  type ProjectGitPullRequestReviewDecision,
  type ProjectGitPullRequestState,
  type ProjectGitPullRequestSummary,
  type ProjectGitStageBody,
  type ProjectGitWorkingTreeSummary,
  ProjectUpdateBodySchema,
} from '@agent-platform/contracts';
import {
  archiveProject,
  createProject,
  findProject,
  listProjects,
  ProjectNotFoundError,
  ProjectSlugConflictError,
  ProjectWorkspacePathError,
  updateProject,
  slugify,
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { PathJail } from '@agent-platform/harness';
import { Router } from 'express';
import type { Request } from 'express';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { readdir, readFile, stat } from 'node:fs/promises';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse,
  posix,
  relative,
  resolve,
  sep,
} from 'node:path';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import {
  discoverProjectInstructions,
  parseProjectInstructionFileReferences,
} from '../../projects/projectInstructions.js';
import { assessProjectOnboarding } from '../../projects/projectAssessment.js';
import {
  buildOnboardingDraft,
  createInitialOnboardingDialogue,
  parseStoredOnboardingDialogue,
  parseStoredOnboardingDraft,
  recordOnboardingAnswer,
} from '../../projects/projectOnboardingDraft.js';
import {
  requireProjectAssessment,
  startProjectOnboardingDraft,
} from '../../projects/projectOnboardingWorkflow.js';
import { parseBody, requireParam } from './routerUtils.js';

function mapProjectError(error: unknown): never {
  if (error instanceof ProjectNotFoundError) {
    throw new HttpError(404, 'NOT_FOUND', error.message);
  }
  if (error instanceof ProjectSlugConflictError) {
    throw new HttpError(409, 'PROJECT_SLUG_CONFLICT', error.message);
  }
  if (error instanceof ProjectWorkspacePathError) {
    throw new HttpError(400, 'VALIDATION_ERROR', error.message);
  }
  throw error;
}

type BackendProjectMetadata = {
  backendProjectRoot: string;
  repositoryRoot: string;
  activeBranch?: string;
  activeWorktreeId?: string;
  projectRoot: '/workspace';
  capabilityState: 'backend_accessible';
  onboardingState: 'missing' | 'in_progress' | 'needs_review' | 'approved';
  defaultAgentProfile: 'coding';
  instructionFiles: ProjectInstructionFileReference[];
  onboardingAssessment?: ReturnType<typeof assessProjectOnboarding>['assessment'];
  onboardingDraft?: ReturnType<typeof parseStoredOnboardingDraft>;
  onboardingDialogue?: ReturnType<typeof parseStoredOnboardingDialogue>;
  instructionUpdateCandidates?: ProjectInstructionUpdateCandidate[];
};

const GIT_BINARY = '/usr/bin/git';
const DESKTOP_PROJECT_REGISTRATION_HEADER = 'x-agent-platform-desktop-bridge';
const GIT_USER_PATHS = ['--', '.', ':(exclude).agent-platform', ':(exclude).agent-platform/**'];
const EMPTY_GIT_CHECKS_SUMMARY: ProjectGitChecksSummary = {
  total: 0,
  success: 0,
  failure: 0,
  inProgress: 0,
  queued: 0,
  cancelled: 0,
  skipped: 0,
  unknown: 0,
};
const EMPTY_PR_CHECK_SUMMARY: ProjectGitPullRequestCheckSummary = {
  total: 0,
  success: 0,
  failure: 0,
  pending: 0,
  unknown: 0,
};

function githubCliBinary(): string {
  return process.env['AGENT_PLATFORM_GH_BINARY'] ?? 'gh';
}

function gitValue(cwd: string, args: string[]): string | undefined {
  try {
    const output = execFileSync(GIT_BINARY, ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return output || undefined;
  } catch {
    return undefined;
  }
}

function ghValue(cwd: string, args: string[]): string | undefined {
  try {
    const output = execFileSync(githubCliBinary(), args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10000,
    }).trim();
    return output || undefined;
  } catch {
    return undefined;
  }
}

function ghSuccess(cwd: string, args: string[]): boolean {
  try {
    execFileSync(githubCliBinary(), args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}

function gitOutput(cwd: string, args: string[]): string {
  try {
    return execFileSync(GIT_BINARY, ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new HttpError(409, 'PROJECT_GIT_UNAVAILABLE', 'Git is not available for this Project.');
  }
}

function gitRawOutput(cwd: string, args: string[]): string {
  try {
    return execFileSync(GIT_BINARY, ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new HttpError(409, 'PROJECT_GIT_UNAVAILABLE', 'Git is not available for this Project.');
  }
}

function metadataOnboardingState(
  metadata: Record<string, unknown>,
): BackendProjectMetadata['onboardingState'] | undefined {
  const parsed = ProjectOnboardingStateSchema.safeParse(metadata['onboardingState']);
  return parsed.success ? parsed.data : undefined;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function isInsideProjectRoot(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function resolveProjectWriteTarget(projectRoot: string, targetPath: string): string {
  const rootRealPath = realpathSync(projectRoot);
  const targetFile = resolve(rootRealPath, targetPath);
  const parentRealPath = realpathSync(dirname(targetFile));
  if (!isInsideProjectRoot(rootRealPath, parentRealPath)) {
    throw new HttpError(403, 'PROJECT_PATH_FORBIDDEN', 'Project write target is outside the root');
  }

  if (existsSync(targetFile)) {
    const targetStats = lstatSync(targetFile);
    if (targetStats.isSymbolicLink()) {
      throw new HttpError(
        403,
        'PROJECT_PATH_FORBIDDEN',
        'Project write target cannot be a symbolic link',
      );
    }
    const targetRealPath = realpathSync(targetFile);
    if (!isInsideProjectRoot(rootRealPath, targetRealPath)) {
      throw new HttpError(
        403,
        'PROJECT_PATH_FORBIDDEN',
        'Project write target is outside the root',
      );
    }
  }

  return targetFile;
}

function readExistingRootInstructions(project: ProjectRecord): string | undefined {
  const backendProjectRoot = project.metadata['backendProjectRoot'];
  if (typeof backendProjectRoot !== 'string') return undefined;
  const targetFile = resolveProjectWriteTarget(backendProjectRoot, 'AGENTS.md');
  if (!existsSync(targetFile)) return undefined;
  return readFileSync(targetFile, 'utf8');
}

function buildOnboardingApproval(input: {
  projectId: string;
  targetPath: string;
  contentHash: string;
  reviewer: string;
  source: 'auto_assessment' | 'manual_review';
  decidedAtMs: number;
  comment?: string;
}) {
  const candidate = {
    decision: 'approve',
    projectId: input.projectId,
    targetPath: input.targetPath,
    contentHash: input.contentHash,
    reviewer: input.reviewer,
    source: input.source,
    decidedAtMs: input.decidedAtMs,
    ...(input.comment ? { comment: input.comment } : {}),
  };
  return ProjectOnboardingApprovalDecisionSchema.parse(candidate);
}

function rootInstructionReference(files: readonly ProjectInstructionFileReference[]) {
  return files.find((file) => file.scope === 'root' && file.path === 'AGENTS.md');
}

function withAutoApprovalMetadata(db: DrizzleDb, project: ProjectRecord): ProjectRecord {
  if (
    project.metadata['onboardingState'] !== 'approved' ||
    project.metadata['onboardingApproval']
  ) {
    return project;
  }
  const rootRef = rootInstructionReference(parseProjectInstructionFileReferences(project.metadata));
  if (!rootRef?.contentHash) return project;
  return updateProject(db, project.id, {
    metadata: {
      ...project.metadata,
      onboardingApproval: buildOnboardingApproval({
        projectId: project.id,
        targetPath: rootRef.path,
        contentHash: rootRef.contentHash,
        reviewer: 'Project assessment',
        source: 'auto_assessment',
        decidedAtMs: rootRef.approvedAtMs ?? Date.now(),
      }),
    },
  });
}

function parseInstructionUpdateCandidates(
  metadata: Record<string, unknown>,
): ProjectInstructionUpdateCandidate[] {
  const parsed = ProjectInstructionUpdateCandidateSchema.array().safeParse(
    metadata['instructionUpdateCandidates'],
  );
  return parsed.success ? parsed.data : [];
}

function instructionUpdateMarkdown(candidate: ProjectInstructionUpdateCandidate): string {
  const body = candidate.proposedMarkdown?.trim() || `- ${candidate.summary.trim()}`;
  return body.endsWith('\n') ? body : `${body}\n`;
}

function appendInstructionUpdate(
  fileContent: string,
  candidate: ProjectInstructionUpdateCandidate,
) {
  const update = instructionUpdateMarkdown(candidate);
  const trimmed = fileContent.trimEnd();
  if (!trimmed) return `${update}`;
  if (trimmed.includes(update.trim())) return `${trimmed}\n`;
  const heading = '## Durable Project Learnings';
  if (trimmed.includes(heading)) return `${trimmed}\n${update}`;
  return `${trimmed}\n\n${heading}\n\n${update}`;
}

function projectBackendAssessment(project: ProjectRecord) {
  const backendProjectRoot = project.metadata['backendProjectRoot'];
  const repositoryRoot = project.metadata['repositoryRoot'];
  if (typeof backendProjectRoot !== 'string' || typeof repositoryRoot !== 'string') {
    throw new HttpError(409, 'PROJECT_UNAVAILABLE', 'Project root is not backend accessible');
  }
  const parsedState = ProjectOnboardingStateSchema.safeParse(project.metadata['onboardingState']);
  const state = parsedState.success ? parsedState.data : 'missing';
  const activeBranch =
    typeof project.metadata['activeBranch'] === 'string'
      ? project.metadata['activeBranch']
      : undefined;
  return {
    backendProjectRoot,
    repositoryRoot,
    assessmentResult: assessProjectOnboarding({
      projectId: project.id,
      projectName: project.name,
      projectRoot: backendProjectRoot,
      repositoryRoot,
      activeBranch,
      currentState: state,
      existingInstructionFiles: parseProjectInstructionFileReferences(project.metadata),
    }),
  };
}

function instructionFilesWithApproval(
  assessmentResult: ReturnType<typeof assessProjectOnboarding>,
): ProjectInstructionFileReference[] {
  const approvedAtMs =
    assessmentResult.nextState === 'approved'
      ? assessmentResult.assessment.assessedAtMs
      : undefined;
  return assessmentResult.instructionFiles.map((file) =>
    approvedAtMs && file.scope === 'root' ? { ...file, approvedAtMs } : file,
  );
}

function mergeRefreshInstructionUpdateCandidates(input: {
  existing: ProjectInstructionUpdateCandidate[];
  assessment: ReturnType<typeof assessProjectOnboarding>['assessment'];
  nowMs: number;
}): ProjectInstructionUpdateCandidate[] {
  const activeKeys = new Set(
    input.existing
      .filter((candidate) => candidate.status === 'pending' || candidate.status === 'proposed')
      .map((candidate) => `${candidate.source}:${candidate.targetPath}:${candidate.summary}`),
  );
  const candidates = input.assessment.recommendedInstructionUpdates.flatMap(
    (recommendation, index) => {
      const targetPath = recommendation.targetPath ?? 'AGENTS.md';
      const key = `refresh:${targetPath}:${recommendation.summary}`;
      if (activeKeys.has(key)) return [];
      activeKeys.add(key);
      return [
        ProjectInstructionUpdateCandidateSchema.parse({
          id: `instruction-refresh-${input.nowMs}-${index + 1}`,
          targetPath,
          summary: recommendation.summary,
          ...(recommendation.rationale ? { rationale: recommendation.rationale } : {}),
          ...(recommendation.proposedMarkdown
            ? { proposedMarkdown: recommendation.proposedMarkdown }
            : {}),
          source: 'refresh',
          risk: 'needs_review',
          status: 'pending',
          evidence: [],
          createdAtMs: input.nowMs,
        }),
      ];
    },
  );
  return candidates.length ? [...input.existing, ...candidates] : input.existing;
}

function discoverBackendProjectMetadata(
  rawPath: string,
  existingMetadata: Record<string, unknown> = {},
): BackendProjectMetadata {
  if (!isAbsolute(rawPath)) {
    throw new HttpError(422, 'PROJECT_UNAVAILABLE', 'Project path must be absolute', {
      path: rawPath,
      capabilityState: 'unavailable',
    });
  }

  let projectRoot: string;
  try {
    projectRoot = realpathSync(rawPath);
    if (!statSync(projectRoot).isDirectory()) {
      throw new Error('not a directory');
    }
    readdirSync(projectRoot);
  } catch {
    throw new HttpError(422, 'PROJECT_UNAVAILABLE', 'Backend cannot inspect that project path', {
      path: rawPath,
      capabilityState: 'unavailable',
    });
  }

  const repositoryRoot = gitValue(projectRoot, ['rev-parse', '--show-toplevel']) ?? projectRoot;
  const activeBranch = gitValue(repositoryRoot, ['branch', '--show-current']);
  const headSha = gitValue(repositoryRoot, ['rev-parse', 'HEAD']);
  const instructionDiscovery = discoverProjectInstructions(
    projectRoot,
    parseProjectInstructionFileReferences(existingMetadata),
  );

  const metadata: BackendProjectMetadata = {
    backendProjectRoot: projectRoot,
    repositoryRoot,
    projectRoot: '/workspace',
    capabilityState: 'backend_accessible',
    onboardingState: instructionDiscovery.onboardingState,
    defaultAgentProfile: 'coding',
    instructionFiles: instructionDiscovery.instructionFiles,
  };
  if (activeBranch) metadata.activeBranch = activeBranch;
  metadata.activeWorktreeId = headSha ? `${repositoryRoot}:${headSha}` : repositoryRoot;
  const assessmentResult = assessProjectOnboarding({
    projectId: '',
    projectName: basename(projectRoot) || 'Project',
    projectRoot,
    repositoryRoot,
    activeBranch,
    currentState: metadataOnboardingState(existingMetadata) ?? instructionDiscovery.onboardingState,
    existingInstructionFiles: parseProjectInstructionFileReferences(existingMetadata),
  });
  const approvedAtMs =
    assessmentResult.nextState === 'approved'
      ? assessmentResult.assessment.assessedAtMs
      : undefined;
  metadata.onboardingState = assessmentResult.nextState;
  metadata.instructionFiles = assessmentResult.instructionFiles.map((file) =>
    approvedAtMs && file.scope === 'root' ? { ...file, approvedAtMs } : file,
  );
  metadata.onboardingAssessment = assessmentResult.assessment;
  return metadata;
}

function projectNameFor(input: ProjectOpenBody, projectRoot: string): string {
  return input.name?.trim() || basename(projectRoot) || 'Project';
}

function findProjectByWorkspaceKey(db: DrizzleDb, workspaceKey: string): ProjectRecord | undefined {
  return listProjects(db, { includeArchived: true }).find(
    (project) => project.workspaceKey === workspaceKey,
  );
}

function desktopWorkspaceKey(projectRoot: string): string {
  return `desktop:${sha256(projectRoot)}`;
}

function stableDesktopSlug(
  input: ProjectOpenBody,
  projectName: string,
  projectRoot: string,
): string {
  if (input.slug) return input.slug;
  const base = slugify(projectName) || 'project';
  return `${base.slice(0, 111)}-${sha256(projectRoot).slice(0, 8)}`;
}

function assertSupportedDesktopProjectRoot(projectRoot: string): void {
  if (projectRoot === parse(projectRoot).root) {
    throw new HttpError(422, 'PROJECT_UNAVAILABLE', 'Choose a folder inside your project.', {
      capabilityState: 'unavailable',
    });
  }
}

function requireDesktopProjectRegistration(req: Request): void {
  if (req.get(DESKTOP_PROJECT_REGISTRATION_HEADER) !== '1') {
    throw new HttpError(
      403,
      'DESKTOP_PROJECT_REGISTRATION_REQUIRED',
      'Project registration must come from the desktop app.',
    );
  }
}

function sanitizeDesktopProjectError(error: unknown): never {
  if (error instanceof HttpError && error.code === 'PROJECT_UNAVAILABLE') {
    throw new HttpError(
      error.status,
      error.code,
      'This Project folder could not be opened. Choose a folder you can access and try again.',
      {
        capabilityState: 'unavailable',
      },
    );
  }
  mapProjectError(error);
}

function openBackendProject(
  db: DrizzleDb,
  input: ProjectOpenBody,
): {
  project: ProjectRecord;
  created: boolean;
} {
  const initialMetadata = discoverBackendProjectMetadata(input.path);
  const existing = findProjectByWorkspaceKey(db, initialMetadata.backendProjectRoot);
  const metadata = existing
    ? discoverBackendProjectMetadata(input.path, existing.metadata)
    : initialMetadata;
  const name = projectNameFor(input, metadata.backendProjectRoot);

  if (existing) {
    const updated = updateProject(db, existing.id, {
      name,
      slug: input.slug,
      workspaceKey: metadata.backendProjectRoot,
      metadata: { ...existing.metadata, ...metadata },
      archivedAtMs: null,
    });
    return {
      project: withAutoApprovalMetadata(db, updated),
      created: false,
    };
  }

  const created = createProject(db, {
    name,
    slug: input.slug,
    workspaceKey: metadata.backendProjectRoot,
    metadata,
  });
  return {
    project: withAutoApprovalMetadata(db, created),
    created: true,
  };
}

function openDesktopProject(
  db: DrizzleDb,
  input: ProjectOpenBody,
): {
  project: ProjectRecord;
  created: boolean;
} {
  const initialMetadata = discoverBackendProjectMetadata(input.path);
  assertSupportedDesktopProjectRoot(initialMetadata.backendProjectRoot);
  const workspaceKey = desktopWorkspaceKey(initialMetadata.backendProjectRoot);
  const existing = findProjectByWorkspaceKey(db, workspaceKey);
  const metadata = existing
    ? discoverBackendProjectMetadata(input.path, existing.metadata)
    : initialMetadata;
  assertSupportedDesktopProjectRoot(metadata.backendProjectRoot);
  const name = projectNameFor(input, metadata.backendProjectRoot);
  const slug = stableDesktopSlug(input, name, metadata.backendProjectRoot);

  if (existing) {
    const updated = updateProject(db, existing.id, {
      name,
      slug,
      workspaceKey,
      metadata: { ...existing.metadata, ...metadata, source: 'desktop' },
      archivedAtMs: null,
    });
    return {
      project: withAutoApprovalMetadata(db, updated),
      created: false,
    };
  }

  const created = createProject(db, {
    name,
    slug,
    workspaceKey,
    metadata: { ...metadata, source: 'desktop' },
  });
  return {
    project: withAutoApprovalMetadata(db, created),
    created: true,
  };
}

function desktopProjectCapabilityState(project: ProjectRecord) {
  const backendProjectRoot = project.metadata['backendProjectRoot'];
  if (typeof backendProjectRoot !== 'string') return 'unavailable';
  try {
    return existsSync(backendProjectRoot) && statSync(backendProjectRoot).isDirectory()
      ? 'backend_accessible'
      : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function toDesktopProjectRecord(
  project: ProjectRecord,
  capabilityState = desktopProjectCapabilityState(project),
) {
  const onboardingState = metadataOnboardingState(project.metadata) ?? 'missing';
  const backendProjectRoot = project.metadata['backendProjectRoot'];
  const folderName =
    typeof backendProjectRoot === 'string'
      ? basename(backendProjectRoot) || project.name
      : project.name;
  const folderPathLabel =
    typeof backendProjectRoot === 'string'
      ? userFacingDesktopProjectPathLabel(backendProjectRoot, folderName)
      : undefined;
  const instructionFiles = parseProjectInstructionFileReferences(project.metadata);
  const activeBranch =
    typeof project.metadata['activeBranch'] === 'string'
      ? project.metadata['activeBranch']
      : undefined;

  return {
    ...project,
    workspaceKey: undefined,
    metadata: {
      source: 'desktop',
      folderName,
      ...(folderPathLabel ? { folderPathLabel } : {}),
      capabilityState,
      onboardingState,
      defaultAgentProfile: 'coding',
      ...(activeBranch ? { activeBranch } : {}),
      instructionFileCount: instructionFiles.length,
    },
  };
}

function userFacingDesktopProjectPathLabel(root: string, folderName: string): string {
  const normalizedRoot = resolve(root);
  const homeRelative = relative(homedir(), normalizedRoot);
  if (homeRelative && !homeRelative.startsWith('..') && !isAbsolute(homeRelative)) {
    return `~/${homeRelative.split(sep).join('/')}`;
  }

  const parentName = basename(dirname(normalizedRoot));
  return parentName ? `${parentName}/${folderName}` : folderName;
}

function toDesktopRegistrationResult(project: ProjectRecord, created: boolean) {
  return ProjectDesktopRegistrationResultSchema.parse({
    created,
    project: toDesktopProjectRecord(project, 'backend_accessible'),
  });
}

function isDesktopProject(project: ProjectRecord): boolean {
  return project.metadata['source'] === 'desktop';
}

function listRecentDesktopProjects(db: DrizzleDb) {
  const projects = listProjects(db)
    .filter(isDesktopProject)
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .map((project) => toDesktopProjectRecord(project));

  return ProjectDesktopRecentProjectsResultSchema.parse({ projects });
}

const IGNORED_PROJECT_TREE_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.cache',
  '__pycache__',
  '.turbo',
  'coverage',
]);
const MAX_PROJECT_TREE_DEPTH = 8;
const MAX_PROJECT_TREE_ENTRIES = 2000;
const MAX_PROJECT_FILE_READ_BYTES = 512 * 1024;
const BINARY_PROBE_BYTES = 4096;

function projectRootForBackendRead(project: ProjectRecord): string {
  const backendProjectRoot = project.metadata['backendProjectRoot'];
  if (typeof backendProjectRoot !== 'string' || !backendProjectRoot.trim()) {
    throw new HttpError(409, 'PROJECT_UNAVAILABLE', 'Project folder is not available');
  }

  try {
    const realRoot = realpathSync(backendProjectRoot);
    if (!statSync(realRoot).isDirectory()) {
      throw new Error('Project root is not a directory');
    }
    return realRoot;
  } catch {
    throw new HttpError(409, 'PROJECT_UNAVAILABLE', 'Project folder could not be inspected');
  }
}

function repositoryRootForBranchOperations(project: ProjectRecord): string {
  const repositoryRoot = project.metadata['repositoryRoot'];
  if (typeof repositoryRoot !== 'string' || !repositoryRoot.trim()) {
    throw new HttpError(409, 'PROJECT_GIT_UNAVAILABLE', 'Git is not available for this Project.');
  }

  try {
    const realRoot = realpathSync(repositoryRoot);
    if (!statSync(realRoot).isDirectory()) {
      throw new Error('Repository root is not a directory');
    }
    const insideWorkTree = gitOutput(realRoot, ['rev-parse', '--is-inside-work-tree']);
    if (insideWorkTree !== 'true') {
      throw new Error('Not a Git work tree');
    }
    return realRoot;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(409, 'PROJECT_GIT_UNAVAILABLE', 'Git is not available for this Project.');
  }
}

function projectBranchList(project: ProjectRecord): ProjectBranchListResult {
  const repositoryRoot = repositoryRootForBranchOperations(project);
  const currentBranch = gitOutput(repositoryRoot, ['branch', '--show-current']);
  if (!currentBranch) {
    throw new HttpError(
      409,
      'PROJECT_BRANCH_DETACHED',
      'Project is currently on a detached Git HEAD.',
    );
  }
  const branchOutput = gitOutput(repositoryRoot, [
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads',
  ]);
  const clean = gitOutput(repositoryRoot, ['status', '--porcelain', ...GIT_USER_PATHS]) === '';
  const branchNames = branchOutput
    .split('\n')
    .map((branch) => branch.trim())
    .filter(Boolean);

  return ProjectBranchListResultSchema.parse({
    currentBranch,
    clean,
    branches: branchNames.map((name) => ({ name, current: name === currentBranch })),
  });
}

const EMPTY_GIT_WORKING_TREE: ProjectGitWorkingTreeSummary = {
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

const CONFLICT_STATUS_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const MAX_GIT_DIFF_BYTES = 256 * 1024;

function githubRemoteDetected(remoteUrl: string | undefined): boolean {
  return Boolean(remoteUrl && /github\.com[:/]/i.test(remoteUrl));
}

function githubRepositorySlug(remoteUrl: string | undefined): string | undefined {
  if (!remoteUrl) return undefined;
  const sshMatch = /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i.exec(remoteUrl);
  if (sshMatch?.[1]) return sshMatch[1];
  const httpsMatch = /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i.exec(remoteUrl);
  if (httpsMatch?.[1]) return httpsMatch[1];
  return undefined;
}

function baseBranchFromUpstream(upstreamBranch: string | undefined): string | undefined {
  if (!upstreamBranch) return undefined;
  const slashIndex = upstreamBranch.indexOf('/');
  return slashIndex >= 0 ? upstreamBranch.slice(slashIndex + 1) : upstreamBranch;
}

function parseAheadBehind(statusLine: string | undefined): { ahead: number; behind: number } {
  if (!statusLine) return { ahead: 0, behind: 0 };
  const ahead = /\bahead (\d+)/.exec(statusLine)?.[1];
  const behind = /\bbehind (\d+)/.exec(statusLine)?.[1];
  return {
    ahead: ahead ? Number.parseInt(ahead, 10) : 0,
    behind: behind ? Number.parseInt(behind, 10) : 0,
  };
}

function parseWorkingTree(statusOutput: string): ProjectGitWorkingTreeSummary {
  const summary = { ...EMPTY_GIT_WORKING_TREE };
  for (const line of statusOutput.split('\n')) {
    if (!line || line.startsWith('## ')) continue;
    const code = line.slice(0, 2);
    const indexStatus = code[0] ?? ' ';
    const worktreeStatus = code[1] ?? ' ';
    if (code === '??') {
      summary.untracked += 1;
      summary.total += 1;
      continue;
    }
    if (CONFLICT_STATUS_CODES.has(code)) {
      summary.conflicts += 1;
    }
    if (indexStatus !== ' ') summary.staged += 1;
    if (worktreeStatus !== ' ') summary.unstaged += 1;
    if (indexStatus === 'A' || worktreeStatus === 'A') summary.added += 1;
    if (indexStatus === 'M' || worktreeStatus === 'M') summary.modified += 1;
    if (indexStatus === 'D' || worktreeStatus === 'D') summary.deleted += 1;
    if (indexStatus === 'R' || worktreeStatus === 'R') summary.renamed += 1;
    summary.total += 1;
  }
  return summary;
}

function validateGitRelativePath(pathValue: string): string {
  if (
    !pathValue ||
    pathValue.length > 1000 ||
    isAbsolute(pathValue) ||
    pathValue.includes('\\') ||
    pathValue.includes('\0')
  ) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Path must be repository-relative.');
  }
  const segments = pathValue.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '..')) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Path must be repository-relative.');
  }
  return pathValue;
}

function statusKind(code: string): ProjectGitFileStatus {
  if (CONFLICT_STATUS_CODES.has(code)) return 'conflict';
  if (code === '??') return 'untracked';
  const indexStatus = code[0] ?? ' ';
  const worktreeStatus = code[1] ?? ' ';
  if (indexStatus === 'R' || worktreeStatus === 'R') return 'renamed';
  if (indexStatus === 'D' || worktreeStatus === 'D') return 'deleted';
  if (indexStatus === 'A' || worktreeStatus === 'A') return 'added';
  return 'modified';
}

function parseStatusZ(statusOutput: string): ProjectGitChangedFile[] {
  const entries = statusOutput.split('\0').filter(Boolean);
  const files: ProjectGitChangedFile[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || entry.length < 4) continue;
    const code = entry.slice(0, 2);
    const indexStatus = code[0] ?? ' ';
    const worktreeStatus = code[1] ?? ' ';
    const pathValue = validateGitRelativePath(entry.slice(3));
    const renamed = indexStatus === 'R' || worktreeStatus === 'R';
    const originalPath = renamed ? entries[index + 1] : undefined;
    if (renamed) index += 1;

    files.push({
      path: pathValue,
      ...(originalPath ? { originalPath: validateGitRelativePath(originalPath) } : {}),
      status: statusKind(code),
      indexStatus,
      worktreeStatus,
      staged: indexStatus !== ' ' && indexStatus !== '?',
      unstaged: worktreeStatus !== ' ' || code === '??',
    });
  }
  return files;
}

function parseNumstat(
  output: string,
): Map<string, Pick<ProjectGitChangedFile, 'additions' | 'deletions'>> {
  const result = new Map<string, Pick<ProjectGitChangedFile, 'additions' | 'deletions'>>();
  for (const line of output.split('\n')) {
    const [added, deleted, filePath] = line.split('\t');
    if (!added || !deleted || !filePath || added === '-' || deleted === '-') continue;
    result.set(filePath, {
      additions: Number.parseInt(added, 10),
      deletions: Number.parseInt(deleted, 10),
    });
  }
  return result;
}

function enrichChangeStats(repositoryRoot: string, files: ProjectGitChangedFile[]) {
  const unstagedStats = parseNumstat(
    gitValue(repositoryRoot, ['diff', '--numstat', ...GIT_USER_PATHS]) ?? '',
  );
  const stagedStats = parseNumstat(
    gitValue(repositoryRoot, ['diff', '--cached', '--numstat', ...GIT_USER_PATHS]) ?? '',
  );
  return files.map((file) => {
    const stats = stagedStats.get(file.path) ?? unstagedStats.get(file.path);
    return stats ? { ...file, ...stats } : file;
  });
}

function unavailableGitChanges(reason: string) {
  return ProjectGitChangesResultSchema.parse({
    available: false,
    reason,
    clean: true,
    workingTree: EMPTY_GIT_WORKING_TREE,
    files: [],
  });
}

function projectGitChanges(project: ProjectRecord) {
  let projectRoot: string;
  try {
    projectRoot = projectRootForBackendRead(project);
  } catch {
    return unavailableGitChanges('Project folder is not available.');
  }

  const repositoryRoot = gitValue(projectRoot, ['rev-parse', '--show-toplevel']);
  if (!repositoryRoot) return unavailableGitChanges('Project is not a Git repository.');

  const statusOutput = gitRawOutput(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '-z',
    ...GIT_USER_PATHS,
  ]);
  const files = enrichChangeStats(repositoryRoot, parseStatusZ(statusOutput));
  const workingTree = parseWorkingTree(
    gitRawOutput(repositoryRoot, ['status', '--porcelain=v1', ...GIT_USER_PATHS]),
  );

  return ProjectGitChangesResultSchema.parse({
    available: true,
    clean: files.length === 0,
    workingTree,
    files,
  });
}

function gitDiffOutput(
  repositoryRoot: string,
  pathValue: string,
  mode: 'staged' | 'unstaged',
): string {
  const args =
    mode === 'staged' ? ['diff', '--cached', '--', pathValue] : ['diff', '--', pathValue];
  return gitRawOutput(repositoryRoot, args);
}

function syntheticUntrackedDiff(repositoryRoot: string, pathValue: string): string {
  const target = resolve(repositoryRoot, pathValue);
  const relativePath = relative(repositoryRoot, target);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Path must be repository-relative.');
  }
  let content: string;
  try {
    const stats = statSync(target);
    if (!stats.isFile() || stats.size > MAX_PROJECT_FILE_READ_BYTES) {
      return `Untracked file ${pathValue} is too large or cannot be previewed.`;
    }
    content = readFileSync(target, 'utf8');
  } catch {
    return '';
  }
  const lines = content.split('\n');
  const added = lines.map((line) => `+${line}`).join('\n');
  return [
    `diff --git a/${pathValue} b/${pathValue}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${pathValue}`,
    `@@ -0,0 +1,${lines.length} @@`,
    added,
  ].join('\n');
}

function projectGitFileDiff(project: ProjectRecord, rawPath: unknown, rawMode: unknown) {
  const pathValue = validateGitRelativePath(typeof rawPath === 'string' ? rawPath : '');
  const mode = rawMode === 'staged' ? 'staged' : 'unstaged';
  const repositoryRoot = repositoryRootForBranchOperations(project);
  const file = projectGitChanges(project).files.find((change) => change.path === pathValue);
  const diff =
    file?.status === 'untracked' && mode === 'unstaged'
      ? syntheticUntrackedDiff(repositoryRoot, pathValue)
      : gitDiffOutput(repositoryRoot, pathValue, mode);
  const truncated = Buffer.byteLength(diff, 'utf8') > MAX_GIT_DIFF_BYTES;
  return ProjectGitFileDiffResultSchema.parse({
    path: pathValue,
    mode,
    ...(file ? { status: file.status } : {}),
    diff: truncated ? diff.slice(0, MAX_GIT_DIFF_BYTES) : diff,
    truncated,
  });
}

function gitPathArgs(body: ProjectGitStageBody): string[] {
  if (body.all) return ['.'];
  return (body.paths ?? []).map(validateGitRelativePath);
}

function stageProjectGitChanges(project: ProjectRecord, rawBody: unknown) {
  const body = parseBody(ProjectGitStageBodySchema, rawBody);
  const repositoryRoot = repositoryRootForBranchOperations(project);
  gitOutput(
    repositoryRoot,
    body.all ? ['add', '-A', ...GIT_USER_PATHS] : ['add', '-A', '--', ...gitPathArgs(body)],
  );
  return projectGitChanges(project);
}

function unstageProjectGitChanges(project: ProjectRecord, rawBody: unknown) {
  const body = parseBody(ProjectGitStageBodySchema, rawBody);
  const repositoryRoot = repositoryRootForBranchOperations(project);
  gitOutput(repositoryRoot, ['restore', '--staged', '--', ...gitPathArgs(body)]);
  return projectGitChanges(project);
}

function commitProjectGitChanges(project: ProjectRecord, rawBody: unknown) {
  const body: ProjectGitCommitBody = parseBody(ProjectGitCommitBodySchema, rawBody);
  const repositoryRoot = repositoryRootForBranchOperations(project);
  const stagedOutput = gitRawOutput(repositoryRoot, [
    'diff',
    '--cached',
    '--name-only',
    ...GIT_USER_PATHS,
  ]);
  if (stagedOutput.trim() === '') {
    throw new HttpError(409, 'PROJECT_GIT_NOTHING_STAGED', 'Stage changes before committing.');
  }
  gitOutput(repositoryRoot, ['commit', '-m', body.message]);
  return projectGitStatus(project);
}

function latestCommit(repositoryRoot: string) {
  const output = gitValue(repositoryRoot, ['log', '-1', '--format=%H%x1f%s%x1f%an%x1f%cI']);
  if (!output) return undefined;
  const [sha, subject, authorName, committedAt] = output.split('\x1f');
  if (!sha || !subject) return undefined;
  return {
    sha: sha.slice(0, 12),
    subject,
    ...(authorName ? { authorName } : {}),
    ...(committedAt ? { committedAt } : {}),
  };
}

function projectGitStatus(project: ProjectRecord) {
  let projectRoot: string;
  try {
    projectRoot = projectRootForBackendRead(project);
  } catch {
    return ProjectGitStatusResultSchema.parse({
      available: false,
      reason: 'Project folder is not available.',
      clean: true,
      workingTree: EMPTY_GIT_WORKING_TREE,
    });
  }

  const repositoryRoot = gitValue(projectRoot, ['rev-parse', '--show-toplevel']);
  if (!repositoryRoot) {
    return ProjectGitStatusResultSchema.parse({
      available: false,
      reason: 'Project is not a Git repository.',
      clean: true,
      workingTree: EMPTY_GIT_WORKING_TREE,
    });
  }

  const statusOutput = gitOutput(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '--branch',
    ...GIT_USER_PATHS,
  ]);
  const branchLine = statusOutput.split('\n').find((line) => line.startsWith('## '));
  const currentBranch = gitValue(repositoryRoot, ['branch', '--show-current']);
  const upstreamBranch = gitValue(repositoryRoot, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);
  const remoteUrl = gitValue(repositoryRoot, ['remote', 'get-url', 'origin']);
  const workingTree = parseWorkingTree(statusOutput);
  const { ahead, behind } = parseAheadBehind(branchLine);
  const headSha = gitValue(repositoryRoot, ['rev-parse', 'HEAD']);

  return ProjectGitStatusResultSchema.parse({
    available: true,
    repositoryName: basename(repositoryRoot),
    ...(remoteUrl ? { remoteUrl } : {}),
    ...(currentBranch ? { currentBranch } : {}),
    ...(upstreamBranch ? { upstreamBranch } : {}),
    ...(baseBranchFromUpstream(upstreamBranch)
      ? { baseBranch: baseBranchFromUpstream(upstreamBranch) }
      : {}),
    ...(headSha ? { headSha: headSha.slice(0, 12) } : {}),
    ahead,
    behind,
    clean: workingTree.total === 0,
    workingTree,
    recentCommit: latestCommit(repositoryRoot),
    githubRemoteDetected: githubRemoteDetected(remoteUrl),
  });
}

function unavailableGitChecks(
  reason: string,
  options: Partial<{
    repositoryName: string;
    remoteUrl: string;
    currentBranch: string;
    headSha: string;
    githubRemoteDetected: boolean;
    ghAvailable: boolean;
    authenticated: boolean;
  }> = {},
) {
  return ProjectGitChecksResultSchema.parse({
    available: false,
    reason,
    ...(options.repositoryName ? { repositoryName: options.repositoryName } : {}),
    ...(options.remoteUrl ? { remoteUrl: options.remoteUrl } : {}),
    ...(options.currentBranch ? { currentBranch: options.currentBranch } : {}),
    ...(options.headSha ? { headSha: options.headSha } : {}),
    githubRemoteDetected: options.githubRemoteDetected ?? false,
    ghAvailable: options.ghAvailable ?? false,
    authenticated: options.authenticated ?? false,
    checkedAt: new Date().toISOString(),
    summary: EMPTY_GIT_CHECKS_SUMMARY,
    checks: [],
  });
}

type GhWorkflowRun = {
  databaseId?: number;
  name?: string;
  displayTitle?: string;
  workflowName?: string;
  status?: string;
  conclusion?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
  headSha?: string;
  event?: string;
};

function normalizeCheckStatus(status: string | undefined): ProjectGitCheckStatus {
  if (
    status === 'queued' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'waiting' ||
    status === 'pending' ||
    status === 'requested'
  ) {
    return status;
  }
  return 'unknown';
}

function normalizeCheckConclusion(
  conclusion: string | undefined,
): ProjectGitCheckConclusion | undefined {
  if (!conclusion) return undefined;
  if (
    conclusion === 'success' ||
    conclusion === 'failure' ||
    conclusion === 'cancelled' ||
    conclusion === 'skipped' ||
    conclusion === 'timed_out' ||
    conclusion === 'action_required' ||
    conclusion === 'neutral' ||
    conclusion === 'stale'
  ) {
    return conclusion;
  }
  return 'unknown';
}

function summarizeChecks(checks: ProjectGitCheckRun[]): ProjectGitChecksSummary {
  const summary = { ...EMPTY_GIT_CHECKS_SUMMARY, total: checks.length };
  for (const check of checks) {
    if (check.status === 'queued' || check.status === 'waiting' || check.status === 'pending') {
      summary.queued += 1;
      continue;
    }
    if (check.status === 'in_progress' || check.status === 'requested') {
      summary.inProgress += 1;
      continue;
    }
    if (check.conclusion === 'success') {
      summary.success += 1;
    } else if (check.conclusion === 'failure' || check.conclusion === 'timed_out') {
      summary.failure += 1;
    } else if (check.conclusion === 'cancelled') {
      summary.cancelled += 1;
    } else if (check.conclusion === 'skipped') {
      summary.skipped += 1;
    } else {
      summary.unknown += 1;
    }
  }
  return summary;
}

function parseGhWorkflowRuns(output: string): ProjectGitCheckRun[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new HttpError(
      502,
      'PROJECT_GITHUB_CHECKS_INVALID',
      'GitHub checks response was invalid.',
    );
  }
  if (!Array.isArray(parsed)) {
    throw new HttpError(
      502,
      'PROJECT_GITHUB_CHECKS_INVALID',
      'GitHub checks response was invalid.',
    );
  }
  return parsed.flatMap((value): ProjectGitCheckRun[] => {
    const run = value as GhWorkflowRun;
    const id = run.databaseId ? String(run.databaseId) : undefined;
    const name = run.workflowName ?? run.name ?? run.displayTitle;
    if (!id || !name) return [];
    return [
      {
        id,
        name,
        ...(run.workflowName ? { workflowName: run.workflowName } : {}),
        ...(run.displayTitle ? { displayTitle: run.displayTitle } : {}),
        status: normalizeCheckStatus(run.status),
        ...(normalizeCheckConclusion(run.conclusion)
          ? { conclusion: normalizeCheckConclusion(run.conclusion) }
          : {}),
        ...(run.event ? { event: run.event } : {}),
        ...(run.headSha ? { headSha: run.headSha.slice(0, 12) } : {}),
        ...(run.url ? { url: run.url } : {}),
        ...(run.createdAt ? { startedAt: run.createdAt } : {}),
        ...(run.updatedAt ? { completedAt: run.updatedAt } : {}),
      },
    ];
  });
}

function projectGitChecks(project: ProjectRecord) {
  let projectRoot: string;
  try {
    projectRoot = projectRootForBackendRead(project);
  } catch {
    return unavailableGitChecks('Project folder is not available.');
  }

  const repositoryRoot = gitValue(projectRoot, ['rev-parse', '--show-toplevel']);
  if (!repositoryRoot) return unavailableGitChecks('Project is not a Git repository.');

  const remoteUrl = gitValue(repositoryRoot, ['remote', 'get-url', 'origin']);
  const currentBranch = gitValue(repositoryRoot, ['branch', '--show-current']);
  const headSha = gitValue(repositoryRoot, ['rev-parse', 'HEAD'])?.slice(0, 12);
  const repositoryName = basename(repositoryRoot);
  const githubDetected = githubRemoteDetected(remoteUrl);
  const repositorySlug = githubRepositorySlug(remoteUrl);

  const baseOptions = {
    repositoryName,
    ...(remoteUrl ? { remoteUrl } : {}),
    ...(currentBranch ? { currentBranch } : {}),
    ...(headSha ? { headSha } : {}),
    githubRemoteDetected: githubDetected,
  };

  if (!githubDetected || !repositorySlug) {
    return unavailableGitChecks(
      'No GitHub origin remote is configured for this Project.',
      baseOptions,
    );
  }

  const ghVersion = ghValue(repositoryRoot, ['--version']);
  if (!ghVersion) {
    return unavailableGitChecks('GitHub CLI is not installed or is not available on PATH.', {
      ...baseOptions,
      ghAvailable: false,
    });
  }

  if (!ghSuccess(repositoryRoot, ['auth', 'status', '--hostname', 'github.com'])) {
    return unavailableGitChecks('GitHub CLI is not authenticated for github.com.', {
      ...baseOptions,
      ghAvailable: true,
      authenticated: false,
    });
  }

  const args = [
    'run',
    'list',
    '--repo',
    repositorySlug,
    '--limit',
    '20',
    '--json',
    'databaseId,name,displayTitle,workflowName,status,conclusion,createdAt,updatedAt,url,headSha,event',
  ];
  if (currentBranch) args.push('--branch', currentBranch);
  const runsOutput = ghValue(repositoryRoot, args);
  if (runsOutput === undefined) {
    return unavailableGitChecks('GitHub checks could not be loaded for this Project.', {
      ...baseOptions,
      ghAvailable: true,
      authenticated: true,
    });
  }

  const checks = parseGhWorkflowRuns(runsOutput);
  return ProjectGitChecksResultSchema.parse({
    available: true,
    ...baseOptions,
    ghAvailable: true,
    authenticated: true,
    checkedAt: new Date().toISOString(),
    summary: summarizeChecks(checks),
    checks,
  });
}

function unavailableGitPullRequests(
  reason: string,
  options: Partial<{
    repositoryName: string;
    remoteUrl: string;
    currentBranch: string;
    headSha: string;
    githubRemoteDetected: boolean;
    ghAvailable: boolean;
    authenticated: boolean;
  }> = {},
) {
  return ProjectGitPullRequestsResultSchema.parse({
    available: false,
    reason,
    ...(options.repositoryName ? { repositoryName: options.repositoryName } : {}),
    ...(options.remoteUrl ? { remoteUrl: options.remoteUrl } : {}),
    ...(options.currentBranch ? { currentBranch: options.currentBranch } : {}),
    ...(options.headSha ? { headSha: options.headSha } : {}),
    githubRemoteDetected: options.githubRemoteDetected ?? false,
    ghAvailable: options.ghAvailable ?? false,
    authenticated: options.authenticated ?? false,
    checkedAt: new Date().toISOString(),
    pullRequests: [],
  });
}

type GhPullRequest = {
  number?: number;
  title?: string;
  state?: string;
  url?: string;
  headRefName?: string;
  baseRefName?: string;
  author?: { login?: string } | null;
  isDraft?: boolean;
  reviewDecision?: string;
  mergeable?: string;
  createdAt?: string;
  updatedAt?: string;
  statusCheckRollup?: Array<{
    status?: string;
    conclusion?: string;
  }>;
};

function normalizePullRequestState(state: string | undefined): ProjectGitPullRequestState {
  const normalized = state?.toLowerCase();
  if (normalized === 'open' || normalized === 'closed' || normalized === 'merged') {
    return normalized;
  }
  return 'unknown';
}

function normalizeReviewDecision(
  decision: string | undefined,
): ProjectGitPullRequestReviewDecision | undefined {
  if (!decision) return undefined;
  const normalized = decision.toLowerCase();
  if (
    normalized === 'approved' ||
    normalized === 'changes_requested' ||
    normalized === 'review_required'
  ) {
    return normalized;
  }
  return 'unknown';
}

function summarizePullRequestChecks(
  checks: GhPullRequest['statusCheckRollup'],
): ProjectGitPullRequestCheckSummary {
  const summary = { ...EMPTY_PR_CHECK_SUMMARY, total: checks?.length ?? 0 };
  for (const check of checks ?? []) {
    const status = check.status?.toLowerCase();
    const conclusion = check.conclusion?.toLowerCase();
    if (status && status !== 'completed') {
      summary.pending += 1;
    } else if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') {
      summary.success += 1;
    } else if (
      conclusion === 'failure' ||
      conclusion === 'timed_out' ||
      conclusion === 'cancelled' ||
      conclusion === 'action_required'
    ) {
      summary.failure += 1;
    } else {
      summary.unknown += 1;
    }
  }
  return summary;
}

function parseGhPullRequests(
  output: string,
  currentBranch: string | undefined,
): ProjectGitPullRequestSummary[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new HttpError(
      502,
      'PROJECT_GITHUB_PULL_REQUESTS_INVALID',
      'GitHub pull requests response was invalid.',
    );
  }
  if (!Array.isArray(parsed)) {
    throw new HttpError(
      502,
      'PROJECT_GITHUB_PULL_REQUESTS_INVALID',
      'GitHub pull requests response was invalid.',
    );
  }

  return parsed.flatMap((value): ProjectGitPullRequestSummary[] => {
    const pullRequest = value as GhPullRequest;
    if (
      !pullRequest.number ||
      !pullRequest.title ||
      !pullRequest.url ||
      !pullRequest.headRefName ||
      !pullRequest.baseRefName
    ) {
      return [];
    }
    return [
      {
        number: pullRequest.number,
        title: pullRequest.title,
        state: normalizePullRequestState(pullRequest.state),
        url: pullRequest.url,
        headRefName: pullRequest.headRefName,
        baseRefName: pullRequest.baseRefName,
        ...(pullRequest.author?.login ? { authorLogin: pullRequest.author.login } : {}),
        isDraft: pullRequest.isDraft ?? false,
        currentBranch: Boolean(currentBranch && pullRequest.headRefName === currentBranch),
        ...(normalizeReviewDecision(pullRequest.reviewDecision)
          ? { reviewDecision: normalizeReviewDecision(pullRequest.reviewDecision) }
          : {}),
        ...(pullRequest.mergeable ? { mergeable: pullRequest.mergeable } : {}),
        ...(pullRequest.createdAt ? { createdAt: pullRequest.createdAt } : {}),
        ...(pullRequest.updatedAt ? { updatedAt: pullRequest.updatedAt } : {}),
        checks: summarizePullRequestChecks(pullRequest.statusCheckRollup),
      },
    ];
  });
}

function projectGithubPullRequests(project: ProjectRecord) {
  let projectRoot: string;
  try {
    projectRoot = projectRootForBackendRead(project);
  } catch {
    return unavailableGitPullRequests('Project folder is not available.');
  }

  const repositoryRoot = gitValue(projectRoot, ['rev-parse', '--show-toplevel']);
  if (!repositoryRoot) return unavailableGitPullRequests('Project is not a Git repository.');

  const remoteUrl = gitValue(repositoryRoot, ['remote', 'get-url', 'origin']);
  const currentBranch = gitValue(repositoryRoot, ['branch', '--show-current']);
  const headSha = gitValue(repositoryRoot, ['rev-parse', 'HEAD'])?.slice(0, 12);
  const repositoryName = basename(repositoryRoot);
  const githubDetected = githubRemoteDetected(remoteUrl);
  const repositorySlug = githubRepositorySlug(remoteUrl);

  const baseOptions = {
    repositoryName,
    ...(remoteUrl ? { remoteUrl } : {}),
    ...(currentBranch ? { currentBranch } : {}),
    ...(headSha ? { headSha } : {}),
    githubRemoteDetected: githubDetected,
  };

  if (!githubDetected || !repositorySlug) {
    return unavailableGitPullRequests(
      'No GitHub origin remote is configured for this Project.',
      baseOptions,
    );
  }

  const ghVersion = ghValue(repositoryRoot, ['--version']);
  if (!ghVersion) {
    return unavailableGitPullRequests('GitHub CLI is not installed or is not available on PATH.', {
      ...baseOptions,
      ghAvailable: false,
    });
  }

  if (!ghSuccess(repositoryRoot, ['auth', 'status', '--hostname', 'github.com'])) {
    return unavailableGitPullRequests('GitHub CLI is not authenticated for github.com.', {
      ...baseOptions,
      ghAvailable: true,
      authenticated: false,
    });
  }

  const pullRequestsOutput = ghValue(repositoryRoot, [
    'pr',
    'list',
    '--repo',
    repositorySlug,
    '--state',
    'open',
    '--limit',
    '30',
    '--json',
    'number,title,state,url,headRefName,baseRefName,author,isDraft,reviewDecision,mergeable,createdAt,updatedAt,statusCheckRollup',
  ]);
  if (pullRequestsOutput === undefined) {
    return unavailableGitPullRequests(
      'GitHub pull requests could not be loaded for this Project.',
      {
        ...baseOptions,
        ghAvailable: true,
        authenticated: true,
      },
    );
  }

  return ProjectGitPullRequestsResultSchema.parse({
    available: true,
    ...baseOptions,
    ghAvailable: true,
    authenticated: true,
    checkedAt: new Date().toISOString(),
    pullRequests: parseGhPullRequests(pullRequestsOutput, currentBranch),
  });
}

function refreshProjectGitMetadata(db: DrizzleDb, id: string): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const backendProjectRoot = project.metadata['backendProjectRoot'];
  if (typeof backendProjectRoot !== 'string' || !backendProjectRoot.trim()) {
    throw new HttpError(409, 'PROJECT_UNAVAILABLE', 'Project folder is not available');
  }

  let projectRoot: string;
  try {
    projectRoot = realpathSync(backendProjectRoot);
    if (!statSync(projectRoot).isDirectory()) {
      throw new Error('Project root is not a directory');
    }
    readdirSync(projectRoot);
  } catch {
    throw new HttpError(409, 'PROJECT_UNAVAILABLE', 'Project folder could not be inspected');
  }

  const repositoryRoot = gitValue(projectRoot, ['rev-parse', '--show-toplevel']) ?? projectRoot;
  const insideWorkTree =
    gitValue(repositoryRoot, ['rev-parse', '--is-inside-work-tree']) === 'true';
  const activeBranch = insideWorkTree
    ? gitValue(repositoryRoot, ['branch', '--show-current'])
    : undefined;
  const headSha = insideWorkTree ? gitValue(repositoryRoot, ['rev-parse', 'HEAD']) : undefined;
  const metadata = { ...project.metadata };
  metadata.backendProjectRoot = projectRoot;
  metadata.repositoryRoot = repositoryRoot;
  metadata.capabilityState = 'backend_accessible';
  if (activeBranch) {
    metadata.activeBranch = activeBranch;
  } else {
    delete metadata.activeBranch;
  }
  if (insideWorkTree) {
    metadata.activeWorktreeId = headSha ? `${repositoryRoot}:${headSha}` : repositoryRoot;
  } else {
    delete metadata.activeWorktreeId;
  }

  return updateProject(db, id, { metadata });
}

function checkoutProjectBranch(db: DrizzleDb, id: string, body: unknown): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const input = parseBody(ProjectBranchCheckoutBodySchema, body);
  const repositoryRoot = repositoryRootForBranchOperations(project);
  const branches = projectBranchList(project);
  if (!branches.clean) {
    throw new HttpError(
      409,
      'PROJECT_BRANCH_DIRTY',
      'Commit or stash local changes before switching branches.',
    );
  }
  if (!branches.branches.some((branch) => branch.name === input.branch)) {
    throw new HttpError(404, 'PROJECT_BRANCH_NOT_FOUND', 'Project branch was not found.');
  }
  gitOutput(repositoryRoot, ['switch', input.branch]);
  const activeBranch = gitOutput(repositoryRoot, ['branch', '--show-current']);
  const headSha = gitValue(repositoryRoot, ['rev-parse', 'HEAD']);
  return updateProject(db, id, {
    metadata: {
      ...project.metadata,
      activeBranch,
      activeWorktreeId: headSha ? `${repositoryRoot}:${headSha}` : repositoryRoot,
    },
  });
}

function projectRelativePath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join('/');
}

function normalizeProjectRelativePath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Project file path is required');
  }
  const trimmed = value.trim();
  if (trimmed.includes('\0')) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Project file path is invalid');
  }
  if (trimmed.startsWith('/') || isAbsolute(trimmed)) {
    throw new HttpError(403, 'PATH_ACCESS_DENIED', 'Use a Project-relative file path');
  }

  const normalized = posix.normalize(trimmed.replaceAll('\\', '/'));
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new HttpError(403, 'PATH_ACCESS_DENIED', 'File path must stay inside the Project');
  }
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
}

function isLikelyBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, BINARY_PROBE_BYTES).includes(0);
}

async function listProjectFiles(project: ProjectRecord) {
  const projectRoot = projectRootForBackendRead(project);
  const jail = new PathJail([{ label: 'project', hostPath: projectRoot, permission: 'read_only' }]);
  const counter = { count: 0 };

  async function walk(directory: string, depth: number): Promise<ProjectFileNode[]> {
    if (depth > MAX_PROJECT_TREE_DEPTH || counter.count >= MAX_PROJECT_TREE_ENTRIES) return [];

    let entries: Array<{
      name: string;
      isDirectory(): boolean;
      isFile(): boolean;
    }>;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: ProjectFileNode[] = [];
    for (const entry of entries) {
      if (counter.count >= MAX_PROJECT_TREE_ENTRIES) break;
      if (
        entry.isDirectory() &&
        (IGNORED_PROJECT_TREE_DIRECTORIES.has(entry.name) || entry.name.startsWith('.'))
      ) {
        continue;
      }

      const absolutePath = join(directory, entry.name);
      const validation = await jail.validate(absolutePath, 'read');
      if (!validation.allowed) continue;

      let entryStat: Awaited<ReturnType<typeof stat>>;
      try {
        entryStat = await stat(validation.resolvedPath);
      } catch {
        continue;
      }

      counter.count += 1;
      const nodePath = projectRelativePath(projectRoot, validation.resolvedPath);
      if (entryStat.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: nodePath,
          type: 'directory',
          children: await walk(validation.resolvedPath, depth + 1),
        });
      } else if (entryStat.isFile()) {
        nodes.push({
          name: entry.name,
          path: nodePath,
          type: 'file',
          size: entryStat.size,
        });
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  return ProjectFileTreeResultSchema.parse({
    rootName: basename(projectRoot) || project.name,
    files: await walk(projectRoot, 1),
  });
}

async function readProjectFile(project: ProjectRecord, rawPath: unknown) {
  const projectRoot = projectRootForBackendRead(project);
  const relativePath = normalizeProjectRelativePath(rawPath);
  const jail = new PathJail([{ label: 'project', hostPath: projectRoot, permission: 'read_only' }]);
  const validation = await jail.validate(join(projectRoot, relativePath), 'read');
  if (!validation.allowed) {
    throw new HttpError(403, 'PATH_ACCESS_DENIED', 'File path must stay inside the Project');
  }

  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(validation.resolvedPath);
  } catch {
    throw new HttpError(404, 'PROJECT_FILE_NOT_FOUND', 'Project file not found');
  }
  if (!fileStat.isFile()) {
    throw new HttpError(400, 'PROJECT_FILE_INVALID', 'Only files can be opened');
  }
  if (fileStat.size > MAX_PROJECT_FILE_READ_BYTES) {
    throw new HttpError(413, 'PROJECT_FILE_TOO_LARGE', 'Project file is too large to open');
  }

  const buffer = await readFile(validation.resolvedPath);
  if (isLikelyBinary(buffer)) {
    throw new HttpError(415, 'PROJECT_FILE_BINARY', 'Binary files cannot be opened in the editor');
  }

  return ProjectFileReadResultSchema.parse({
    name: basename(validation.resolvedPath),
    path: projectRelativePath(projectRoot, validation.resolvedPath),
    content: buffer.toString('utf8'),
    size: fileStat.size,
  });
}

function approveProjectOnboarding(db: DrizzleDb, id: string, body: unknown): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const input = parseBody(ProjectOnboardingReviewBodySchema, body);
  if (input.decision !== 'approve') return reviewProjectOnboarding(db, id, body);
  const backendProjectRoot = project.metadata['backendProjectRoot'];
  if (typeof backendProjectRoot !== 'string') {
    throw new HttpError(409, 'PROJECT_UNAVAILABLE', 'Project root is not backend accessible');
  }
  const draft = parseStoredOnboardingDraft(project.metadata);
  const targetPath = draft?.targetPath ?? 'AGENTS.md';
  const targetFile = resolveProjectWriteTarget(backendProjectRoot, targetPath);
  if (draft) {
    writeFileSync(targetFile, draft.markdown, 'utf8');
  }
  const discovery = discoverProjectInstructions(
    backendProjectRoot,
    parseProjectInstructionFileReferences(project.metadata),
  );
  const rootRef = rootInstructionReference(discovery.instructionFiles);
  if (!rootRef) {
    throw new HttpError(
      409,
      'PROJECT_INSTRUCTIONS_MISSING',
      'Root AGENTS.md is required before approval',
    );
  }
  if (!draft) {
    const assessment = requireProjectAssessment(project);
    if (assessment.status !== 'approved') {
      throw new HttpError(
        409,
        'PROJECT_INSTRUCTIONS_REVIEW_REQUIRED',
        'Project instructions need a draft review before approval',
      );
    }
  }
  const approvedAtMs = Date.now();
  const contentHash = rootRef.contentHash ?? sha256(readFileSync(targetFile, 'utf8'));
  return updateProject(db, id, {
    metadata: {
      ...project.metadata,
      onboardingState: 'approved',
      instructionFiles: discovery.instructionFiles.map((file) => ({ ...file, approvedAtMs })),
      onboardingApproval: buildOnboardingApproval({
        projectId: project.id,
        targetPath,
        contentHash,
        reviewer: input.reviewer,
        source: 'manual_review',
        decidedAtMs: approvedAtMs,
        comment: input.comment,
      }),
    },
  });
}

function reviewProjectOnboarding(db: DrizzleDb, id: string, body: unknown): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const input = parseBody(ProjectOnboardingReviewBodySchema, body);
  if (input.decision === 'approve') return approveProjectOnboarding(db, id, input);

  const nowMs = Date.now();
  const previousDialogue = parseStoredOnboardingDialogue(project.metadata);
  const feedback = input.comment?.trim() || 'Project instruction changes requested.';
  const feedbackTurn = {
    id: `review-${nowMs}`,
    role: 'user' as const,
    content: feedback,
    questionId: 'review-feedback',
    createdAtMs: nowMs,
  };
  const dialogue = previousDialogue
    ? {
        ...previousDialogue,
        status: 'asking' as const,
        ...(previousDialogue.activeQuestionId
          ? { activeQuestionId: previousDialogue.activeQuestionId }
          : {}),
        turns: [...previousDialogue.turns, feedbackTurn],
        updatedAtMs: nowMs,
      }
    : {
        status: 'asking' as const,
        answeredQuestionIds: [],
        turns: [feedbackTurn],
        updatedAtMs: nowMs,
      };

  const review = ProjectOnboardingApprovalDecisionSchema.parse({
    decision: input.decision,
    projectId: project.id,
    targetPath: parseStoredOnboardingDraft(project.metadata)?.targetPath ?? 'AGENTS.md',
    reviewer: input.reviewer,
    source: 'manual_review',
    decidedAtMs: nowMs,
    ...(input.comment ? { comment: input.comment } : {}),
  });
  let metadata = project.metadata;
  if (input.decision === 'reject') {
    metadata = { ...project.metadata };
    delete metadata['onboardingDraft'];
  }

  return updateProject(db, id, {
    metadata: {
      ...metadata,
      onboardingState: 'in_progress',
      onboardingDialogue: dialogue,
      onboardingReview: review,
    },
  });
}

function assessProjectForOnboarding(db: DrizzleDb, id: string): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const { assessmentResult } = projectBackendAssessment(project);

  const updated = updateProject(db, id, {
    metadata: {
      ...project.metadata,
      onboardingState: assessmentResult.nextState,
      onboardingAssessment: assessmentResult.assessment,
      instructionFiles: instructionFilesWithApproval(assessmentResult),
    },
  });
  return withAutoApprovalMetadata(db, updated);
}

function refreshProjectOnboarding(db: DrizzleDb, id: string): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const previousState = metadataOnboardingState(project.metadata) ?? 'missing';
  const previousAssessment = ProjectOnboardingAssessmentSchema.safeParse(
    project.metadata['onboardingAssessment'],
  );
  const previousInstructionFiles = parseProjectInstructionFileReferences(project.metadata);
  const existingCandidates = parseInstructionUpdateCandidates(project.metadata);
  const { assessmentResult } = projectBackendAssessment(project);
  const nextAssessment = assessmentResult.assessment;
  const nextState = assessmentResult.nextState;
  const previousAssessmentData = previousAssessment.success ? previousAssessment.data : undefined;
  const previousProfile = previousAssessmentData?.profile;
  const preserveProfile =
    previousProfile &&
    previousProfile !== 'coding' &&
    previousProfile !== 'unknown' &&
    nextAssessment.profile === 'coding';
  const assessment = preserveProfile
    ? ProjectOnboardingAssessmentSchema.parse({
        ...nextAssessment,
        profile: previousProfile,
        display: {
          ...nextAssessment.display,
          profileLabel: previousAssessmentData?.display.profileLabel,
        },
        summary: `${nextAssessment.summary} Previous non-code or mixed Project framing is preserved until the user confirms a change.`,
      })
    : nextAssessment;
  const materialDrift = previousState === 'approved' && nextState === 'needs_review';
  let updateStatus: 'no_change' | 'proposed_update' | 'material_drift' = 'no_change';
  if (materialDrift) {
    updateStatus = 'material_drift';
  } else if (assessment.recommendedInstructionUpdates.length > 0) {
    updateStatus = 'proposed_update';
  }
  const preserveApprovedSetup = previousState === 'approved' && materialDrift;
  const persistedState = preserveApprovedSetup ? previousState : nextState;
  const instructionFiles = preserveApprovedSetup
    ? previousInstructionFiles
    : instructionFilesWithApproval(assessmentResult);
  const nowMs = assessment.assessedAtMs;
  const instructionUpdateCandidates =
    updateStatus === 'no_change'
      ? existingCandidates
      : mergeRefreshInstructionUpdateCandidates({
          existing: existingCandidates,
          assessment,
          nowMs,
        });
  const result = ProjectOnboardingRefreshResultSchema.parse({
    previousState,
    nextState,
    updateStatus,
    materialDrift,
    assessment,
    refreshedAtMs: assessment.assessedAtMs,
  });

  const updated = updateProject(db, id, {
    metadata: {
      ...project.metadata,
      onboardingState: persistedState,
      instructionFiles,
      onboardingAssessment: assessment,
      onboardingRefresh: result,
      instructionUpdateCandidates,
    },
  });
  return withAutoApprovalMetadata(db, updated);
}

function collectInstructionUpdateCandidates(
  db: DrizzleDb,
  id: string,
  body: unknown,
): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const input = parseBody(ProjectInstructionUpdateCandidateBodySchema, body);
  const nowMs = Date.now();
  const existing = parseInstructionUpdateCandidates(project.metadata);
  const candidates = input.candidates.map((candidate, index) =>
    ProjectInstructionUpdateCandidateSchema.parse({
      ...candidate,
      id: `instruction-update-${nowMs}-${index + 1}`,
      status: 'pending',
      createdAtMs: nowMs,
    }),
  );

  return updateProject(db, id, {
    metadata: {
      ...project.metadata,
      instructionUpdateCandidates: [...existing, ...candidates],
    },
  });
}

function proposeCloseoutInstructionUpdates(db: DrizzleDb, id: string): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const candidates = parseInstructionUpdateCandidates(project.metadata);
  const proposalCandidates = candidates.filter(
    (candidate) => candidate.status === 'pending' && candidate.risk !== 'policy_change',
  );
  const proposedIds = new Set(proposalCandidates.map((candidate) => candidate.id));
  const nextCandidates = candidates.map((candidate) =>
    proposedIds.has(candidate.id) ? { ...candidate, status: 'proposed' as const } : candidate,
  );
  const nowMs = Date.now();
  const proposal = ProjectInstructionUpdateProposalSchema.parse({
    id: `instruction-closeout-${nowMs}`,
    status: proposalCandidates.length ? 'ready' : 'empty',
    candidateIds: proposalCandidates.map((candidate) => candidate.id),
    summary: proposalCandidates.length
      ? `${proposalCandidates.length} reviewable Project instruction update(s) are ready.`
      : 'No low-risk Project instruction updates are ready for closeout.',
    policy: 'relaxed_reviewable',
    createdAtMs: nowMs,
  });

  return updateProject(db, id, {
    metadata: {
      ...project.metadata,
      instructionUpdateCandidates: nextCandidates,
      instructionUpdateProposal: proposal,
    },
  });
}

function decideInstructionUpdateCandidate(input: {
  db: DrizzleDb;
  projectId: string;
  candidateId: string;
  decision: 'apply' | 'reject';
  body: unknown;
}): ProjectRecord {
  const project = findProject(input.db, input.projectId);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const decisionBody = parseBody(ProjectInstructionUpdateDecisionBodySchema, input.body);
  const candidates = parseInstructionUpdateCandidates(project.metadata);
  const candidate = candidates.find((item) => item.id === input.candidateId);
  if (!candidate) throw new HttpError(404, 'NOT_FOUND', 'Instruction update candidate not found');
  if (candidate.status === 'applied' || candidate.status === 'rejected') {
    throw new HttpError(409, 'INSTRUCTION_UPDATE_DECIDED', 'Instruction update is already decided');
  }

  const backendProjectRoot = project.metadata['backendProjectRoot'];
  if (typeof backendProjectRoot !== 'string') {
    throw new HttpError(409, 'PROJECT_UNAVAILABLE', 'Project root is not backend accessible');
  }

  const nowMs = Date.now();
  if (input.decision === 'apply') {
    const targetFile = resolveProjectWriteTarget(backendProjectRoot, candidate.targetPath);
    const current = readFileSync(targetFile, 'utf8');
    writeFileSync(targetFile, appendInstructionUpdate(current, candidate), 'utf8');
  }

  const nextCandidates = candidates.map((item) =>
    item.id === candidate.id
      ? {
          ...item,
          status: input.decision === 'apply' ? ('applied' as const) : ('rejected' as const),
          reviewer: decisionBody.reviewer,
          decidedAtMs: nowMs,
          ...(decisionBody.comment ? { decisionComment: decisionBody.comment } : {}),
        }
      : item,
  );

  const discovery =
    input.decision === 'apply'
      ? discoverProjectInstructions(
          backendProjectRoot,
          parseProjectInstructionFileReferences(project.metadata),
        )
      : undefined;

  return updateProject(input.db, input.projectId, {
    metadata: {
      ...project.metadata,
      instructionUpdateCandidates: nextCandidates,
      ...(discovery ? { instructionFiles: discovery.instructionFiles } : {}),
    },
  });
}

function answerProjectOnboardingQuestion(db: DrizzleDb, id: string, body: unknown): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const assessment = requireProjectAssessment(project);
  const input = parseBody(ProjectOnboardingAnswerBodySchema, body);
  const nowMs = Date.now();
  const previousDraft = parseStoredOnboardingDraft(project.metadata);
  const previousDialogue =
    parseStoredOnboardingDialogue(project.metadata) ??
    createInitialOnboardingDialogue(assessment, nowMs);
  if (!input.questionId && !previousDialogue.activeQuestionId) {
    throw new HttpError(
      409,
      'PROJECT_ONBOARDING_NO_ACTIVE_QUESTION',
      'There is no active onboarding question to answer',
    );
  }
  const dialogue = recordOnboardingAnswer({
    assessment,
    dialogue: previousDialogue,
    questionId: input.questionId,
    answer: input.answer,
    nowMs,
  });
  const draft = buildOnboardingDraft({
    project,
    assessment,
    previousDraft,
    existingInstructionMarkdown: previousDraft ? undefined : readExistingRootInstructions(project),
    dialogue,
    nowMs,
  });

  return updateProject(db, id, {
    metadata: {
      ...project.metadata,
      onboardingState:
        project.metadata['onboardingState'] === 'approved' ? 'needs_review' : 'in_progress',
      onboardingDraft: draft,
      onboardingDialogue: dialogue,
    },
  });
}

export function createProjectsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = ProjectQuerySchema.parse(req.query);
      res.json({ data: listProjects(db, query) });
    }),
  );

  router.get(
    '/desktop/recent',
    asyncHandler(async (_req, res) => {
      res.json({ data: listRecentDesktopProjects(db) });
    }),
  );

  router.get(
    '/:id/files/tree',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: await listProjectFiles(project) });
    }),
  );

  router.get(
    '/:id/files/read',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: await readProjectFile(project, req.query.path) });
    }),
  );

  router.get(
    '/:id/branches',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: projectBranchList(project) });
    }),
  );

  router.get(
    '/:id/git/status',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: projectGitStatus(project) });
    }),
  );

  router.get(
    '/:id/git/changes',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: projectGitChanges(project) });
    }),
  );

  router.get(
    '/:id/git/diff',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: projectGitFileDiff(project, req.query.path, req.query.mode) });
    }),
  );

  router.post(
    '/:id/git/stage',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: stageProjectGitChanges(project, req.body) });
    }),
  );

  router.post(
    '/:id/git/unstage',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: unstageProjectGitChanges(project, req.body) });
    }),
  );

  router.post(
    '/:id/git/commit',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: commitProjectGitChanges(project, req.body) });
    }),
  );

  router.get(
    '/:id/git/checks',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: projectGitChecks(project) });
    }),
  );

  router.get(
    '/:id/github/pull-requests',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: projectGithubPullRequests(project) });
    }),
  );

  router.post(
    '/:id/branches/checkout',
    asyncHandler(async (req, res) => {
      try {
        res.json({
          data: checkoutProjectBranch(db, requireParam(req.params, 'id'), req.body),
        });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/refresh',
    asyncHandler(async (req, res) => {
      try {
        res.json({ data: refreshProjectGitMetadata(db, requireParam(req.params, 'id')) });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const project = findProject(db, requireParam(req.params, 'id'));
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.json({ data: project });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      try {
        const project = createProject(db, parseBody(ProjectCreateBodySchema, req.body));
        res.status(201).json({ data: project });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/open',
    asyncHandler(async (req, res) => {
      try {
        const { project, created } = openBackendProject(
          db,
          parseBody(ProjectOpenBodySchema, req.body),
        );
        res.status(created ? 201 : 200).json({ data: project });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/desktop/register',
    asyncHandler(async (req, res) => {
      try {
        requireDesktopProjectRegistration(req);
        const { project, created } = openDesktopProject(
          db,
          parseBody(ProjectDesktopRegistrationBodySchema, req.body),
        );
        res
          .status(created ? 201 : 200)
          .json({ data: toDesktopRegistrationResult(project, created) });
      } catch (error) {
        sanitizeDesktopProjectError(error);
      }
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      try {
        const project = updateProject(
          db,
          requireParam(req.params, 'id'),
          parseBody(ProjectUpdateBodySchema, req.body),
        );
        res.json({ data: project });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/onboarding/approve',
    asyncHandler(async (req, res) => {
      try {
        res.json({
          data: approveProjectOnboarding(db, requireParam(req.params, 'id'), req.body),
        });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/onboarding/review',
    asyncHandler(async (req, res) => {
      try {
        res.json({ data: reviewProjectOnboarding(db, requireParam(req.params, 'id'), req.body) });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/onboarding/assess',
    asyncHandler(async (req, res) => {
      try {
        res.json({ data: assessProjectForOnboarding(db, requireParam(req.params, 'id')) });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/onboarding/refresh',
    asyncHandler(async (req, res) => {
      try {
        res.json({ data: refreshProjectOnboarding(db, requireParam(req.params, 'id')) });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/instruction-updates/candidates',
    asyncHandler(async (req, res) => {
      try {
        res.json({
          data: collectInstructionUpdateCandidates(db, requireParam(req.params, 'id'), req.body),
        });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/instruction-updates/closeout',
    asyncHandler(async (req, res) => {
      try {
        res.json({
          data: proposeCloseoutInstructionUpdates(db, requireParam(req.params, 'id')),
        });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/instruction-updates/candidates/:candidateId/apply',
    asyncHandler(async (req, res) => {
      try {
        res.json({
          data: decideInstructionUpdateCandidate({
            db,
            projectId: requireParam(req.params, 'id'),
            candidateId: requireParam(req.params, 'candidateId'),
            decision: 'apply',
            body: req.body,
          }),
        });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/instruction-updates/candidates/:candidateId/reject',
    asyncHandler(async (req, res) => {
      try {
        res.json({
          data: decideInstructionUpdateCandidate({
            db,
            projectId: requireParam(req.params, 'id'),
            candidateId: requireParam(req.params, 'candidateId'),
            decision: 'reject',
            body: req.body,
          }),
        });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/onboarding/draft',
    asyncHandler(async (req, res) => {
      try {
        res.json({ data: startProjectOnboardingDraft(db, requireParam(req.params, 'id')) });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.post(
    '/:id/onboarding/answer',
    asyncHandler(async (req, res) => {
      try {
        res.json({
          data: answerProjectOnboardingQuestion(db, requireParam(req.params, 'id'), req.body),
        });
      } catch (error) {
        mapProjectError(error);
      }
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ok = archiveProject(db, requireParam(req.params, 'id'));
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
      res.status(204).send();
    }),
  );

  return router;
}
