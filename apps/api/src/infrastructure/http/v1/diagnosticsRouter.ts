import {
  DiagnosticScopeSchema,
  DiagnosticReportSchema,
  type DiagnosticStore,
} from '@agent-platform/contracts';
import { getSession, DiagnosticStoreError, type DrizzleDb } from '@agent-platform/db';
import { buildDiagnosticReport } from '@agent-platform/plugin-observability';
import { Router } from 'express';
import { z } from 'zod';
import { hasDiagnosticAccess, type DiagnosticAccess } from '../../diagnostics/localAccess.js';
import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';

const reportInput = z
  .object({ scope: DiagnosticScopeSchema, cursor: z.string().max(2048).optional() })
  .strict();
const listInput = z.object({ limit: z.number().int().min(1).max(100).optional() }).strict();

export function createDiagnosticsRouter(
  db: DrizzleDb,
  store: DiagnosticStore,
  access: DiagnosticAccess,
  configuredAppVersion = '0.0.0',
): Router {
  const router = Router();
  const version = DiagnosticReportSchema.shape.appVersion.safeParse(configuredAppVersion);
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!hasDiagnosticAccess(req, access)) {
      res.status(403).json({
        error: { code: 'DIAGNOSTICS_DENIED', message: 'Local diagnostics access denied' },
      });
      return;
    }
    next();
  });
  router.post(
    '/report',
    asyncHandler(async (req, res) => {
      const parsed = reportInput.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'INVALID_SCOPE', 'Invalid diagnostic scope');
      const { scope, cursor } = parsed.data;
      if ('sessionId' in scope && !getSession(db, scope.sessionId)) {
        throw new HttpError(404, 'NOT_FOUND', 'Diagnostic scope not found');
      }
      try {
        await flushForRead(store);
        const page = await store.query(scope, { cursor, limit: 1000 });
        if (!page.events.length && !cursor)
          throw new HttpError(404, 'NOT_FOUND', 'Diagnostic scope not found');
        const report = buildDiagnosticReport(page, {
          appVersion: version.success ? version.data : undefined,
          platform: diagnosticPlatform(),
        });
        if (page.nextCursor) res.setHeader('x-diagnostics-next-cursor', page.nextCursor);
        res.json(report);
      } catch (error) {
        throw diagnosticReadError(error);
      }
    }),
  );
  router.post(
    '/list',
    asyncHandler(async (req, res) => {
      const parsed = listInput.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'INVALID_SCOPE', 'Invalid diagnostic query');
      const input = parsed.data;
      try {
        await flushForRead(store);
        res.json({ events: await store.listRecent(input), health: store.health() });
      } catch {
        throw new HttpError(
          503,
          'DIAGNOSTICS_UNAVAILABLE',
          'Diagnostic history is temporarily unavailable',
        );
      }
    }),
  );
  return router;
}

async function flushForRead(store: DiagnosticStore): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      store.flush(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new HttpError(
                503,
                'DIAGNOSTICS_UNAVAILABLE',
                'Diagnostic history is temporarily unavailable',
              ),
            ),
          200,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function diagnosticPlatform(): 'darwin' | 'linux' | 'win32' | 'unknown' {
  if (process.platform === 'darwin' || process.platform === 'linux' || process.platform === 'win32')
    return process.platform;
  return 'unknown';
}

function diagnosticReadError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof DiagnosticStoreError && error.code === 'invalid_cursor')
    return new HttpError(400, 'INVALID_CURSOR', 'Invalid diagnostic cursor');
  if (error instanceof DiagnosticStoreError && error.code === 'expired_history')
    return new HttpError(410, 'HISTORY_EXPIRED', 'Diagnostic history has expired', {
      earliestSequence: error.earliestSequence,
    });
  // Storage error strings can contain paths or SQL, and are never returned or logged.
  return new HttpError(
    503,
    'DIAGNOSTICS_UNAVAILABLE',
    'Diagnostic history is temporarily unavailable',
  );
}
