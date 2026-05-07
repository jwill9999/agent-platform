import {
  ProjectCreateBodySchema,
  type ProjectOpenBody,
  ProjectOpenBodySchema,
  ProjectQuerySchema,
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
import { readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute } from 'node:path';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import {
  discoverProjectInstructions,
  parseProjectInstructionFileReferences,
} from '../../projects/projectInstructions.js';
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
  instructionFiles: ReturnType<typeof discoverProjectInstructions>['instructionFiles'];
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
    return {
      project: updateProject(db, existing.id, {
        name,
        slug: input.slug,
        workspaceKey: metadata.backendProjectRoot,
        metadata: { ...existing.metadata, ...metadata },
        archivedAtMs: null,
      }),
      created: false,
    };
  }

  return {
    project: createProject(db, {
      name,
      slug: input.slug,
      workspaceKey: metadata.backendProjectRoot,
      metadata,
    }),
    created: true,
  };
}

function approveProjectOnboarding(db: DrizzleDb, id: string): ProjectRecord {
  const project = findProject(db, id);
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found');
  const backendProjectRoot = project.metadata['backendProjectRoot'];
  if (typeof backendProjectRoot !== 'string') {
    throw new HttpError(409, 'PROJECT_UNAVAILABLE', 'Project root is not backend accessible');
  }
  const discovery = discoverProjectInstructions(
    backendProjectRoot,
    parseProjectInstructionFileReferences(project.metadata),
  );
  if (!discovery.instructionFiles.some((file) => file.scope === 'root')) {
    throw new HttpError(
      409,
      'PROJECT_INSTRUCTIONS_MISSING',
      'Root AGENTS.md is required before approval',
    );
  }
  const approvedAtMs = Date.now();
  return updateProject(db, id, {
    metadata: {
      ...project.metadata,
      onboardingState: 'approved',
      instructionFiles: discovery.instructionFiles.map((file) => ({ ...file, approvedAtMs })),
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
        res.json({ data: approveProjectOnboarding(db, requireParam(req.params, 'id')) });
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
