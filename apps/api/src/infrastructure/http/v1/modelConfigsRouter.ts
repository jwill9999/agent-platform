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
import { PROVIDER_CATALOGUE, testModelConnection } from '@agent-platform/model-router';
import { Router } from 'express';

import { beginDiagnosticProbe } from '../../diagnostics/observations.js';
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

  router.get('/providers', (_req, res) => {
    res.json({ data: PROVIDER_CATALOGUE });
  });

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
      const normalized = { ...body, model: body.model.trim() };
      const masterKey = normalized.apiKey ? getMasterKey() : undefined;
      const cfg = createModelConfig(db, normalized, masterKey, KEY_VERSION);
      res.status(201).json({ data: cfg });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = requireParam(req.params, 'id');
      if (!getModelConfig(db, id)) throw new HttpError(404, 'NOT_FOUND', 'Model config not found');
      const body = parseBody(ModelConfigUpdateBodySchema, req.body);
      const normalized = {
        ...body,
        ...(body.model !== undefined ? { model: body.model.trim() } : {}),
      };
      // masterKey is only needed for encryption (non-empty apiKey).
      // apiKey === '' triggers the clear-key path in updateModelConfig which deletes the
      // secret ref without using masterKey, so the truthy check is intentional and correct.
      const masterKey = normalized.apiKey ? getMasterKey() : undefined;
      const updated = updateModelConfig(db, id, normalized, masterKey, KEY_VERSION);
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

      const finish = beginDiagnosticProbe(id, cfg.provider);
      let credentialReady = !cfg.hasApiKey;
      try {
        let apiKey: string | undefined;
        if (cfg.hasApiKey) {
          apiKey = resolveModelConfigKey(db, id, getMasterKey());
          credentialReady = true;
        }
        const result = await testModelConnection({
          provider: cfg.provider,
          model: cfg.model,
          apiKey,
          baseURL: cfg.baseURL ?? undefined,
        });
        finish(result);
        res.json({ data: result });
      } catch {
        const category = credentialReady ? 'unknown' : 'authentication';
        finish({ ok: false, category });
        throw new HttpError(
          503,
          'MODEL_CONNECTION_UNAVAILABLE',
          credentialReady
            ? 'Model connection could not be tested'
            : 'Stored model credential is unavailable',
        );
      }
    }),
  );

  return router;
}
