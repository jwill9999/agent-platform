import {
  ProjectOnboardingAssessmentSchema,
  type ProjectOnboardingAssessment,
  type ProjectRecord,
} from '@agent-platform/contracts';
import { findProject, updateProject, type DrizzleDb } from '@agent-platform/db';

import { HttpError } from '../http/httpError.js';
import {
  buildOnboardingDraft,
  createInitialOnboardingDialogue,
  parseStoredOnboardingDialogue,
  parseStoredOnboardingDraft,
} from './projectOnboardingDraft.js';

export function requireProjectAssessment(project: ProjectRecord): ProjectOnboardingAssessment {
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
