import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { DEFAULT_AGENT_ID, openDatabase } from '@agent-platform/db';
import { expect, it } from 'vitest';
import { waitForDiagnosticReadiness } from './support/diagnosticReadiness.js';

const { startStopProvider } = await import(
  new URL('../../../e2e/support/project-chat-stop/provider.mjs', import.meta.url).href
);
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(apiRoot, '../..');
const capability = 'd'.repeat(64);
const credential = 'fallback-process-fixture-credential';

async function availablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local fixture port');
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

async function stopChild(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 4000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

function retainedState(path: string, sessionId: string) {
  const { sqlite } = openDatabase(path);
  try {
    return {
      configs: sqlite.prepare('SELECT count(*) AS count FROM model_configs').get(),
      approvals: sqlite
        .prepare('SELECT * FROM approval_requests WHERE session_id = ?')
        .all(sessionId),
      continuations: sqlite
        .prepare('SELECT * FROM provider_continuations WHERE session_id = ?')
        .all(sessionId),
      audit: sqlite.prepare('SELECT * FROM tool_executions WHERE session_id = ?').all(sessionId),
      executions: sqlite.prepare('SELECT * FROM run_executions').all(),
    };
  } finally {
    sqlite.close();
  }
}

it('fences an approved encrypted fallback continuation after a real API process restart without claims or effects', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fallback-approval-process-'));
  const sqlitePath = join(directory, 'app.sqlite');
  const marker = join(directory, 'must-not-replay.txt');
  const provider = await startStopProvider({ model: 'fallback-process-fixture' });
  let origin: string;
  let child: ChildProcess | undefined;
  const pids: number[] = [];
  const logs: string[] = [];
  async function start() {
    // A killed child's pooled HTTP connection must not be reused by its replacement.
    const port = await availablePort();
    origin = `http://127.0.0.1:${port}`;
    const env = { ...process.env };
    for (const key of Object.keys(env))
      if (/^(?:AGENT_)?(?:OPENAI|ANTHROPIC|GOOGLE|DEEPSEEK|XAI|OPENROUTER).*KEY$/.test(key))
        delete env[key];
    child = spawn(process.execPath, ['dist/index.js'], {
      cwd: apiRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...env,
        HOST: '127.0.0.1',
        PORT: String(port),
        SQLITE_PATH: sqlitePath,
        WORKSPACE_ROOT: directory,
        DIAGNOSTICS_HOST: `127.0.0.1:${port}`,
        DIAGNOSTICS_LOCAL_CAPABILITY: capability,
        SECRETS_MASTER_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        DEFAULT_MODEL_PROVIDER: 'ollama',
        DEFAULT_MODEL: 'fallback-process-fixture',
        AGENT_OPENAI_API_KEY: credential,
        OLLAMA_BASE_URL: provider.baseURL,
        AGENT_PLATFORM_COMMAND_RUNNER: 'host',
        AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: '',
        AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: '',
        NODE_OPTIONS: `--require=${join(repositoryRoot, 'apps/desktop/e2e/support/provider-network-guard.cjs')}`,
        SCHEDULER_ENABLED: 'false',
        LANGCHAIN_TRACING_V2: 'false',
        LANGSMITH_TRACING: 'false',
        LANGSMITH_TRACING_V2: 'false',
      },
    });
    child.stdout?.on('data', (data: Buffer) => logs.push(data.toString()));
    child.stderr?.on('data', (data: Buffer) => logs.push(data.toString()));
    if (!child.pid) throw new Error('Fallback API fixture did not start');
    pids.push(child.pid);
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
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  }
  try {
    await start();
    const created = await api('sessions', { agentId: DEFAULT_AGENT_ID });
    expect(created.status).toBe(201);
    const sessionId = ((await created.json()) as { data: { id: string } }).data.id;
    provider.enqueue({
      kind: 'tool',
      name: 'sys_bash',
      args: { command: "printf 'unexpected replay\\n' >> must-not-replay.txt" },
    });
    const pending = await api('chat', {
      sessionId,
      message: 'Create one approval for local work.',
    });
    expect(pending.status).toBe(200);
    const events = (await pending.text())
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type?: string; approvalRequestId?: string });
    const approvalId = events.find(
      (event) => event.type === 'approval_required',
    )?.approvalRequestId;
    expect(approvalId).toBeTypeOf('string');
    const beforeRun = await api(`sessions/${sessionId}/active-run`);
    expect(beforeRun.status).toBe(200);
    const before = ((await beforeRun.json()) as { data: { id: string; state: string } }).data;
    expect(before.state).toBe('waiting_for_approval');
    const approved = await api(`approval-requests/${approvalId}/approve`, {});
    expect(approved.status).toBe(200);
    expect(((await approved.json()) as { data: { status: string } }).data.status).toBe('approved');
    const retained = retainedState(sqlitePath, sessionId);
    expect(retained.configs).toEqual({ count: 0 });
    expect(retained.continuations.map(() => null)).toHaveLength(1);
    expect(retained.approvals.map(() => null)).toHaveLength(1);
    const retainedApproval = retained.approvals[0] as { status: string; resumed_at_ms: null };
    expect(retainedApproval.status).toBe('approved');
    expect(retainedApproval.resumed_at_ms).toBeNull();
    expect(retained.audit).toHaveLength(1);
    expect(retained.audit[0]).toMatchObject({ status: 'pending', completed_at_ms: null });
    expect(provider.requests.map(() => null)).toHaveLength(1);
    expect(provider.errors).toEqual([]);
    expect(existsSync(marker)).toBe(false);
    const crashed = once(child!, 'exit');
    expect(child!.kill('SIGKILL')).toBe(true);
    const [, signal] = await crashed;
    expect(signal).toBe('SIGKILL');
    await start();
    expect(pids[0]).not.toBe(pids[1]);
    const reopened = await api(`sessions/${sessionId}/runs/${before.id}`);
    expect(reopened.status).toBe(200);
    expect(((await reopened.json()) as { data: unknown }).data).toMatchObject({
      id: before.id,
      state: 'interrupted',
      reason: 'process_interrupted',
      inFlight: 0,
    });
    const resumed = await api(`sessions/${sessionId}/resume`, { approvalRequestId: approvalId });
    expect(resumed.status).toBe(409);
    expect(((await resumed.json()) as { error: { code: string } }).error.code).toBe(
      'RUN_NOT_RUNNING',
    );
    // Compare booleans so failures cannot print encrypted/private continuation material.
    expect(isDeepStrictEqual(retainedState(sqlitePath, sessionId), retained)).toBe(true);
    expect(provider.requests.map(() => null)).toHaveLength(1);
    expect(provider.errors).toEqual([]);
    expect(existsSync(marker)).toBe(false);
    expect(logs.join('').includes(credential)).toBe(false);
  } finally {
    if (child) await stopChild(child);
    await provider.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);
