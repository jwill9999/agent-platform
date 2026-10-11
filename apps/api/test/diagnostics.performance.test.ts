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
  const originalLog = console.log;
  let logCalls = 0;
  // Keep production serialization, without retaining every log argument in a mock.
  console.log = () => {
    logCalls++;
  };
  vi.stubEnv('AGENT_OPENAI_API_KEY', 'local-benchmark-double');
  vi.stubEnv('LANGCHAIN_TRACING_V2', 'false');
  vi.stubEnv('LANGSMITH_TRACING', 'false');
  vi.stubEnv('LANGSMITH_TRACING_V2', 'false');
  const modeOrders = [
    ['disabled', 'healthy', 'locked'],
    ['healthy', 'locked', 'disabled'],
    ['locked', 'disabled', 'healthy'],
  ] as const;
  const cleanups: Array<() => Promise<void>> = [];
  const samples: Record<
    string,
    {
      status: 'measuring' | 'verifying' | 'passed';
      requestDurationsMs: number[];
      enqueueDurationsMs: number[];
      logCalls: number;
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
  let captureActiveSample: (() => void) | undefined;
  let completed = false;
  const publishMeasurements = () => {
    captureActiveSample?.();
    const evidence = {
      completed,
      samples,
      repetitions: 3,
      modeOrders,
      requestsPerMode: 100,
      warmupPerMode: 10,
      requestOverheadLimitMs: 20,
      enqueueLimitMs: 2,
      provider: 'deterministic fixture',
      logSink: 'non-retaining no-op; production serialization still runs',
    };
    const json = JSON.stringify(evidence, null, 2);
    // Always retain numerical evidence, including partial measurements on assertion failure.
    originalLog(
      '[diagnostics performance measurements]',
      JSON.stringify({
        ...evidence,
        samples: Object.fromEntries(
          Object.entries(samples).map(([key, sample]) => {
            const { requestDurationsMs, enqueueDurationsMs, ...summary } = sample;
            return [
              key,
              {
                ...summary,
                measuredRequests: requestDurationsMs.length,
                recordedEnqueues: enqueueDurationsMs.length,
              },
            ];
          }),
        ),
      }),
    );
    if (process.env.DIAGNOSTICS_BENCHMARK_RESULT)
      writeFileSync(process.env.DIAGNOSTICS_BENCHMARK_RESULT, json);
  };
  try {
    for (let repetition = 1; repetition <= 3; repetition++) {
      for (const mode of modeOrders[repetition - 1]!) {
        const key = `${repetition}-${mode}`;
        const sample = (samples[key] = {
          status: 'measuring' as 'measuring' | 'verifying' | 'passed',
          requestDurationsMs: [] as number[],
          enqueueDurationsMs: [] as number[],
          logCalls: 0,
          requestP95Ms: 0,
          enqueueP95Ms: 0,
          providerCalls: 0,
          maxPending: 0,
          dropped: 0,
          retainedEvents: 0,
          enqueueSamples: 0,
          eventLoopP95Ms: 0,
          eventLoopSamples: 0,
        });
        const initialLogCalls = logCalls;
        captureActiveSample = () => {
          sample.logCalls = logCalls - initialLogCalls;
        };
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
        const enqueue = sample.enqueueDurationsMs;
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
                sample.providerCalls = providerCalls;
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
        const durations = sample.requestDurationsMs;
        const eventLoop = monitorEventLoopDelay({ resolution: 10 });
        eventLoop.enable();
        captureActiveSample = () => {
          sample.requestP95Ms = percentile95(durations);
          sample.enqueueP95Ms = percentile95(enqueue);
          sample.enqueueSamples = enqueue.length;
          sample.maxPending = maxPending;
          sample.dropped = store?.health().dropped ?? 0;
          sample.eventLoopP95Ms = eventLoop.percentile(95) / 1e6;
          sample.eventLoopSamples = Number(eventLoop.count);
          sample.logCalls = logCalls - initialLogCalls;
        };
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
        sample.status = 'verifying';
        publishMeasurements();
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
            sample.retainedEvents = retainedEvents;
            expect(retainedEvents).toBe(enqueue.length);
            expect(store.health().acknowledgedSequence).toBeGreaterThanOrEqual(retainedEvents);
          } else {
            expect(store.health().state).toBe('degraded');
            expect(store.health().dropped).toBeGreaterThan(0);
          }
        }
        expect(maxPending).toBeLessThanOrEqual(256);
        const enqueueP95Ms = percentile95(enqueue);
        expect(enqueueP95Ms, `${key}: enqueue p95 ${enqueueP95Ms} ms`).toBeLessThan(2);
        sample.status = 'passed';
        publishMeasurements();
        captureActiveSample = undefined;
        // Release each mode's actual DB/worker before the next measurement.
        for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
      }
      const baseline = samples[`${repetition}-disabled`]!.requestP95Ms;
      for (const mode of ['healthy', 'locked']) {
        const actual = samples[`${repetition}-${mode}`]!.requestP95Ms;
        expect(
          actual - baseline,
          `repetition ${repetition} ${mode}: p95 ${actual} ms - disabled ${baseline} ms`,
        ).toBeLessThanOrEqual(20);
      }
    }
    completed = true;
  } finally {
    try {
      publishMeasurements();
    } finally {
      console.log = originalLog;
      try {
        for (const cleanup of cleanups.reverse()) await cleanup();
      } finally {
        vi.unstubAllEnvs();
        rmSync(directory, { recursive: true, force: true });
      }
    }
  }
}, 90000);
