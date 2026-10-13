import { expect, type TestInfo } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Agent, DiagnosticReport, SessionRecord } from '@agent-platform/contracts';
import { DiagnosticReportSchema } from '@agent-platform/contracts';
import { getOpenPort, seedDesktopDatabase } from './runtime.js';
import {
  CONTEXT_TOKEN_MODEL,
  type ContextTokenProviderRequest,
  type startContextTokenProvider,
} from './contextTokenProvider.js';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const contextTokenRepoRoot = resolve(desktopDir, '../..');
export const CONTEXT_INPUT = 14_000;
export const CONTEXT_OUTPUT = 128;
export const CONTEXT_PROVIDER_KEY = 'context-token-fixture-key-canary';
export const CONTEXT_BUDGET_MESSAGE =
  'Required context exceeds the input budget. Reduce input or tools, or adjust the configured budget. Earlier completed actions are retained.';
export const CONTEXT_MARKERS = [
  'CT_GOAL_CANARY',
  'CT_TASK_CANARY',
  'CT_DECISION_CANARY',
  'CT_BLOCKER_CANARY',
  'CT_FILE_CANARY',
];
export type ContextTokenFixture = Awaited<ReturnType<typeof createContextTokenFixture>>;
export type ContextTokenSnapshot = {
  messages: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
  memory: Record<string, unknown> | null;
};

export async function createContextTokenFixture(
  provider: Awaited<ReturnType<typeof startContextTokenProvider>>,
) {
  const parent = join(contextTokenRepoRoot, '.agent-platform', 'context-token-e2e');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'case-'));
  const runtimeDir = join(root, 'runtime');
  const projectDir = join(root, 'context-token-project');
  mkdirSync(projectDir);
  writeFileSync(join(projectDir, 'README.md'), '# Disposable context-token project\n');
  // The Project is nested under this checkout. Give it its own Git boundary so
  // background Project checks cannot inherit the real repository's GitHub remote.
  const git = (args: string[]) =>
    execFileSync('/usr/bin/git', args, {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        PATH: '/usr/bin:/bin',
        LANG: 'C',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_SYSTEM: '/dev/null',
      },
    }).trim();
  git(['init', '--initial-branch=context-fixture', '.']);
  git(['add', '--', 'README.md']);
  git([
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'user.name=Context fixture',
    '-c',
    'user.email=context-fixture@example.invalid',
    'commit',
    '-m',
    'Initial disposable context fixture',
  ]);
  const repositoryRootMatched = git(['rev-parse', '--show-toplevel']) === projectDir;
  const remotes = git(['remote']);
  const branch = git(['branch', '--show-current']);
  if (!repositoryRootMatched || remotes || branch !== 'context-fixture')
    throw new Error('Disposable Project Git boundary is invalid');
  const gitIsolation = { repositoryRootMatched, branch, remotes: [] as string[] };
  const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
  mkdirSync(join(runtimeDir, 'logs'), { recursive: true });
  seedDesktopDatabase(sqlitePath, {
    secretsMasterKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  });
  const backendPort = await getOpenPort();
  const rendererPort = await getOpenPort();
  const launchOptions = {
    cwd: desktopDir,
    args: ['.', `--user-data-dir=${join(root, 'profile')}`],
    env: {
      ...process.env,
      LANGCHAIN_TRACING_V2: 'false',
      LANGSMITH_TRACING: 'false',
      LANGSMITH_TRACING_V2: 'false',
      AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
      AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(backendPort),
      AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
      AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
      AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(rendererPort),
      AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtimeDir,
      AGENT_PLATFORM_DESKTOP_LOG_DIR: join(runtimeDir, 'logs'),
      AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(runtimeDir, 'tmp'),
      AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([projectDir]),
      OLLAMA_BASE_URL: provider.baseURL,
      NODE_OPTIONS: `--require=${join(desktopDir, 'e2e/support/provider-network-guard.cjs')}`,
      AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: '',
      AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: '',
      AGENT_OPENAI_API_KEY: '',
      AGENT_ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      SECRETS_MASTER_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    },
  };
  return {
    root,
    runtimeDir,
    projectDir,
    gitIsolation,
    sqlitePath,
    backendPort,
    rendererPort,
    launchOptions,
    provider,
  };
}

