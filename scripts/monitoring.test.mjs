import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { runDiagnostics } from './diagnostics.mjs';

const capability = 'b'.repeat(64);
const processInstanceId = randomUUID();
const preference = { samplingEnabled: true, retentionDays: 7, version: 2 };
const diagnosticHealth = {
  state: 'ready',
  reason: 'none',
  pending: 0,
  dropped: 0,
  conflicts: 0,
  pruned: 0,
  acknowledgedSequence: 1,
  lastAcknowledgedAtMs: 2000,
  processInstanceId,
  previousShutdownUnclean: false,
};
const monitoringHealth = { ...diagnosticHealth, preference };
const window = { fromMs: 1000, toMs: 4000 };
const coverage = {
  oldestObservedAtMs: 2000,
  newestObservedAtMs: 2000,
  historyMayBeMissing: false,
  gaps: 0,
};
const sample = {
  schemaVersion: 1,
  sampleId: randomUUID(),
  processInstanceId,
  observedAtMs: 2000,
  intervalMs: 30000,
  source: 'api_process_app_volume',
  cpuUserMicros: 10000,
  cpuSystemMicros: 5000,
  rssBytes: 1024,
  eventLoopP95Ms: 4,
  eventLoopMaxMs: 6,
  activeRuns: 1,
  admittedUnresolvedAttempts: 2,
  sessionLockKeys: 1,
  sessionLockWaiters: 3,
  appVolumeFreeBytes: 1024,
  unavailableMetrics: [],
};
const event = {
  schemaVersion: 1,
  eventId: randomUUID(),
  processInstanceId,
  requestId: randomUUID(),
  phase: 'request',
  outcome: 'failed',
  observedAtMs: 2000,
  durationMs: 40,
  errorCode: 'provider_error',
};
const report = {
  schemaVersion: 1,
  generatedAtMs: 4000,
  monitoring: {
    window,
    samples: [{ sequence: 1, sample }],
    snapshotSequence: 1,
    earliestSequence: 1,
    completedCursor: 'sample-completed-cursor',
    truncated: false,
    health: monitoringHealth,
    coverage,
  },
  diagnostics: {
    window,
    events: [{ sequence: 1, event }],
    snapshotSequence: 1,
    earliestSequence: 1,
    completedCursor: 'event-completed-cursor',
    truncated: false,
    health: diagnosticHealth,
    coverage,
  },
  coverage: { separateSnapshots: true, incomplete: false },
  summary: 'UNTRUSTED_SERVER_SUMMARY',
};
const windowArgs = ['window', '--from', '1970-01-01T00:00:01Z', '--to', '1970-01-01T00:00:04Z'];

async function invoke(args, env) {
  let stdout = '';
  let stderr = '';
  const code = await runDiagnostics(
    args,
    env,
    { write: (text) => (stdout += text) },
    { write: (text) => (stderr += text) },
  );
  return { code, stdout, stderr };
}

async function withServer(handler, callback) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await callback({
      DIAGNOSTICS_API_URL: `http://127.0.0.1:${server.address().port}`,
      DIAGNOSTICS_LOCAL_CAPABILITY: capability,
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('monitoring commands use the private transport and regenerate readable history', async () => {
  const received = [];
  await withServer(
    async (req, res) => {
      assert.equal(req.method, 'POST');
      assert.equal(req.headers['x-diagnostics-capability'], capability);
      let text = '';
      for await (const chunk of req) text += chunk;
      received.push({ path: req.url, body: JSON.parse(text) });
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify(
          req.url.endsWith('/status')
            ? { monitoring: monitoringHealth, diagnostics: diagnosticHealth }
            : req.url.endsWith('/preference')
              ? { preference, health: monitoringHealth }
              : report,
        ),
      );
    },
    async (env) => {
      const status = await invoke(['monitoring-status'], env);
      assert.equal(status.code, 0);
      assert.match(status.stdout, /recording: enabled; store ready/);
      assert.match(
        status.stdout,
        /Sample health: none; dropped 0; pending 0; pruned 0; conflicts 0/,
      );
      assert.match(status.stdout, /previous shutdown unclean false/);
      const saved = await invoke(
        ['monitoring-set', '--enabled', 'true', '--retention-days', '7'],
        env,
      );
      assert.equal(saved.code, 0);
      assert.match(saved.stdout, /Existing request and tool diagnostics are unchanged/);
      const history = await invoke(windowArgs, env);
      assert.equal(history.code, 0);
      assert.match(history.stdout, /Independent snapshots/);
      assert.match(history.stdout, /owned runs\/unresolved 1\/2; lock keys\/waiters 1\/3/);
      assert.match(history.stdout, /request: failed/);
      assert.doesNotMatch(history.stdout, /UNTRUSTED/);
      assert.deepEqual(received, [
        { path: '/v1/diagnostics/monitoring/status', body: {} },
        {
          path: '/v1/diagnostics/monitoring/preference',
          body: { samplingEnabled: true, retentionDays: 7 },
        },
        { path: '/v1/diagnostics/monitoring/window', body: { window } },
      ]);
      assert.doesNotMatch(JSON.stringify([status, saved, history]), new RegExp(capability));
    },
  );
});

test('unloaded recording preference is unknown, not disabled or durably configured', async () => {
  await withServer(
    (_req, res) =>
      res.end(
        JSON.stringify({
          monitoring: {
            ...monitoringHealth,
            preference: null,
            state: 'disabled',
            reason: 'storage_unavailable',
          },
          diagnostics: diagnosticHealth,
        }),
      ),
    async (env) => {
      const result = await invoke(['monitoring-status'], env);
      assert.equal(result.code, 0);
      assert.match(result.stdout, /recording: unknown/);
      assert.match(result.stdout, /Retention preference: unavailable/);
      assert.match(result.stdout, /Sample health: storage_unavailable/);
    },
  );
});

test('invalid UTC windows, ambiguous flags and credential arguments never connect', async () => {
  let requests = 0;
  await withServer(
    (_req, res) => {
      requests++;
      res.end('{}');
    },
    async (env) => {
      const invalid = [
        ['monitoring-status', '--enabled', 'true'],
        ['monitoring-set', '--enabled', 'true'],
        ['monitoring-set', '--enabled', 'yes', '--retention-days', '7'],
        ['monitoring-set', '--enabled', 'true', '--retention-days', '91'],
        ['monitoring-set', '--enabled', 'false', '--retention-days', '0'],
        ['monitoring-status', '--json', '--json'],
        [...windowArgs, '--capability', capability],
        [...windowArgs, '--limit', '1001'],
        [...windowArgs, '--session', 'INVALID_SECRET'],
        ['window', '--from', '2026-02-30T00:00:00Z', '--to', '2026-03-03T00:00:00Z'],
        ['window', '--from', '2026-01-01T00:00:00+01:00', '--to', '2026-01-02T00:00:00Z'],
        ['window', '--from', '2026-01-02T00:00:00Z', '--to', '2026-01-01T00:00:00Z'],
      ];
      for (const args of invalid) {
        const result = await invoke(args, env);
        assert.equal(result.code, 1);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /Usage:/);
        assert.doesNotMatch(result.stderr, /INVALID_SECRET|bbbbbbbb/);
      }
      assert.equal(requests, 0);
    },
  );
});

