import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import { buildDiagnosticReport } from '../packages/contracts/dist/index.js';
import { runDiagnostics } from './diagnostics.mjs';

const capability = 'a'.repeat(64);
const requestId = randomUUID();
const processInstanceId = randomUUID();
const event = {
  schemaVersion: 1,
  eventId: randomUUID(),
  processInstanceId,
  requestId,
  phase: 'request',
  outcome: 'failed',
  observedAtMs: 100,
  durationMs: 20,
  errorCode: 'provider_error',
};
const health = {
  state: 'ready',
  reason: 'none',
  pending: 0,
  dropped: 0,
  conflicts: 0,
  pruned: 0,
  acknowledgedSequence: 1,
  lastAcknowledgedAtMs: 100,
  processInstanceId,
  previousShutdownUnclean: false,
};
const page = {
  scope: { requestId },
  events: [{ sequence: 1, event }],
  snapshotSequence: 1,
  earliestSequence: 1,
  truncated: false,
  health,
};

async function serverFixture(handler, callback) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const env = {
    DIAGNOSTICS_API_URL: `http://127.0.0.1:${server.address().port}`,
    DIAGNOSTICS_LOCAL_CAPABILITY: capability,
  };
  try {
    await callback(env);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
async function invoke(args, env) {
  let stdout = '';
  let stderr = '';
  const code = await runDiagnostics(
    args,
    env,
    {
      write: (text) => {
        stdout += text;
      },
    },
    {
      write: (text) => {
        stderr += text;
      },
    },
  );
  return { code, stdout, stderr };
}

test('real local API list/report requests use private capability and safe projections', async () => {
  const received = [];
  await serverFixture(
    async (req, res) => {
      assert.equal(req.headers['x-diagnostics-capability'], capability);
      let body = '';
      for await (const chunk of req) body += chunk;
      received.push([req.url, JSON.parse(body)]);
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify(
          req.url.endsWith('/list')
            ? { events: page.events, health }
            : { ...buildDiagnosticReport(page), summary: 'UNTRUSTED_PROMPT_CANARY' },
        ),
      );
    },
    async (env) => {
      const list = await invoke(['list'], env);
      assert.equal(list.code, 0);
      assert.match(list.stdout, /request: failed/);
      const report = await invoke(['report', '--request', requestId], env);
      assert.equal(report.code, 0);
      assert.match(report.stdout, /20\.0 ms/);
      assert.doesNotMatch(report.stdout, /CANARY/);
      const json = await invoke(['report', '--request', requestId, '--json'], env);
      assert.equal(JSON.parse(json.stdout).scope.requestId, requestId);
      assert.equal(received.length, 3);
      assert.deepEqual(received[1], ['/v1/diagnostics/report', { scope: { requestId } }]);
      assert.doesNotMatch(JSON.stringify([list, report, json]), new RegExp(capability));
    },
  );
});

test('redirect cannot forward capability to another local server', async () => {
  let leaks = 0;
  await serverFixture(
    (_req, res) => {
      leaks++;
      res.end('{}');
    },
    async (destination) => {
      await serverFixture(
        (_req, res) => {
          res.writeHead(302, { location: destination.DIAGNOSTICS_API_URL });
          res.end();
        },
        async (env) => {
          const result = await invoke(['list'], env);
          assert.equal(result.code, 1);
          assert.equal(leaks, 0);
          assert.equal(result.stdout, '');
        },
      );
    },
  );
});

test('remote, credentialed, malformed URLs and missing capability fail without connecting', async () => {
  for (const url of [
    'https://example.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000/?key=SECRET',
    'http://user:SECRET@127.0.0.1:3000',
    'not-a-url',
  ]) {
    const result = await invoke(['list'], {
      DIAGNOSTICS_API_URL: url,
      DIAGNOSTICS_LOCAL_CAPABILITY: capability,
    });
    assert.equal(result.code, 1);
    assert.doesNotMatch(result.stderr, /SECRET|example/);
  }
  assert.equal((await invoke(['list'], {})).code, 1);
});

test('argument scope is strict and never accepts credential arguments', async () => {
  for (const args of [
    ['report'],
    ['report', '--request', requestId, '--session', randomUUID()],
    ['report', '--request', 'SECRET'],
    ['list', '--capability', capability],
    ['list', '--json', '--json'],
  ]) {
    const result = await invoke(args, {});
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Usage:/);
    assert.doesNotMatch(result.stderr, /SECRET/);
  }
});

test('wrong-scope report and injected list payload fail closed', async () => {
  await serverFixture(
    (req, res) => {
      const body = req.url.endsWith('/list')
        ? { events: [{ sequence: 1, event: { ...event, prompt: 'PROMPT_CANARY' } }], health }
        : buildDiagnosticReport({ ...page, scope: { requestId: randomUUID() }, events: [] });
      res.end(JSON.stringify(body));
    },
    async (env) => {
      for (const args of [
        ['list', '--json'],
        ['report', '--request', requestId, '--json'],
      ]) {
        const result = await invoke(args, env);
        assert.equal(result.code, 1);
        assert.equal(result.stdout, '');
        assert.doesNotMatch(result.stderr, /PROMPT_CANARY/);
      }
    },
  );
});

test('oversized or failed response emits only bounded generic error', async () => {
  for (const body of ['x'.repeat(5 * 1024 * 1024 + 1), 'RAW_SECRET_ERROR']) {
    await serverFixture(
      (_req, res) => {
        res.statusCode = body.length > 100 ? 200 : 500;
        res.end(body);
      },
      async (env) => {
        const result = await invoke(['list'], env);
        assert.equal(result.code, 1);
        assert.equal(result.stdout, '');
        assert.ok(result.stderr.length < 200);
        assert.doesNotMatch(result.stderr, /RAW_SECRET_ERROR/);
      },
    );
  }
});

test('CLI list and report explain local context decisions separately from provider usage', async () => {
  const contextEvent = {
    ...event,
    phase: 'context',
    errorCode: 'context_budget_exceeded',
    contextDecision: {
      estimatorVersion: 'serialized_request_chars_v1',
      effectivePolicy: 'group_window_working_memory_v1',
      requestedStrategy: 'truncate',
      configuredInputTokens: 8000,
      effectiveInputTokens: 7200,
      estimatedInputBefore: 9000,
      estimatedInputAfter: 9000,
      schemaEstimate: 200,
      includedGroups: 2,
      omittedGroups: 0,
      outputCap: 2048,
      reason: 'required_overflow',
    },
  };
  const contextPage = { ...page, events: [{ sequence: 1, event: contextEvent }] };
  await serverFixture(
    (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify(
          req.url.endsWith('/list')
            ? { events: contextPage.events, health }
            : buildDiagnosticReport(contextPage),
        ),
      );
    },
    async (env) => {
      for (const args of [['list'], ['report', '--request', requestId]]) {
        const result = await invoke(args, env);
        assert.equal(result.code, 0);
        assert.match(result.stdout, /local context admission required_overflow/);
        assert.match(result.stdout, /estimated input 9000 -> 9000/);
        assert.match(result.stdout, /not a provider attempt/);
        assert.doesNotMatch(result.stdout, /provider-reported input\/output/);
      }
    },
  );
});
