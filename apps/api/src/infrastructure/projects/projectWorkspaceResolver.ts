import { realpathSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';

import { findProject, getSession, type DrizzleDb } from '@agent-platform/db';
import type { Mount } from '@agent-platform/harness';

type WorkspaceResolutionErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'NO_PROJECT_BOUND'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_UNAVAILABLE';

export type ProjectWorkspaceResolution =
  | {
      ok: true;
      workspaceRoot: string;
      repositoryRoot: string;
      defaultRepoPath: string;
      mounts: Mount[];
    }
  | {
      ok: false;
      code: WorkspaceResolutionErrorCode;
      message: string;
    };

function metadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function resolveSessionWorkspace(
  db: DrizzleDb,
  sessionId: string,
): ProjectWorkspaceResolution {
  const session = getSession(db, sessionId);
  if (!session) {
    return {
      ok: false,
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found.',
    };
  }
  if (!session.projectId) {
    return {
      ok: false,
      code: 'NO_PROJECT_BOUND',
      message: 'No Project is bound to this session.',
    };
  }

  const project = findProject(db, session.projectId);
  if (!project) {
    return {
      ok: false,
      code: 'PROJECT_NOT_FOUND',
      message: 'The bound Project no longer exists.',
    };
  }

  const capabilityState = metadataString(project.metadata, 'capabilityState');
  const backendProjectRoot = metadataString(project.metadata, 'backendProjectRoot');
  const metadataRepositoryRoot = metadataString(project.metadata, 'repositoryRoot');
  if (capabilityState !== 'backend_accessible' || !backendProjectRoot) {
    return {
      ok: false,
      code: 'PROJECT_UNAVAILABLE',
      message: 'The bound Project is not available to the backend.',
    };
  }

  let workspaceRoot: string;
  try {
    workspaceRoot = realpathSync(backendProjectRoot);
  } catch {
    return {
      ok: false,
      code: 'PROJECT_UNAVAILABLE',
      message: 'The bound Project root cannot be inspected by the backend.',
    };
  }

  let repositoryRoot = workspaceRoot;
  if (metadataRepositoryRoot) {
    try {
      const candidate = realpathSync(metadataRepositoryRoot);
      if (isWithin(workspaceRoot, candidate)) {
        repositoryRoot = candidate;
      }
    } catch {
      repositoryRoot = workspaceRoot;
    }
  }

  return {
    ok: true,
    workspaceRoot,
    repositoryRoot,
    defaultRepoPath: repositoryRoot,
    mounts: [
      {
        label: 'workspace',
        hostPath: workspaceRoot,
        containerPath: '/workspace',
        permission: 'read_write',
      },
    ],
  };
}
