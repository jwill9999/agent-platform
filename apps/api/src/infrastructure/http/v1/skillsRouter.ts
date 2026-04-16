import { SkillCreateBodySchema, SkillSchema } from '@agent-platform/contracts';
import { createSkill, deleteSkill, getSkill, listSkills, upsertSkill } from '@agent-platform/db';
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
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const skill = getSkill(db, requireParam(req.params, 'idOrSlug'));
      if (!skill) throw new HttpError(404, 'NOT_FOUND', 'Skill not found');
      res.json({ data: skill });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(SkillCreateBodySchema, req.body);
      const skill = createSkill(db, body);
      res.status(201).json({ data: skill });
    }),
  );

  router.put(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const existing = getSkill(db, requireParam(req.params, 'idOrSlug'));
      if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Skill not found');
      const skill = parseBody(SkillSchema, { ...req.body, id: existing.id, slug: existing.slug });
      upsertSkill(db, skill);
      res.json({ data: skill });
    }),
  );

  router.delete(
    '/:idOrSlug',
    asyncHandler(async (req, res) => {
      const ok = deleteSkill(db, requireParam(req.params, 'idOrSlug'));
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Skill not found');
      res.status(204).send();
    }),
  );

  return router;
}