test('wrong-window/session and unsafe history responses fail closed', async () => {
  for (const body of [
    { ...report, monitoring: { ...report.monitoring, window: { fromMs: 0, toMs: 4000 } } },
    {
      ...report,
      diagnostics: { ...report.diagnostics, window: { ...window, sessionId: randomUUID() } },
    },
    {
      ...report,
      monitoring: {
        ...report.monitoring,
        samples: [{ sequence: 1, sample: { ...sample, path: 'PRIVATE_PATH' } }],
      },
    },
    { ...report, rawError: 'PRIVATE_ERROR' },
  ]) {
    await withServer(
      (_req, res) => res.end(JSON.stringify(body)),
      async (env) => {
        const result = await invoke([...windowArgs, '--json'], env);
        assert.equal(result.code, 1);
        assert.equal(result.stdout, '');
        assert.doesNotMatch(result.stderr, /PRIVATE/);
      },
    );
  }
});

test('preference response must acknowledge both requested values and durable health version', async () => {
  for (const result of [
    { preference: { ...preference, retentionDays: 8 }, health: monitoringHealth },
    { preference, health: { ...monitoringHealth, preference: null } },
    { preference, health: { ...monitoringHealth, preference: { ...preference, version: 1 } } },
  ]) {
    await withServer(
      (_req, res) => res.end(JSON.stringify(result)),
      async (env) => {
        const actual = await invoke(
          ['monitoring-set', '--enabled', 'true', '--retention-days', '7'],
          env,
        );
        assert.equal(actual.code, 1);
        assert.equal(actual.stdout, '');
      },
    );
  }
});

test('independent next/completed cursors are transported without walking or losing coverage', async () => {
  const partial = {
    ...report,
    monitoring: {
      ...report.monitoring,
      completedCursor: undefined,
      nextCursor: 'sample-next-cursor',
      truncated: true,
    },
    coverage: { separateSnapshots: true, incomplete: false },
  };
  let requests = 0;
  await withServer(
    async (req, res) => {
      requests++;
      let text = '';
      for await (const chunk of req) text += chunk;
      assert.deepEqual(JSON.parse(text), {
        window,
        monitoringCursor: 'sample-next-cursor',
        diagnosticCursor: 'event-completed-cursor',
        limit: 1,
      });
      res.end(JSON.stringify(partial));
    },
    async (env) => {
      const result = await invoke(
        [
          ...windowArgs,
          '--monitoring-cursor',
          'sample-next-cursor',
          '--diagnostic-cursor',
          'event-completed-cursor',
          '--limit',
          '1',
          '--json',
        ],
        env,
      );
      assert.equal(result.code, 0);
      const output = JSON.parse(result.stdout);
      assert.equal(output.monitoring.nextCursor, 'sample-next-cursor');
      assert.equal(output.diagnostics.completedCursor, 'event-completed-cursor');
      assert.equal(output.coverage.incomplete, true);
      assert.doesNotMatch(output.summary, /UNTRUSTED/);
      assert.equal(requests, 1);
    },
  );
});