export async function readContextTokenApi<T>(
  fixture: ContextTokenFixture,
  route: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${fixture.backendPort}/v1/${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Fixture API ${route.split('/')[0]} failed: ${response.status}`);
  return ((await response.json()) as { data: T }).data;
}

export async function launchContextTokenFixture(
  fixture: ContextTokenFixture,
  reports: string[] = [],
): Promise<ElectronApplication> {
  const app = await electron.launch({
    ...fixture.launchOptions,
    env: {
      ...fixture.launchOptions.env,
      AGENT_PLATFORM_DESKTOP_TEST_SAVE_DIAGNOSTIC_PATHS: JSON.stringify(reports),
    },
  });
  const logDir = join(fixture.runtimeDir, 'logs');
  mkdirSync(logDir, { recursive: true });
  for (const channel of ['stdout', 'stderr'] as const) {
    const path = join(logDir, `desktop.${channel}.log`);
    let remaining = 128_000 - (existsSync(path) ? readFileSync(path).length : 0);
    app.process()[channel]?.on('data', (chunk: Buffer) => {
      if (remaining <= 0) return;
      const retained = chunk.subarray(0, remaining);
      try {
        appendFileSync(path, retained);
        remaining -= retained.length;
      } catch {
        // Owned cleanup may remove the path after process exit; logging is observational.
      }
    });
  }
  try {
    await app.evaluate((_electron, origin) => {
      const { subscribe } = (
        process as NodeJS.Process & {
          getBuiltinModule(id: string): typeof import('node:diagnostics_channel');
        }
      ).getBuiltinModule('node:diagnostics_channel');
      const observed: Array<{ status?: number; errorName?: string; errorCode?: string }> = [];
      (
        globalThis as typeof globalThis & { __contextTokenNativeTransport?: typeof observed }
      ).__contextTokenNativeTransport = observed;
      const owned = (request: unknown) => {
        if (!request || typeof request !== 'object') return false;
        const row = request as { origin?: unknown; path?: unknown };
        return String(row.origin) === origin && row.path === '/v1/diagnostics/report';
      };
      // Observe only transport metadata. Never inspect headers, capability, scope or body.
      // A diagnostics-channel subscriber must never throw into the observed execution.
      subscribe('undici:request:headers', (message) => {
        try {
          const row = message as { request?: unknown; response?: { statusCode?: unknown } };
          const status = row?.response?.statusCode;
          if (
            owned(row?.request) &&
            observed.length < 10 &&
            typeof status === 'number' &&
            Number.isInteger(status) &&
            status >= 100 &&
            status <= 599
          )
            observed.push({ status });
        } catch {
          // Observation cannot alter the request outcome.
        }
      });
      subscribe('undici:request:error', (message) => {
        try {
          const row = message as {
            request?: unknown;
            error?: { name?: unknown; code?: unknown };
          };
          if (!owned(row?.request) || observed.length >= 10) return;
          const name = String(row.error?.name);
          const code = String(row.error?.code);
          observed.push({
            errorName: ['Error', 'TypeError', 'RangeError', 'AbortError', 'TimeoutError'].includes(
              name,
            )
              ? name
              : 'unknown',
            errorCode: /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'unknown',
          });
        } catch {
          // Observation cannot alter the request outcome.
        }
      });
    }, `http://127.0.0.1:${fixture.backendPort}`);
    await expect
      .poll(
        async () => {
          try {
            return (await readContextTokenApi<unknown[]>(fixture, 'agents')).length > 0;
          } catch {
            return false;
          }
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    // firstWindow observes construction before createMainWindow's initial loadURL.
    // Wait for the real owned renderer load before any journey issues navigation.
    const initialWindow = await app.firstWindow();
    await initialWindow.waitForURL(
      (url) => url.origin === `http://127.0.0.1:${fixture.rendererPort}`,
      { waitUntil: 'load', timeout: 30_000 },
    );
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}

export async function createContextTokenAgent(
  fixture: ContextTokenFixture,
  outputCap = CONTEXT_OUTPUT,
): Promise<Agent> {
  const model = await readContextTokenApi<{ id: string }>(fixture, 'model-configs', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Context external wire fixture',
      provider: 'ollama',
      model: CONTEXT_TOKEN_MODEL,
      apiKey: CONTEXT_PROVIDER_KEY,
    }),
  });
  return readContextTokenApi<Agent>(fixture, 'agents', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Context token fixture',
      systemPrompt: 'Follow the current disposable Project request.',
      allowedSkillIds: [],
      allowedToolIds: [],
      allowedMcpServerIds: [],
      modelConfigId: model.id,
      contextWindow: {
        maxInputTokens: CONTEXT_INPUT,
        maxOutputTokens: outputCap,
        strategy: 'summarize',
      },
      executionLimits: { maxSteps: 6, maxParallelTasks: 2, timeoutMs: 30_000 },
    }),
  });
}

