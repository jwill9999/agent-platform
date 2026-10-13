import { expect, test } from '@playwright/test';
import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type WireRequest = {
  model: string;
  max_tokens?: number;
  messages: Array<{
    role: string;
    content?: unknown;
    tool_call_id?: string;
    tool_calls?: unknown[];
  }>;
};
type Audit = { toolName: string; status: string; argsJson: string; resultJson?: string };
type StoredMessage = { id: string; role: string; content: string; toolCallId?: string };
test.use({ actionTimeout: 10_000 });
const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';
const dbScript = `
import { openDatabase, appendMessage, listMessagesBySession, upsertWorkingMemoryArtifact, updateSessionTitle, queryToolExecutions, getProject } from './packages/db/dist/index.js';
const {db,sqlite}=openDatabase(process.env.SQLITE_PATH);
const sessionId=process.argv[1];
if(process.argv[2]==='seed') {
  updateSessionTitle(db,sessionId,'Context token saved history');
  appendMessage(db,{sessionId,role:'user',content:'OLD_CONTEXT_REQUEST'});
  appendMessage(db,{sessionId,role:'assistant',content:'',toolCalls:[{id:'old-context-read',name:'sys_read_file',args:{path:'old.txt'}}]});
  appendMessage(db,{sessionId,role:'tool',toolCallId:'old-context-read',content:'OLD_CONTEXT_CANARY'+'.'.repeat(60000)});
  appendMessage(db,{sessionId,role:'assistant',content:'Old turn completed.'});
  upsertWorkingMemoryArtifact(db,{sessionId,projectId:process.argv[3],currentGoal:'CONTEXT_GOAL',decisions:['CONTEXT_DECISION'],summary:'CONTEXT_GOAL; CONTEXT_DECISION'});
}
console.log(JSON.stringify(process.argv[2]==='project' ? getProject(db,process.argv[3]).metadata.backendProjectRoot : process.argv[2]==='audit' ? queryToolExecutions(db,{sessionId,limit:100}) : listMessagesBySession(db,sessionId)));
sqlite.close();
`;

