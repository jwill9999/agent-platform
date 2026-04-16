import { PlatformSettingsUpdateSchema } from '@agent-platform/contracts';
import type { RateLimitSettings } from '@agent-platform/contracts';
import { loadSettings, resetSettings, updateSettings } from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { parseBody } from './routerUtils.js';

export function createSettingsRouter(
  db: DrizzleDb,
  onRateLimitChange: (config: RateLimitSettings) => void,
): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: loadSettings(db) });
    }),
  );

  router.put(
    '/',
    asyncHandler(async (req, res) => {
      const update = parseBody(PlatformSettingsUpdateSchema, req.body);
      const updated = updateSettings(db, update);
      if (update.rateLimits) {
        onRateLimitChange(updated.rateLimits);
      }
      res.json({ data: updated });
    }),
  );

  router.delete(
    '/',
    asyncHandler(async (_req, res) => {
      const defaults = resetSettings(db);
      onRateLimitChange(defaults.rateLimits);
      res.json({ data: defaults });
    }),
  );

  return router;
}
