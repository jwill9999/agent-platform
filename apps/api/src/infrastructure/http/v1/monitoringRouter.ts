import {
  MonitoringPreferenceInputSchema,
  MonitoringPreferenceResultSchema,
  MonitoringReportSchema,
  MonitoringStatusSchema,
  MonitoringWindowInputSchema,
  projectMonitoringReport,
  type DiagnosticStore,
  type MonitoringStore,
} from '@agent-platform/contracts';
import { Router } from 'express';
import { z } from 'zod';
import type { MonitoringRuntime } from '../../diagnostics/monitoringRuntime.js';
import { asyncHandler } from '../asyncHandler.js';
import { HttpError } from '../httpError.js';

const emptyInput = z.object({}).strict();
const maximumReportBytes = 5 * 1024 * 1024;

/** Mounted only behind the existing local peer/Host/capability guard, never public settings. */
export function createMonitoringRouter(
  diagnostics: DiagnosticStore,
  monitoring: { store: MonitoringStore; runtime: MonitoringRuntime },
): Router {
  const router = Router();
  router.post('/status', (req, res) => {
    if (!emptyInput.safeParse(req.body).success) throw invalidInput();
    res.json(
      MonitoringStatusSchema.parse({
        monitoring: monitoring.store.health(),
        diagnostics: diagnostics.health(),
      }),
    );
  });
  router.post(
    '/preference',
    asyncHandler(async (req, res) => {
      const input = MonitoringPreferenceInputSchema.safeParse(req.body);
      if (!input.success) throw invalidInput();
      try {
        const preference = await monitoring.runtime.setPreference(input.data);
        res.json(
          MonitoringPreferenceResultSchema.parse({ preference, health: monitoring.store.health() }),
        );
      } catch {
        throw unavailable();
      }
    }),
  );
  router.post(
    '/window',
    asyncHandler(async (req, res) => {
      const parsed = MonitoringWindowInputSchema.safeParse(req.body);
      if (!parsed.success) throw invalidInput();
      try {
        const input = parsed.data;
        const body = await boundedWindow(async (assertActive) => {
          await Promise.all([diagnostics.flush(), monitoring.store.flush()]);
          assertActive();
          const [events, samples] = await Promise.all([
            diagnostics.queryWindow(
              { ...input.window, ...(input.sessionId ? { sessionId: input.sessionId } : {}) },
              {
                cursor: input.diagnosticCursor,
                limit: input.limit,
              },
            ),
            monitoring.store.queryWindow(input.window, {
              cursor: input.monitoringCursor,
              limit: input.limit,
            }),
          ]);
          assertActive();
          const result = projectMonitoringReport(
            MonitoringReportSchema.parse({
              schemaVersion: 1,
              generatedAtMs: Date.now(),
              diagnostics: events,
              monitoring: samples,
              coverage: {
                separateSnapshots: true,
                incomplete:
                  events.truncated ||
                  samples.truncated ||
                  events.coverage.historyMayBeMissing ||
                  samples.coverage.historyMayBeMissing,
              },
            }),
            input,
          );
          const body = JSON.stringify(result);
          if (Buffer.byteLength(body, 'utf8') > maximumReportBytes)
            throw new HttpError(
              413,
              'MONITORING_REPORT_TOO_LARGE',
              'Reduce the diagnostic window page size',
            );
          return body;
        });
        res.type('json').send(body);
      } catch (error) {
        throw monitoringReadError(error);
      }
    }),
  );
  return router;
}

function monitoringReadError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof Error && error.message === 'monitoring_report_limit')
    return new HttpError(
      413,
      'MONITORING_REPORT_TOO_LARGE',
      'Reduce the diagnostic window page size',
    );
  // Never return storage paths, SQL or raw exception text.
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 'invalid_cursor')
      return new HttpError(400, 'INVALID_CURSOR', 'Invalid diagnostic window cursor');
    if (error.code === 'expired_history')
      return new HttpError(410, 'HISTORY_EXPIRED', 'Diagnostic window history has expired');
  }
  return unavailable();
}

function invalidInput(): HttpError {
  return new HttpError(400, 'INVALID_MONITORING_QUERY', 'Invalid local monitoring query');
}
function unavailable(): HttpError {
  return new HttpError(
    503,
    'MONITORING_UNAVAILABLE',
    'Local monitoring is temporarily unavailable',
  );
}
async function boundedWindow<T>(read: (assertActive: () => void) => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const started = performance.now();
  let ended = false;
  const assertActive = () => {
    if (ended || performance.now() - started >= 200) throw unavailable();
  };
  try {
    const value = await Promise.race([
      read(assertActive),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(unavailable()), 200);
      }),
    ]);
    // Synchronous schema/prose/size projection also belongs to the total read budget.
    if (performance.now() - started >= 200) throw unavailable();
    return value;
  } finally {
    ended = true;
    if (timer) clearTimeout(timer);
  }
}
