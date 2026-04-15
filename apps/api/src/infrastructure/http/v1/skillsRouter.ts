import { SkillSchema } from '@agent-platform/contracts';
import { deleteSkill, getSkill, listSkills, upsertSkill } from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

export function createSkillsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: listSkills(db) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const skill = getSkill(db, requireParam(req.params, 'id'));
      if (!skill) throw new HttpError(404, 'NOT_FOUND', 'Skill not found');
      res.json({ data: skill });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const skill = parseBody(SkillSchema, req.body);
      upsertSkill(db, skill);
      res.status(201).json({ data: skill });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const skill = parseBody(SkillSchema, req.body);
      if (skill.id !== req.params.id) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Body id must match path');
      }
      upsertSkill(db, skill);
      res.json({ data: skill });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteSkill(db, requireParam(req.params, 'id'));
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Skill not found');
      res.status(204).send();
    }),
  );

  return router;
}
