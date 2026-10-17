import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RunControlRecordSchema, type RunControlRecord } from '@agent-platform/contracts';
import { DEFAULT_AGENT_ID, openDatabase } from '@agent-platform/db';
import { expect, it } from 'vitest';
import { waitForDiagnosticReadiness } from './support/diagnosticReadiness.js';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(apiRoot, '../..');
const capability = 'c'.repeat(64);
const model = 'fixture-stop-process';
const waitingMessage = 'WAITING_RESTART_FIXTURE';
const blockedMessage = 'BLOCKED_RESTART_FIXTURE';
const freshMessage = 'FRESH_RESTART_FIXTURE';
const finalText = 'Fresh explicit request completed';

async function freePort(): Promise<number> {
  const listener = createTcpServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture TCP address');
  await new Promise<void>((done) => listener.close(() => done()));
  return address.port;
}
function deferred() {
  let resolvePromise!: () => void;
  const promise = new Promise<void>((done) => {
    resolvePromise = done;
  });
  return { promise, resolve: resolvePromise };
}
async function stopOwnedChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }, 4_000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}
async function startProvider() {
  const admitted = deferred();
  const disconnected = deferred();
  const requests: Array<'approval' | 'blocked' | 'fresh'> = [];
  const errors: string[] = [];
  const blockedResponses = new Set<ServerResponse>();
  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (req.method !== 'POST' || req.url !== '/v1/chat/completions')
          throw new Error('Unexpected fixture provider route');
        let input = '';
        for await (const chunk of req) {
          input += String(chunk);
          if (input.length > 250_000) throw new Error('Provider fixture input exceeded its bound');
        }
        const body = JSON.parse(input) as {
          model?: string;
          stream?: boolean;
          messages?: Array<{ role?: string; content?: unknown }>;
        };
        if (body.model !== model || body.stream !== true)
          throw new Error('Unexpected provider model or stream mode');
        const message = body.messages?.filter((row) => row.role === 'user').at(-1)?.content;
        const mode =
          message === waitingMessage
            ? 'approval'
            : message === blockedMessage
              ? 'blocked'
              : message === freshMessage
                ? 'fresh'
                : undefined;
        if (!mode) throw new Error('Unexpected fixture request content');
        requests.push(mode);
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        if (mode === 'blocked') {
          blockedResponses.add(res);
          res.once('close', () => {
            blockedResponses.delete(res);
            disconnected.resolve();
          });
          res.write(': controlled provider is admitted and waiting\n\n');
          admitted.resolve();
          return;
        }
        const emit = (delta: unknown, finishReason: string | null) =>
          res.write(
            `data: ${JSON.stringify({
              id: `fixture-process-${requests.length}`,
              object: 'chat.completion.chunk',
              created: 1,
              model,
              choices: [{ index: 0, delta, finish_reason: finishReason }],
              ...(finishReason
                ? { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }
                : {}),
            })}\n\n`,
          );
        if (mode === 'approval')
          emit(
            {
              tool_calls: [
                {
                  index: 0,
                  id: `fixture-approval-${requests.length}`,
                  type: 'function',
                  function: {
                    name: 'sys_bash',
                    arguments: JSON.stringify({
                      command: "printf 'unexpected replay\\n' >> must-not-replay.txt",
                    }),
                  },
                },
              ],
            },
            null,
          );
        else emit({ content: finalText }, null);
        emit({}, mode === 'approval' ? 'tool_calls' : 'stop');
        res.end('data: [DONE]\n\n');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown provider fixture failure');
        if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Provider fixture rejected request' } }));
      }
    })();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing provider fixture address');
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    requests,
    errors,
    admitted,
    disconnected,
    close: async () => {
      for (const response of blockedResponses) response.destroy();
      server.closeAllConnections();
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    },
  };
}
function readAttempts(sqlitePath: string, runId: string) {
  const { sqlite } = openDatabase(sqlitePath);
  try {
    return sqlite
      .prepare(
        'SELECT id, run_id AS runId, execution_id AS executionId, kind, outcome FROM run_attempts WHERE run_id = ? ORDER BY admitted_at_ms, id',
      )
      .all(runId);
  } finally {
    sqlite.close();
  }
}

