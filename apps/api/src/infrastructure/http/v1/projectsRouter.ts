import {
  ProjectCreateBodySchema,
  ProjectQuerySchema,
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

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
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