export async function openContextTokenProject(
  page: Page,
  fixture: ContextTokenFixture,
  agent: Agent,
): Promise<{ id: string; projectId: string }> {
  await page.reload();
  await page.getByRole('button', { name: 'Open folder', exact: true }).click();
  await expect(page.getByPlaceholder('Ask about this Project...')).toBeVisible();
  await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
  const selector = page.getByRole('combobox', { name: 'Active agent' });
  const binding = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/sessions/project') &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON()?.agentId === agent.id,
  );
  await selector.click();
  await page.getByRole('option', { name: agent.name, exact: true }).click();
  await expect(selector).toContainText(agent.name);
  const bound = await binding;
  expect(bound.ok()).toBe(true);
  const session = (
    (await bound.json()) as {
      data: { session: { id: string; agentId: string; projectId: string } };
    }
  ).data.session;
  expect(session.agentId).toBe(agent.id);
  expect(
    (await readContextTokenApi<{ agentId: string }>(fixture, `sessions/${session.id}`)).agentId,
  ).toBe(agent.id);
  await sendContextTokenMessage(page, '/init');
  await page.getByRole('button', { name: 'Approve instructions' }).click();
  await expect
    .poll(
      async () =>
        (
          await readContextTokenApi<{ metadata: Record<string, unknown> }>(
            fixture,
            `projects/${session.projectId}`,
          )
        ).metadata.onboardingState,
    )
    .toBe('approved');
  const record = await readContextTokenApi<SessionRecord>(fixture, `sessions/${session.id}`);
  await readContextTokenApi(fixture, `sessions/${session.id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...record, title: `Context-token ${session.id}` }),
  });
  await expect(page.getByRole('combobox', { name: 'Active agent' })).toContainText(agent.name);
  await selectContextTokenModel(page);
  await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
  return session;
}

export async function reopenContextTokenSession(
  page: Page,
  fixture: ContextTokenFixture,
  session: { id: string; projectId: string },
) {
  // Existing session history UI sets the resume state; the explicit-session deep link
  // currently omits it. Exercise the supported menu route and retain that separate limitation.
  await page.goto(`http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}`);
  await expect(page.getByRole('combobox', { name: 'Active agent' })).toContainText(
    'Context token fixture',
  );
  await page.getByRole('button', { name: 'Open sessions menu', exact: true }).click();
  await page.getByRole('menuitem', { name: new RegExp(`^Context-token ${session.id}`) }).click();
}

export async function selectContextTokenModel(page: Page) {
  const model = page.getByRole('combobox', { name: 'Active model' });
  await expect(model).toBeEnabled();
  await model.click();
  await page.getByRole('option', { name: /Context external wire fixture/ }).click();
  await expect(model).toContainText('Context external wire fixture');
}

export async function sendContextTokenMessage(page: Page, message: string) {
  const input = page.getByPlaceholder('Ask about this Project...');
  await expect(input).toBeEnabled();
  await input.fill(message);
  const submit = input.locator('xpath=ancestor::form').locator('button[type="submit"]');
  await expect(submit).toBeEnabled();
  const settled = page.waitForResponse(
    (response) => response.url().endsWith('/api/chat') && response.request().method() === 'POST',
  );
  await submit.click();
  const response = await settled;
  expect(response.ok()).toBe(true);
  // Each journey observes its own completion or approval state. A pending Ask deliberately
  // disables the composer; Electron also does not reliably settle Response.finished().
}

const dbScript = String.raw`
import { readFileSync } from 'node:fs';
import { openDatabase } from './packages/db/dist/database.js';
import { upsertWorkingMemoryArtifact } from './packages/db/dist/repositories/workingMemory.js';
import { randomUUID } from 'node:crypto';
const input = JSON.parse(readFileSync(0, 'utf8'));
const { db, sqlite } = openDatabase(input.sqlitePath);
try {
  if (input.seedHistory) {
    const insert = sqlite.prepare('INSERT INTO messages(id,session_id,role,content,tool_call_id,tool_calls_json,created_at_ms) VALUES(?,?,?,?,?,?,?)');
    let now = Date.now();
    const add = (role, content, id, calls) => insert.run(randomUUID(), input.sessionId, role, content, id ?? null, calls ? JSON.stringify(calls) : null, now++);
    sqlite.transaction(() => {
      for (let index = 0; index < 8; index++) {
        const calls = [0,1].map(part => ({ id:'old-' + index + '-' + part, name:'sys_read_file', args:{path:'old-fixture.txt'} }));
        add('user', 'Older completed fixture turn ' + index);
        add('assistant', '', null, calls);
        for (const call of calls) add('tool', 'OLD_RESULT_CANARY_' + 'x'.repeat(6_000), call.id);
        add('assistant', 'Old completed answer ' + index);
      }
      upsertWorkingMemoryArtifact(db, { sessionId:input.sessionId, projectId:input.projectId,
        currentGoal:'CT_GOAL_CANARY', activeTask:'CT_TASK_CANARY', decisions:['CT_DECISION_CANARY'],
        blockers:['CT_BLOCKER_CANARY'], importantFiles:['CT_FILE_CANARY'], nextAction:'Continue current task',
        summary:'Goal: CT_GOAL_CANARY\nTask: CT_TASK_CANARY\nDecision: CT_DECISION_CANARY\nBlocker: CT_BLOCKER_CANARY\nFile: CT_FILE_CANARY', });
    })();
  }
  console.log(JSON.stringify({
    messages:sqlite.prepare('SELECT * FROM messages WHERE session_id=? ORDER BY created_at_ms,rowid').all(input.sessionId),
    approvals:sqlite.prepare('SELECT * FROM approval_requests WHERE session_id=? ORDER BY created_at_ms').all(input.sessionId),
    audits:sqlite.prepare('SELECT * FROM tool_executions WHERE session_id=? ORDER BY started_at_ms').all(input.sessionId),
    memory:sqlite.prepare('SELECT * FROM working_memory_artifacts WHERE session_id=?').get(input.sessionId) ?? null,
  }));
} finally { sqlite.close(); }
`;
export function snapshotContextTokenDb(
  fixture: ContextTokenFixture,
  sessionId: string,
  seed?: { projectId: string },
): ContextTokenSnapshot {
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', dbScript], {
      cwd: contextTokenRepoRoot,
      input: JSON.stringify({
        sqlitePath: fixture.sqlitePath,
        sessionId,
        seedHistory: Boolean(seed),
        projectId: seed?.projectId,
      }),
      encoding: 'utf8',
      maxBuffer: 2_000_000,
    }),
  ) as ContextTokenSnapshot;
}

/** Read the live owned SQLite/WAL without changing the collector or reading event content. */
export function snapshotContextTokenDiagnosticStore(
  fixture: ContextTokenFixture,
  sessionId: string,
) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
import { readFileSync } from 'node:fs';
import Database from './packages/db/node_modules/better-sqlite3/lib/index.js';
const input = JSON.parse(readFileSync(0, 'utf8'));
const db = new Database(input.path, { readonly: true, fileMustExist: true });
try {
  console.log(JSON.stringify({
    total: db.prepare('SELECT count(*) AS count FROM diagnostic_events').get().count,
    selectedSession: db.prepare('SELECT count(*) AS count FROM diagnostic_events WHERE session_id=?').get(input.sessionId).count,
    firstRequestId: db.prepare('SELECT request_id FROM diagnostic_events ORDER BY sequence LIMIT 1').get()?.request_id,
    metadata: db.prepare("SELECT key,value FROM diagnostic_meta WHERE key IN ('dropped','conflicts','pruned','last_ack','open')").all(),
  }));
} finally { db.close(); }
`,
      ],
      {
        cwd: contextTokenRepoRoot,
        input: JSON.stringify({
          path: join(fixture.runtimeDir, 'data', 'diagnostics.sqlite'),
          sessionId,
        }),
        encoding: 'utf8',
        maxBuffer: 4096,
      },
    ),
  ) as {
    total: number;
    selectedSession: number;
    firstRequestId?: string;
    metadata: Array<{ key: string; value: string }>;
  };
}

