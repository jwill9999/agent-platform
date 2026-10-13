import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { listenLoopback, closeLoopback } from './support/loopbackServer.js';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiagnosticReportSchema } from '@agent-platform/contracts';
import { createDiagnosticStore } from '@agent-platform/db';
import { buildDiagnosticReport } from '@agent-platform/plugin-observability';
import express from 'express';
import request from 'supertest';
import { expect, it } from 'vitest';
import {
  beginDiagnosticRun,
  diagnosticIngress,
  observeDiagnosticTool,
} from '../src/infrastructure/diagnostics/observations.js';

it('persists real MCP namespace attribution while excluding server names and arguments from V1', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mcp-diagnostic-attribution-'));
  const store = createDiagnosticStore({ path: join(directory, 'diagnostics.sqlite') });
  const requestId = randomUUID();
  const serverId = randomUUID();
  const toolExecutionId = randomUUID();
  const privateToolName = 'private_customer_search';
  const argumentCanary = 'sk-fixture-secret-not-for-diagnostics';
  let server: Server | undefined;
  try {
    await store.ready;
    const app = express();
    app.use(express.json());
    app.use((_req, res, next) => {
      res.locals.requestId = requestId;
      next();
    });
    app.use(diagnosticIngress(store, { host: '127.0.0.1:3456', capability: 'a'.repeat(64) }));
    app.post('/v1/chat', (_req, res) => {
      const finishRun = beginDiagnosticRun(randomUUID(), randomUUID());
      // Same canonical ID and committed-audit observation used by real MCP dispatch.
      const finishTool = observeDiagnosticTool(
        toolExecutionId,
        `${serverId}:${privateToolName}`,
        'running',
      );
      finishTool('success', 1);
      finishRun();
      res.json({ ok: true });
    });
    server = await listenLoopback(app);
    await request(server)
      .post('/v1/chat')
      .send({ arguments: { text: argumentCanary } })
      .expect(200);
    await store.flush();
    const report = DiagnosticReportSchema.parse(
      buildDiagnosticReport(await store.query({ requestId })),
    );
    const events = report.events.map((row) => row.event).filter((event) => event.toolExecutionId);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.outcome)).toEqual(['started', 'succeeded']);
    expect(events.every((event) => event.toolId === 'mcp')).toBe(true);
    expect(events.every((event) => event.toolExecutionId === toolExecutionId)).toBe(true);
    const serialized = JSON.stringify(report);
    for (const privateValue of [serverId, privateToolName, argumentCanary])
      expect(serialized).not.toContain(privateValue);
  } finally {
    try {
      if (server) await closeLoopback(server);
    } finally {
      await store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }
});