it('retains actual admitted and waiting run authority across an owned API crash without replay, then accepts an explicit new run', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'run-control-process-'));
  const workspace = join(directory, 'workspace');
  mkdirSync(workspace);
  const marker = join(workspace, 'must-not-replay.txt');
  const sqlitePath = join(directory, 'app.sqlite');
  const provider = await startProvider();
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const activeClient = new AbortController();
  let child: ChildProcess | undefined;
  const childPids: number[] = [];
  const childLogs: string[] = [];
  let activeResponse:
    | Promise<{ status?: number; body?: string; disconnected?: boolean }>
    | undefined;
  let beforeActive: RunControlRecord | undefined;
  let afterActive: RunControlRecord | undefined;
  let beforeWaiting: RunControlRecord | undefined;
  let afterWaiting: RunControlRecord | undefined;
  let stopped: RunControlRecord | undefined;
  let fresh: RunControlRecord | undefined;
  let attemptsBefore: unknown[] = [];
  let attemptsAfter: unknown[] = [];
  let requestCountAtRestart: number | undefined;
  let modelConfigId: string | undefined;
  async function start() {
    child = spawn(process.execPath, ['dist/index.js'], {
      cwd: apiRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
        SQLITE_PATH: sqlitePath,
        WORKSPACE_ROOT: workspace,
        DIAGNOSTICS_HOST: `127.0.0.1:${port}`,
        DIAGNOSTICS_LOCAL_CAPABILITY: capability,
        AGENT_OPENAI_API_KEY: '',
        OPENAI_API_KEY: '',
        AGENT_ANTHROPIC_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        SECRETS_MASTER_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        AGENT_PLATFORM_COMMAND_RUNNER: 'host',
        OLLAMA_BASE_URL: provider.url,
        AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: '',
        AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: '',
        NODE_OPTIONS: `--require=${join(repositoryRoot, 'apps/desktop/e2e/support/provider-network-guard.cjs')}`,
        SCHEDULER_ENABLED: 'false',
        LANGCHAIN_TRACING_V2: 'false',
        LANGSMITH_TRACING: 'false',
        LANGSMITH_TRACING_V2: 'false',
      },
    });
    const collect = (data: Buffer) => {
      childLogs.push(data.toString().slice(-4000));
      if (childLogs.length > 25) childLogs.shift();
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    if (!child.pid) throw new Error('Owned API child did not start');
    childPids.push(child.pid);
    await waitForDiagnosticReadiness(
      origin,
      capability,
      () => child!.exitCode !== null || child!.signalCode !== null,
      10_000,
    );
  }
  async function api(path: string, body?: unknown) {
    return fetch(`${origin}/v1/${path}`, {
      ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
      headers: {
        'content-type': 'application/json',
        ...(modelConfigId ? { 'x-model-config-id': modelConfigId } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
  }
  async function createSession() {
    const response = await api('sessions', { agentId: DEFAULT_AGENT_ID });
    expect(response.status).toBe(201);
    return ((await response.json()) as { data: { id: string } }).data.id;
  }
  async function read(sessionId: string, runId?: string) {
    const response = await api(
      runId ? `sessions/${sessionId}/runs/${runId}` : `sessions/${sessionId}/active-run`,
    );
    expect(response.status).toBe(200);
    return RunControlRecordSchema.parse(((await response.json()) as { data: unknown }).data);
  }
  async function queueApproval(sessionId: string) {
    const response = await api('chat', { sessionId, message: waitingMessage });
    expect(response.status).toBe(200);
    const events = (await response.text())
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type?: string; approvalRequestId?: string });
    const id = events.find((event) => event.type === 'approval_required')?.approvalRequestId;
    expect(id).toBeTypeOf('string');
    return id!;
  }
  try {
    await start();
    const configuration = await api('model-configs', {
      name: 'Local process fixture',
      provider: 'ollama',
      model,
      apiKey: 'fixture-local-provider-key',
    });
    expect(configuration.status).toBe(201);
    modelConfigId = ((await configuration.json()) as { data: { id: string } }).data.id;
    const waitingSession = await createSession();
    const waitingApproval = await queueApproval(waitingSession);
    beforeWaiting = await read(waitingSession);
    expect(beforeWaiting.state).toBe('waiting_for_approval');
    const stoppedSession = await createSession();
    const stoppedApproval = await queueApproval(stoppedSession);
    const toStop = await read(stoppedSession);
    const stoppedResponse = await api(`sessions/${stoppedSession}/runs/${toStop.id}/stop`, {});
    expect(stoppedResponse.status).toBe(200);
    stopped = RunControlRecordSchema.parse(
      ((await stoppedResponse.json()) as { data: unknown }).data,
    );
    expect(stopped).toMatchObject({ state: 'cancelled', reason: 'user_stop' });
    const activeSession = await createSession();
    activeResponse = fetch(`${origin}/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-model-config-id': modelConfigId },
      body: JSON.stringify({ sessionId: activeSession, message: blockedMessage }),
      signal: activeClient.signal,
    })
      .then(async (response) => ({ status: response.status, body: await response.text() }))
      .catch(() => ({ disconnected: true }));
    await Promise.race([
      provider.admitted.promise,
      activeResponse.then((response) => {
        throw new Error(
          `Chat finished before provider admission: ${response.status ?? 'disconnected'}`,
        );
      }),
    ]);
    beforeActive = await read(activeSession);
    expect(beforeActive).toMatchObject({ state: 'running', inFlight: 1 });
    attemptsBefore = readAttempts(sqlitePath, beforeActive.id);
    expect(attemptsBefore).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'model', outcome: 'running' })]),
    );
    requestCountAtRestart = provider.requests.length;
    expect(provider.requests).toEqual(['approval', 'approval', 'blocked']);
    expect(existsSync(marker)).toBe(false);
    // Only this test's directly spawned child is killed; no process discovery or unrelated signals.
    const initial = child!;
    const crashed = once(initial, 'exit');
    expect(initial.kill('SIGKILL')).toBe(true);
    const [, signal] = await crashed;
    expect(signal).toBe('SIGKILL');
    await provider.disconnected.promise;
    await activeResponse.catch(() => ({ disconnected: true }));
    await start();
    expect(childPids[1]).not.toBe(childPids[0]);
    afterActive = await read(activeSession, beforeActive.id);
    afterWaiting = await read(waitingSession, beforeWaiting.id);
    expect(afterActive).toMatchObject({
      id: beforeActive.id,
      sessionId: activeSession,
      processInstanceId: beforeActive.processInstanceId,
      state: 'outcome_unknown',
      reason: 'process_interrupted',
      inFlight: 1,
    });
    expect(afterActive.version).toBeGreaterThan(beforeActive.version);
    expect(afterWaiting).toMatchObject({
      id: beforeWaiting.id,
      state: 'interrupted',
      reason: 'process_interrupted',
      inFlight: 0,
    });
    expect(await read(stoppedSession, stopped.id)).toEqual(stopped);
    attemptsAfter = readAttempts(sqlitePath, beforeActive.id);
    expect(attemptsAfter).toEqual(attemptsBefore);
    for (const [sessionId, approvalId] of [
      [waitingSession, waitingApproval],
      [stoppedSession, stoppedApproval],
    ]) {
      const decision = await api(`approval-requests/${approvalId}/approve`, {});
      expect(decision.status).toBe(409);
      expect(((await decision.json()) as { error: { code: string } }).error.code).toBe(
        'APPROVAL_RUN_STOPPED',
      );
      const resume = await api(`sessions/${sessionId}/resume`, { approvalRequestId: approvalId });
      expect(resume.status).toBe(409);
      expect(((await resume.json()) as { error: { code: string } }).error.code).toBe(
        'APPROVAL_NOT_DECIDED',
      );
    }
    expect(provider.requests).toHaveLength(requestCountAtRestart);
    expect(provider.errors).toEqual([]);
    expect(existsSync(marker)).toBe(false);
    const explicit = await api('chat', { sessionId: activeSession, message: freshMessage });
    expect(explicit.status).toBe(200);
    expect(await explicit.text()).toContain(finalText);
    fresh = await read(activeSession);
    expect(fresh.state).toBe('completed');
    expect(fresh.id).not.toBe(beforeActive.id);
    expect(fresh.processInstanceId).not.toBe(beforeActive.processInstanceId);
    expect(await read(activeSession, beforeActive.id)).toEqual(afterActive);
    expect(provider.requests).toEqual(['approval', 'approval', 'blocked', 'fresh']);
    expect(existsSync(marker)).toBe(false);
  } finally {
    activeClient.abort();
    if (activeResponse) await activeResponse.catch(() => ({ disconnected: true }));
    if (child) await stopOwnedChild(child);
    await provider.close();
    const output = process.env.RUN_CONTROL_PROCESS_EVIDENCE_DIR;
    if (output) {
      mkdirSync(output, { recursive: true });
      writeFileSync(
        join(output, 'run-control-process-restart.json'),
        JSON.stringify(
          {
            mode: 'actual compiled API child processes, real SQLite, real SDK with deterministic loopback provider',
            childPids,
            beforeActive,
            afterActive,
            beforeWaiting,
            afterWaiting,
            stopped,
            fresh,
            attemptsBefore,
            attemptsAfter,
            providerRequests: provider.requests,
            providerErrors: provider.errors,
            requestCountAtRestart,
            forbiddenEffectPresent: existsSync(marker),
            limitations: [
              'No renderer/Electron or guest process was exercised.',
              'A blocked model and approval waits were crashed; no already-unknown remote tool was reconstructed or replayed.',
            ],
          },
          null,
          2,
        ),
      );
      writeFileSync(
        join(output, 'run-control-process-child.log'),
        childLogs.join('').replaceAll(directory, '<disposable-root>'),
      );
    }
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