export function assertContextTokenWire(
  requests: ContextTokenProviderRequest[],
  inputCap = CONTEXT_INPUT,
  outputCap = CONTEXT_OUTPUT,
) {
  expect(requests.length).toBeGreaterThan(0);
  const estimates: number[] = [];
  for (const request of requests) {
    expect(request.model).toBe(CONTEXT_TOKEN_MODEL);
    expect(request.max_tokens ?? request.max_completion_tokens).toBe(outputCap);
    expect(request.tools?.some((tool) => tool.function.name === 'sys_read_file')).toBe(true);
    expect(request.tools?.some((tool) => tool.function.name === 'sys_write_file')).toBe(true);
    expect(request.tools?.length).toBe(requests[0]!.tools?.length);
    const toolNames = new Map<string, string>();
    const pending = new Set<string>();
    const messages = request.messages.map((message) => {
      if (message.role === 'assistant' && message.tool_calls?.length) {
        expect(pending.size).toBe(0);
        const content: unknown[] =
          typeof message.content === 'string' && message.content
            ? [{ type: 'text', text: message.content }]
            : [];
        for (const call of message.tool_calls) {
          expect(toolNames.has(call.id)).toBe(false);
          toolNames.set(call.id, call.function.name);
          pending.add(call.id);
          content.push({
            type: 'tool-call',
            toolCallId: call.id,
            toolName: call.function.name,
            args: JSON.parse(call.function.arguments),
          });
        }
        return { role: 'assistant', content };
      }
      if (message.role === 'tool') {
        expect(pending.delete(message.tool_call_id!)).toBe(true);
        return {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: message.tool_call_id,
              toolName: toolNames.get(message.tool_call_id!),
              result: JSON.parse(String(message.content)),
            },
          ],
        };
      }
      expect(pending.size).toBe(0);
      return { role: message.role, content: message.content };
    });
    expect(pending.size).toBe(0);
    const tools =
      request.tools?.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description ?? '',
        parameters: tool.function.parameters,
      })) ?? [];
    const estimated = Math.ceil(JSON.stringify({ messages, tools }).length / 4);
    expect(estimated).toBeLessThanOrEqual(Math.floor(inputCap * 0.9));
    estimates.push(estimated);
  }
  return estimates;
}

