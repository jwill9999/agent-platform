import {
  ModelConfigCreateBodySchema,
  ModelConfigUpdateBodySchema,
} from '@agent-platform/contracts';
import {
  listModelConfigs,
  getModelConfig,
  createModelConfig,
  updateModelConfig,
  deleteModelConfig,
  resolveModelConfigKey,
  parseMasterKeyFromBase64,
} from '@agent-platform/db';
import type { DrizzleDb } from '@agent-platform/db';
import { testModelConnection } from '@agent-platform/model-router';
import { Router } from 'express';

import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';
import { parseBody, requireParam } from './routerUtils.js';

// Current key version for newly encrypted secrets
const KEY_VERSION = 1;

function getMasterKey(): Buffer {
  const b64 = process.env['SECRETS_MASTER_KEY'];
  if (!b64)
    throw new HttpError(
      503,
      'CONFIGURATION_ERROR',
      'SECRETS_MASTER_KEY is not configured — set it in your environment to store API keys',
    );
  return parseMasterKeyFromBase64(b64);
}

export function createModelConfigsRouter(db: DrizzleDb): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: listModelConfigs(db) });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const cfg = getModelConfig(db, requireParam(req.params, 'id'));
      if (!cfg) throw new HttpError(404, 'NOT_FOUND', 'Model config not found');
      res.json({ data: cfg });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = parseBody(ModelConfigCreateBodySchema, req.body);
      const masterKey = body.apiKey ? getMasterKey() : undefined;
      const cfg = createModelConfig(db, body, masterKey, KEY_VERSION);
      res.status(201).json({ data: cfg });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      if (!getModelConfig(db, id)) throw new HttpError(404, 'NOT_FOUND', 'Model config not found');
      const body = parseBody(ModelConfigUpdateBodySchema, req.body);
      const masterKey = body.apiKey ? getMasterKey() : undefined;
      const updated = updateModelConfig(db, id, body, masterKey, KEY_VERSION);
      if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Model config not found');
      res.json({ data: updated });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const ok = deleteModelConfig(db, requireParam(req.params, 'id'));
      if (!ok) throw new HttpError(404, 'NOT_FOUND', 'Model config not found');
      res.status(204).send();
    }),
  );

  /** Test the stored model config by firing a minimal chat completion. */
  router.post(
    '/:id/test',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      const cfg = getModelConfig(db, id);
      if (!cfg) throw new HttpError(404, 'NOT_FOUND', 'Model config not found');

      let apiKey: string | undefined;
      if (cfg.hasApiKey) {
        const masterKey = getMasterKey();
        apiKey = resolveModelConfigKey(db, id, masterKey);
      }

      const result = await testModelConnection({
        provider: cfg.provider,
        model: cfg.model,
        apiKey,
      });
      res.json({ data: result });
    }),
  );

  return router;
}