test('Docker Project Chat budgets history and tool loops, rejects overflow, and recovers', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  // This connected fixture requires an explicitly owned API container with the supplied
  // host workspace mounted at /context-projects. The default /workspace compose mount
  // overlaps the virtual tool root (tracked separately in agent-platform-lnbn).
  test.skip(
    !process.env.CONTEXT_TOKEN_API_CONTAINER || !process.env.CONTEXT_TOKEN_WORKSPACE,
    'Requires isolated CONTEXT_TOKEN_API_CONTAINER and CONTEXT_TOKEN_WORKSPACE mounted at /context-projects',
  );
  const container = process.env.CONTEXT_TOKEN_API_CONTAINER!;
  expect(container).not.toBe('');
  const nonce = randomUUID();
  const model = `context-browser-${nonce}`;
  const projectName = `context-browser-${nonce}`;
  const workspace = process.env.CONTEXT_TOKEN_WORKSPACE!;
  const mounts = JSON.parse(
    execFileSync('docker', ['inspect', container, '--format', '{{json .Mounts}}'], {
      encoding: 'utf8',
    }),
  ) as Array<{ Source: string; Destination: string }>;
  expect(
    mounts.some(
      (m) => resolve(m.Source) === resolve(workspace) && m.Destination === '/context-projects',
    ),
  ).toBe(true);
  const outsideName = `outside-${model}.txt`;
  const outsidePath = join(workspace, outsideName);
  writeFileSync(outsidePath, 'CONTEXT_OUTSIDE_READ_CANARY');
  const directory = join(workspace, projectName);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'README.md'), 'CONTEXT_READ_RESULT');
  execFileSync('git', ['init', '-q', directory]);
  const providerSource = readFileSync(
    join(process.cwd(), 'e2e/support/context-provider.mjs'),
    'utf8',
  );
  const provider: ChildProcessWithoutNullStreams = spawn('docker', [
    'exec',
    '-i',
    container,
    'node',
    '--input-type=module',
    '-e',
    providerSource,
    model,
  ]);
  const requests: WireRequest[] = [];
  const errors: string[] = [];
  let ready = false;
  let pending = '';
  provider.stdout.on('data', (chunk: Buffer) => {
    pending += chunk.toString();
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      const event = JSON.parse(line) as { kind: string; body: WireRequest; message: string };
      if (event.kind === 'ready') ready = true;
      if (event.kind === 'request') requests.push(event.body);
      if (event.kind === 'error') errors.push(event.message);
    }
  });
  provider.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString()));
  const stored = (session: string, mode = 'read'): unknown =>
    JSON.parse(
      execFileSync(
        'docker',
        [
          'exec',
          container,
          'node',
          '--input-type=module',
          '-e',
          dbScript,
          session,
          mode,
          projectId ?? '',
        ],
        { encoding: 'utf8' },
      ),
    );
  const saved = (session: string, mode = 'read') => stored(session, mode) as StoredMessage[];
  const audit = (session: string) => stored(session, 'audit') as Audit[];
  let agentId: string | undefined;
  let configId: string | undefined;
  let sessionId: string | undefined;
  let projectId: string | undefined;
  try {
    await expect.poll(() => ready, { message: 'Local provider fixture must start' }).toBe(true);
    const config = await request.post(`${apiURL}/v1/model-configs`, {
      data: {
        name: model,
        provider: 'ollama',
        model,
        apiKey: 'context-token-synthetic-fixture-key',
      },
    });
    expect(config.ok()).toBe(true);
    configId = ((await config.json()) as { data: { id: string } }).data.id;
    const agent = await request.post(`${apiURL}/v1/agents`, {
      data: {
        name: projectName,
        systemPrompt: 'Use tools only when requested. Preserve available scoped continuity.',
        allowedSkillIds: [],
        allowedToolIds: [],
        allowedMcpServerIds: [],
        pluginAllowlist: [],
        modelConfigId: configId,
        contextWindow: { maxInputTokens: 14000, maxOutputTokens: 2048, strategy: 'summarize' },
        executionLimits: { maxSteps: 8, maxParallelTasks: 1, timeoutMs: 60000 },
      },
    });
    expect(agent.ok()).toBe(true);
    agentId = ((await agent.json()) as { data: { id: string } }).data.id;
    const project = await request.post(`${apiURL}/v1/projects/desktop/register`, {
      headers: { 'x-agent-platform-desktop-bridge': '1' },
      data: { name: projectName, path: `/context-projects/${projectName}` },
    });
    expect(project.ok()).toBe(true);
    const registered = (
      (await project.json()) as {
        data: { project: { id: string; metadata: { backendProjectRoot: string } } };
      }
    ).data.project;
    projectId = registered.id;
    const projectRoot = stored('', 'project') as string;
    expect(projectRoot).toBe(`/context-projects/${projectName}`);
    expect(
      execFileSync('docker', ['exec', container, 'cat', `${projectRoot}/README.md`], {
        encoding: 'utf8',
      }),
    ).toBe('CONTEXT_READ_RESULT');
    const session = await request.post(`${apiURL}/v1/sessions`, {
      data: { agentId, mode: 'project', projectId },
    });
    expect(session.ok()).toBe(true);
    sessionId = ((await session.json()) as { data: { id: string } }).data.id;
    saved(sessionId, 'seed');
    // Registration is fixture setup; this browser journey does not claim native folder-picker proof.
    await page.goto(`/?projectId=${projectId}`);
    const input = page.getByPlaceholder('Ask about this Project...');
    await expect(input).toBeEnabled();
    await expect(page.getByRole('combobox', { name: 'Active agent' })).toContainText(projectName);
    await page.getByRole('button', { name: 'Open sessions menu' }).click();
    await page.getByRole('menuitem', { name: /Context token saved history/ }).click();
    await expect(page.getByText('Old turn completed.', { exact: true })).toBeVisible();
    await input.fill('/init');
    await input.press('Enter');
    await page.getByRole('button', { name: 'Approve instructions' }).click();
    await expect(page.getByText('Project instructions approved').last()).toBeVisible();
    const before = saved(sessionId);
    await expect(page.getByRole('combobox', { name: 'Active agent' })).toContainText(projectName);
    await expect(page.getByText('Old turn completed.', { exact: true })).toBeVisible();
    const modelSelector = page.getByRole('combobox', { name: 'Active model' });
    const modelOption = page.getByRole('option', { name: new RegExp(model) });
    await expect(async () => {
      if ((await modelSelector.getAttribute('aria-expanded')) !== 'true')
        await modelSelector.click();
      await expect(modelOption).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    await modelOption.click();
    await expect(page.getByRole('combobox', { name: 'Active model' })).toContainText(model);
    await expect(input).toBeEnabled();
    await input.fill('CONTEXT_LONG_JOURNEY: read README.md and finish.');
    await input.press('Enter');
    await expect(page.getByText('Context journey finished.', { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(input).toBeEnabled();
    expect(requests).toHaveLength(2);
    await test.info().attach('context-success-visible', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    expect(errors).toEqual([]);
    for (const wire of requests) {
      expect(wire.max_tokens).toBe(2048);
      expect(JSON.stringify(wire.messages)).not.toContain('OLD_CONTEXT_CANARY');
      expect(JSON.stringify(wire.messages)).not.toContain('old-context-read');
      expect(JSON.stringify(wire.messages)).toContain('CONTEXT_GOAL');
      expect(JSON.stringify(wire.messages)).toContain('CONTEXT_DECISION');
    }
    expect(
      requests[1]!.messages.some(
        (m) =>
          m.role === 'tool' &&
          m.tool_call_id === 'context-browser-read' &&
          JSON.stringify(m.content).includes('CONTEXT_READ_RESULT'),
      ),
    ).toBe(true);
    const after = saved(sessionId);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after.filter((m) => m.toolCallId === 'context-browser-read')).toHaveLength(1);
    const positiveAudit = audit(sessionId).filter((row) => row.toolName === 'sys_read_file');
    expect(positiveAudit).toHaveLength(1);
    expect(positiveAudit[0]!.status).toBe('success');
    expect(positiveAudit[0]!.resultJson).toContain('CONTEXT_READ_RESULT');
    await input.fill('CONTEXT_DENIAL: attempt the two forbidden reads and report the denials.');
    await input.press('Enter');
    await expect(page.getByText('Context denials finished.', { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(input).toBeEnabled();
    expect(requests).toHaveLength(4);
    const denied = saved(sessionId).filter((m) =>
      m.toolCallId?.startsWith('context-browser-denied-'),
    );
    expect(denied).toHaveLength(2);
    for (const row of denied) expect(row.content).toContain('PATH_ACCESS_DENIED');
    expect(audit(sessionId).filter((row) => row.toolName !== 'sys_read_file')).toEqual([]);
    const readAudit = audit(sessionId).filter((row) => row.toolName === 'sys_read_file');
    expect(readAudit).toHaveLength(3);
    expect(readAudit.filter((row) => row.status === 'success')).toHaveLength(1);
    expect(readAudit.filter((row) => row.status === 'denied')).toHaveLength(2);
    expect(JSON.stringify(requests)).not.toContain('CONTEXT_OUTSIDE_READ_CANARY');
    expect(JSON.stringify(denied)).not.toContain('CONTEXT_OUTSIDE_READ_CANARY');
    expect(readFileSync(outsidePath, 'utf8')).toBe('CONTEXT_OUTSIDE_READ_CANARY');
    expect(readFileSync(join(directory, 'README.md'), 'utf8')).toBe('CONTEXT_READ_RESULT');
    await input.fill('CONTEXT_OVERFLOW_CANARY' + 'x'.repeat(40000));
    await input.press('Enter');
    await expect(
      page.getByText(/context.*(too large|budget)|required.*context/i).last(),
    ).toBeVisible({ timeout: 30000 });
    await expect(input).toBeEnabled();
    expect(requests).toHaveLength(4);
    await test.info().attach('context-overflow-visible', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await input.fill('CONTEXT_RECOVERY');
    await input.press('Enter');
    await expect(page.getByText('Context recovery finished.', { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(input).toBeEnabled();
    expect(requests).toHaveLength(5);
    await test.info().attach('context-recovery-visible', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    const final = saved(sessionId);
    expect(final.slice(0, before.length)).toEqual(before);
    expect(final.filter((m) => m.toolCallId === 'context-browser-read')).toHaveLength(1);
    await test.info().attach('context-browser-evidence', {
      body: JSON.stringify(
        {
          providerBoundary:
            'deterministic loopback protocol; real Docker browser/BFF/API/SQLite/tool read',
          sessionId,
          requestBytes: requests.map((r) => JSON.stringify(r).length),
          outputCaps: requests.map((r) => r.max_tokens),
          historyRowsBefore: before.length,
          historyRowsAfter: final.length,
          originalRowsUnchanged: true,
          toolResultCount: 1,
          deniedReadCount: 2,
          audits: audit(sessionId),
          projectRoot,
          mounts,
          topologyLimitation:
            'Non-overlapping /context-projects host root qualifies this fixture only; general overlapping Docker paths remain tracked in agent-platform-lnbn.',
          errors,
          diagnosticsCoverage:
            'Unavailable in this Docker topology: no local diagnostic capability configured. Native export/report inspection is qualified separately by Electron tests.',
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });
  } finally {
    // Preserve synthetic wire and durable state before cleanup, including on a failed assertion.
    const finalStatePath = test.info().outputPath('context-browser-final-state.json');
    writeFileSync(
      finalStatePath,
      JSON.stringify({
        sessionId,
        projectId,
        requests,
        errors,
        messages: sessionId ? saved(sessionId) : [],
        audits: sessionId ? audit(sessionId) : [],
      }),
    );
    await test.info().attach('context-browser-final-state', {
      path: finalStatePath,
      contentType: 'application/json',
    });
    provider.stdin.end();
    await new Promise<void>((resolve) => {
      if (provider.exitCode !== null) return resolve();
      provider.once('exit', () => resolve());
    });
    if (sessionId) await request.delete(`${apiURL}/v1/sessions/${sessionId}`);
    if (projectId) await request.delete(`${apiURL}/v1/projects/${projectId}`);
    if (agentId) await request.delete(`${apiURL}/v1/agents/${agentId}`);
    if (configId) await request.delete(`${apiURL}/v1/model-configs/${configId}`);
    rmSync(outsidePath, { force: true });
    rmSync(directory, { recursive: true, force: true });
  }
});