export async function exportContextTokenReport(
  page: Page,
  destination: string,
  forbidden: string[],
): Promise<DiagnosticReport> {
  await page.getByRole('button', { name: 'Export diagnostic report', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Diagnostic report saved locally' }),
  ).toBeVisible();
  await expect.poll(() => existsSync(destination)).toBe(true);
  const text = readFileSync(destination, 'utf8');
  for (const value of [...forbidden, CONTEXT_PROVIDER_KEY]) expect(text).not.toContain(value);
  const report = DiagnosticReportSchema.parse(JSON.parse(text));
  expect(report.source).toBe('local-store');
  expect(report.coverage).toMatchObject({
    durable: true,
    verified: true,
    dropped: 0,
    pending: 0,
    truncated: false,
  });
  return report;
}

export async function recordContextTokenEvidence(
  info: TestInfo,
  fixture: ContextTokenFixture,
  scenario: string,
  evidence: Record<string, unknown>,
  page?: Page,
) {
  const file = info.outputPath('context-token-evaluation.json');
  writeFileSync(
    file,
    JSON.stringify(
      {
        scenario,
        sourceRevision: execFileSync('/usr/bin/git', ['rev-parse', 'HEAD'], {
          cwd: contextTokenRepoRoot,
          encoding: 'utf8',
        }).trim(),
        sourceHashes: Object.fromEntries(
          [
            'apps/desktop/e2e/context-token.e2e.ts',
            'apps/desktop/e2e/support/contextTokenFixture.ts',
            'apps/desktop/e2e/support/contextTokenProvider.ts',
            'packages/harness/src/providerContext.ts',
            'packages/harness/src/nodes/llmReason.ts',
            'apps/api/src/infrastructure/http/v1/chatRouter.ts',
            'packages/contracts/src/diagnostics.ts',
          ].map((file) => [
            file,
            createHash('sha256')
              .update(readFileSync(join(contextTokenRepoRoot, file)))
              .digest('hex'),
          ]),
        ),
        backendLogs: Object.fromEntries(
          [
            'backend.stdout.log',
            'backend.stderr.log',
            'desktop.stdout.log',
            'desktop.stderr.log',
          ].map((name) => {
            const path = join(fixture.runtimeDir, 'logs', name);
            return [
              name,
              existsSync(path)
                ? readFileSync(path)
                    .subarray(-128_000)
                    .toString('utf8')
                    .replaceAll(CONTEXT_PROVIDER_KEY, '<fixture-key>')
                    .replaceAll(/\b[a-f0-9]{64}\b/g, '<redacted-id>')
                : '<unavailable>',
            ];
          }),
        ),
        providerRequests: fixture.provider.requests,
        providerErrors: fixture.provider.errors,
        ...evidence,
        limits: [
          'External deterministic HTTP provider and native Save As destination double; real managed desktop/BFF/API/SQLite/policy/tool dispatch and disposable file effects.',
          'Synthetic provider usage, not real provider billing/quality/tokenization/capacity; cap serialization is verified, live cap enforcement is not.',
          'The SDK fetch guard is configured for participating Node children; blanket Electron-main network isolation is not claimed.',
          'Explicit configured input14000; does not establish default8000 profile usability.',
        ],
      },
      null,
      2,
    ).replaceAll(fixture.root, '<disposable-root>'),
  );
  await info.attach('context-token-evaluation', { path: file, contentType: 'application/json' });
  if (page)
    await info.attach('context-token-ui', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
}
export function removeContextTokenFixture(fixture: ContextTokenFixture) {
  rmSync(fixture.root, { recursive: true, force: true });
}
