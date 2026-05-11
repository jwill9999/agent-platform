import {
  ProjectCreateBodySchema,
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
  type ProjectOnboardingAssessment,
  type ProjectInstructionUpdateCandidate,
  type ProjectInstructionFileReference,
  type ProjectRecord,
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
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';

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

function metadataOnboardingState(
  metadata: Record<string, unknown>,
): BackendProjectMetadata['onboardingState'] | undefined {
  const parsed = ProjectOnboardingStateSchema.safeParse(metadata['onboardingState']);
  return parsed.success ? parsed.data : undefined;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
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
  const targetFile = join(backendProjectRoot, targetPath);
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

  return updateProject(db, id, {
    metadata: {
      ...project.metadata,
      onboardingState: 'in_progress',
      onboardingDialogue: dialogue,
      onboardingReview: review,
    },
  });
}

function assessProjectForOnboarding(db: DrizzleDb, id: string): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
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
  const assessmentResult = assessProjectOnboarding({
    projectId: project.id,
    projectName: project.name,
    projectRoot: backendProjectRoot,
    repositoryRoot,
    activeBranch,
    currentState: state,
    existingInstructionFiles: parseProjectInstructionFileReferences(project.metadata),
  });
  const approvedAtMs =
    assessmentResult.nextState === 'approved'
      ? assessmentResult.assessment.assessedAtMs
      : undefined;

  const updated = updateProject(db, id, {
    metadata: {
      ...project.metadata,
      onboardingState: assessmentResult.nextState,
      onboardingAssessment: assessmentResult.assessment,
      instructionFiles: assessmentResult.instructionFiles.map((file) =>
        approvedAtMs && file.scope === 'root' ? { ...file, approvedAtMs } : file,
      ),
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
  const refreshed = assessProjectForOnboarding(db, id);
  const nextAssessment = ProjectOnboardingAssessmentSchema.parse(
    refreshed.metadata['onboardingAssessment'],
  );
  const nextState = metadataOnboardingState(refreshed.metadata) ?? 'missing';
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
  const result = ProjectOnboardingRefreshResultSchema.parse({
    previousState,
    nextState,
    updateStatus,
    materialDrift,
    assessment,
    refreshedAtMs: assessment.assessedAtMs,
  });

  return updateProject(db, id, {
    metadata: {
      ...refreshed.metadata,
      onboardingAssessment: assessment,
      onboardingRefresh: result,
    },
  });
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
    const targetFile = join(backendProjectRoot, candidate.targetPath);
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

function requireProjectAssessment(project: ProjectRecord): ProjectOnboardingAssessment {
  const parsed = ProjectOnboardingAssessmentSchema.safeParse(
    project.metadata['onboardingAssessment'],
  );
  if (!parsed.success) {
    throw new HttpError(
      409,
      'PROJECT_ASSESSMENT_REQUIRED',
      'Project assessment is required before drafting instructions',
    );
  }
  return parsed.data;
}

export function startProjectOnboardingDraft(db: DrizzleDb, id: string): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const assessment = requireProjectAssessment(project);
  const existingDraft = parseStoredOnboardingDraft(project.metadata);
  const existingDialogue = parseStoredOnboardingDialogue(project.metadata);
  if (existingDraft && existingDialogue) return project;

  const nowMs = Date.now();
  const dialogue = existingDialogue ?? createInitialOnboardingDialogue(assessment, nowMs);
  const draft = buildOnboardingDraft({
    project,
    assessment,
    previousDraft: existingDraft,
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
