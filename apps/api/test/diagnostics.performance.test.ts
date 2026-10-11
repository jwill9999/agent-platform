import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { join } from 'node:path';
import type { DiagnosticStore } from '@agent-platform/contracts';
import {
  closeDatabase,
  createDiagnosticStore,
  DEFAULT_AGENT_ID,
  openDatabase,
  runSeed,
  updateSettings,
} from '@agent-platform/db';
import { createRequire } from 'node:module';
import { monitorEventLoopDelay } from 'node:perf_hooks';
const Database = createRequire(new URL('../../../packages/db/package.json', import.meta.url))(
  'better-sqlite3',
) as new (path: string) => ReturnType<typeof openDatabase>['sqlite'];
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from '../src/infrastructure/http/createApp.js';

const percentile95 = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] ?? 0;

it('measures 100 real requests per mode and preserves outcomes while the diagnostic writer is locked', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'diagnostic-performance-'));
  const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubEnv('AGENT_OPENAI_API_KEY', 'local-benchmark-double');
  vi.stubEnv('LANGCHAIN_TRACING_V2', 'false');
  vi.stubEnv('LANGSMITH_TRACING', 'false');
  vi.stubEnv('LANGSMITH_TRACING_V2', 'false');
  const modes = ['disabled', 'healthy', 'locked'] as const;
  const cleanups: Array<() => Promise<void>> = [];
  const samples: Record<
    string,
    {
      requestP95Ms: number;
      enqueueP95Ms: number;
      providerCalls: number;
      maxPending: number;
      dropped: number;
      retainedEvents: number;
      enqueueSamples: number;
      eventLoopP95Ms: number;
      eventLoopSamples: number;
    }
  > = {};
  try {
    for (let repetition = 1; repetition <= 3; repetition++) {
      for (const mode of modes) {
        const key = `${repetition}-${mode}`;
        const { db, sqlite } = openDatabase(join(directory, `${key}-app.sqlite`));
        runSeed(db);
        // Fixture-only setting: same existing limiter in all modes, enough for warm-up +100 requests.
        updateSettings(db, { rateLimits: { max: 1000, windowMs: 60000 } });
        const store: DiagnosticStore | undefined =
          mode === 'disabled'
            ? undefined
            : createDiagnosticStore({ path: join(directory, `${key}-diagnostics.sqlite`) });
        await store?.ready;
        if (store) expect(store.health().state).toBe('ready');
        let lock: ReturnType<typeof openDatabase>['sqlite'] | undefined;
        cleanups.push(async () => {
          if (lock?.open) {
            lock.exec('ROLLBACK');
            lock.close();
          }
          await store?.close();
          closeDatabase(sqlite);
        });
        if (mode === 'locked') {
          lock = new Database(join(directory, `${key}-diagnostics.sqlite`));
          lock.exec('BEGIN IMMEDIATE');
        }
        const enqueue: number[] = [];
        let maxPending = 0;
        if (store) {
          const record = store.record.bind(store);
          store.record = (input) => {
            const start = performance.now();
            const result = record(input);
            enqueue.push(performance.now() - start);
            maxPending = Math.max(maxPending, store.health().pending);
            return result;
          };
        }
        let providerCalls = 0;
        const app = createApp({
          db,
          ...(store
            ? {
                diagnostics: {
                  store,
                  access: { capability: 'a'.repeat(64), host: '127.0.0.1:3000' },
                },
              }
            : {}),
          v1: {
            chat: {
              emitFinalAssistantMessage: true,
              disableEvaluatorNodes: true,
              llmReasonNode: async () => {
                providerCalls++;
                return {
                  llmOutput: { kind: 'text' as const, content: 'benchmark result' },
                  messages: [{ role: 'assistant' as const, content: 'benchmark result' }],
                  trace: [{ type: 'llm_call' as const, step: 0 }],
                };
              },
            },
          },
        });
        const server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');
        cleanups.push(async () => {
          server.closeAllConnections();
          await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          );
        });
        const client = request(server);
        const durations: number[] = [];
        const eventLoop = monitorEventLoopDelay({ resolution: 10 });
        eventLoop.enable();
        cleanups.push(async () => {
          eventLoop.disable();
        });
        for (let index = 0; index < 110; index++) {
          // A fresh session keeps the measured workload identical instead of growing history.
          const session = await client
            .post('/v1/sessions')
            .send({ agentId: DEFAULT_AGENT_ID })
            .timeout({ response: 5000, deadline: 10000 })
            .expect(201);
          const started = performance.now();
          const result = await client
            .post('/v1/chat')
            .send({ sessionId: session.body.data.id, message: 'benchmark input' })
            .timeout({ response: 5000, deadline: 10000 })
            .expect(200);
          const elapsed = performance.now() - started;
          expect(result.text).toContain('benchmark result');
          if (index >= 10) durations.push(elapsed);
        }
        eventLoop.disable();
        expect(Number(eventLoop.count)).toBeGreaterThan(0);
        expect(providerCalls).toBe(110);
        let retainedEvents = 0;
        if (store) {
          expect(enqueue.length).toBeGreaterThanOrEqual(110 * 4);
          if (mode === 'healthy') {
            await store.flush();
            expect(store.health()).toMatchObject({ state: 'ready', pending: 0, dropped: 0 });
            const inspect = new Database(join(directory, `${key}-diagnostics.sqlite`));
            try {
              retainedEvents = (
                inspect.prepare('SELECT count(*) AS n FROM diagnostic_events').get() as {
                  n: number;
                }
              ).n;
            } finally {
              inspect.close();
            }
            expect(retainedEvents).toBe(enqueue.length);
            expect(store.health().acknowledgedSequence).toBeGreaterThanOrEqual(retainedEvents);
          } else {
            expect(store.health().state).toBe('degraded');
            expect(store.health().dropped).toBeGreaterThan(0);
          }
        }
        expect(maxPending).toBeLessThanOrEqual(256);
        const enqueueP95Ms = percentile95(enqueue);
        expect(enqueueP95Ms).toBeLessThan(2);
        samples[key] = {
          retainedEvents,
          enqueueSamples: enqueue.length,
          eventLoopP95Ms: eventLoop.percentile(95) / 1e6,
          eventLoopSamples: Number(eventLoop.count),
          requestP95Ms: percentile95(durations),
          enqueueP95Ms,
          providerCalls,
          maxPending,
          dropped: store?.health().dropped ?? 0,
        };
        if (process.env.DIAGNOSTICS_BENCHMARK_RESULT)
          writeFileSync(
            process.env.DIAGNOSTICS_BENCHMARK_RESULT + '.progress',
            JSON.stringify(samples, null, 2),
          );
        // Release each mode's actual DB/worker before the next measurement.
        for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
      }
      const baseline = samples[`${repetition}-disabled`]!.requestP95Ms;
      for (const mode of ['healthy', 'locked'])
        expect(samples[`${repetition}-${mode}`]!.requestP95Ms - baseline).toBeLessThanOrEqual(20);
    }
    // Optional local evidence path is test-only; report contains numerical measurements, no request data.
    if (process.env.DIAGNOSTICS_BENCHMARK_RESULT)
      writeFileSync(
        process.env.DIAGNOSTICS_BENCHMARK_RESULT,
        JSON.stringify(
          {
            samples,
            repetitions: 3,
            requestsPerMode: 100,
            warmupPerMode: 10,
            provider: 'deterministic fixture',
            logSink: 'captured console',
          },
          null,
          2,
        ),
      );
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup();
    logs.mockRestore();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  }
}, 90000);
