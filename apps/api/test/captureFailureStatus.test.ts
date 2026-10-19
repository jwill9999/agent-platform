import express from 'express';
import request from 'supertest';
import { createDiagnosticStore, createMonitoringStore } from '@agent-platform/db';
import type { CaptureFailureArtifacts } from '@agent-platform/contracts';
import { expect, it, vi } from 'vitest';
import { createMonitoringRouter } from '../src/infrastructure/http/v1/monitoringRouter.js';
import { createMonitoringRuntime } from '../src/infrastructure/diagnostics/monitoringRuntime.js';
import { listenLoopback, closeLoopback } from './support/loopbackServer.js';

it.each(['throw', 'invalid'] as const)(
  'returns safe cached artifact unavailability when the independent status observer is %s, without capture RPC',
  async (kind) => {
    const diagnostics = createDiagnosticStore({ path: '' });
    const monitoring = createMonitoringStore({ path: '' });
    const runtime = createMonitoringRuntime({
      store: monitoring,
      appDataPath: '/unused-not-probed',
    });
    const query = vi.spyOn(diagnostics, 'queryWindow');
    const monitoringQuery = vi.spyOn(monitoring, 'queryWindow');
    const flush = vi.spyOn(diagnostics, 'flush');
    const app = express();
    app.use(express.json());
    app.use(
      createMonitoringRouter(diagnostics, {
        store: monitoring,
        runtime,
        failureArtifacts() {
          if (kind === 'throw') throw new Error('private-artifact-canary');
          return { private: 'private-artifact-canary' } as unknown as CaptureFailureArtifacts;
        },
      }),
    );
    const server = await listenLoopback(app);
    try {
      const response = await request(server).post('/status').send({}).expect(200);
      expect(response.body.failureArtifacts).toEqual({
        diagnostics: { previousFailureState: 'unavailable', publication: 'unavailable' },
        monitoring: { previousFailureState: 'unavailable', publication: 'unavailable' },
      });
      expect(response.body.diagnostics.state).toBe('disabled');
      expect(response.body.monitoring.state).toBe('disabled');
      expect(query).not.toHaveBeenCalled();
      expect(monitoringQuery).not.toHaveBeenCalled();
      expect(flush).not.toHaveBeenCalled();
      expect(JSON.stringify(response.body)).not.toContain('private-artifact-canary');
    } finally {
      await closeLoopback(server);
      await Promise.all([diagnostics.close(), monitoring.close()]);
      vi.restoreAllMocks();
    }
  },
);
