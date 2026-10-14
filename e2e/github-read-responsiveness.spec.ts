import { expect, test } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

type CliEvent = { event: string; epoch: string; kind: string; pid: number; at: number };
type Snapshot = {
  messages: Array<{ role: string; content: string }>;
  audits: Array<{ tool_name: string; status: string }>;
  approvals: Array<{ status: string }>;
};
const apiURL = process.env.API_URL ?? 'http://127.0.0.1:3000';
test.use({ trace: 'on', actionTimeout: 10_000 });
test('GR-T08 Docker: held external GitHub reads do not block approved tool effects or session reads', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const phases: Array<{ phase: string; at: number }> = [];
  const progress = (phase: string) => {
    phases.push({ phase, at: Date.now() });
    writeFileSync(
      test.info().outputPath('github-read-progress.json'),
      JSON.stringify(phases, null, 2),
    );
  };
  progress('fixture-start');
  const container =
    process.env.GITHUB_READ_API_CONTAINER ??
    (process.env.CI
      ? execFileSync('docker', ['compose', 'ps', '-q', 'api'], { encoding: 'utf8' }).trim()
      : '');
  expect(
    container,
    'Provision an isolated stack with docker-compose.github-read-e2e.yml and set GITHUB_READ_API_CONTAINER',
  ).not.toBe('');
  const exec = (args: string[]) =>
    execFileSync('docker', ['exec', container, ...args], { encoding: 'utf8', timeout: 10_000 });
  expect(exec(['printenv', 'AGENT_PLATFORM_GH_BINARY']).trim()).toBe(
    '/opt/github-read-fixture/github-read-cli.mjs',
  );
  const model = `github-read-${randomUUID()}`;
  // A root outside /workspace avoids the tracked Docker host-root/virtual-root overlap.
  const root = `/tmp/${model}`;
  const cliConfig = `${root}/.git/github-read-control.json`;
  const configure = (mode: string, epoch: string) =>
    exec([
      'node',
      '-e',
      'require("node:fs").writeFileSync(process.argv[1],process.argv[2])',
      cliConfig,
      JSON.stringify({ fixture: 'github-read-responsiveness-v1', epoch, mode }),
    ]);
  const release = () => exec(['touch', `${root}/.git/github-read-release-held`]);
  const events = (): CliEvent[] =>
    exec(['cat', `${root}/.git/github-read-events.jsonl`])
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CliEvent)
      .filter((row) => row.epoch === 'held');
  const provider = spawn('docker', [
    'exec',
    '-i',
    container,
    'node',
    '--input-type=module',
    '-e',
    readFileSync('e2e/support/github-read-provider.mjs', 'utf8'),
    model,
  ]);
  const wire: unknown[] = [];
  const errors: string[] = [];
  let ready = false;
  let providerPid: number | undefined;
  let buffered = '';
  provider.stdout.on('data', (chunk: Buffer) => {
    buffered += chunk.toString();
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    for (const line of lines) {
      const row = JSON.parse(line) as {
        kind: string;
        pid?: number;
        body?: unknown;
        message?: string;
      };
      if (row.kind === 'ready') {
        ready = true;
        providerPid = row.pid;
      }
      if (row.kind === 'request') wire.push(row.body);
      if (row.kind === 'error') errors.push(row.message ?? 'provider failed');
    }
  });
  provider.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString()));
  provider.stdin.on('error', (error) => errors.push(error.message));
  let sessionId: string | undefined;
  let projectId: string | undefined;
  let agentId: string | undefined;
  let modelId: string | undefined;
  let primary: unknown;
  const cleanup: unknown[] = [];
  const evidence: Record<string, unknown> = {
    limits: [
      'Real Docker UI/BFF/API/SQLite with external gh/provider doubles; no actual GitHub network or provider billing.',
      'Ordinary Docker diagnostics is intentionally forbidden; successful durable V1 export is required in managed Chromium/Electron.',
      'Tool writes run against a disposable Project root; no VM-isolation or distribution claim.',
    ],
  };
  const snapshot = (): Snapshot =>
    JSON.parse(
      exec([
        'node',
        '--input-type=module',
        '-e',
        `
import { openDatabase } from './packages/db/dist/database.js';
const {sqlite}=openDatabase(process.env.SQLITE_PATH);
try { const id=process.argv[1]; console.log(JSON.stringify({messages:sqlite.prepare('SELECT role,content FROM messages WHERE session_id=? ORDER BY created_at_ms,rowid').all(id),audits:sqlite.prepare('SELECT tool_name,status FROM tool_executions WHERE session_id=? ORDER BY started_at_ms').all(id),approvals:sqlite.prepare('SELECT status FROM approval_requests WHERE session_id=?').all(id)})); } finally {sqlite.close();}
`,
        sessionId!,
      ]),
    ) as Snapshot;
  try {
    await expect.poll(() => ready).toBe(true);
    progress('provider-ready');
    exec(['mkdir', '-p', root]);
    exec(['git', '-C', root, 'init', '-q', '--initial-branch=context-fixture']);
    exec([
      'node',
      '-e',
      'require("node:fs").writeFileSync(process.argv[1],"Owned project\\n")',
      `${root}/README.md`,
    ]);
    exec(['git', '-C', root, 'add', '--', 'README.md']);
    exec([
      'git',
      '-C',
      root,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'Owned fixture',
    ]);
    exec([
      'git',
      '-C',
      root,
      'remote',
      'add',
      'origin',
      'https://github.com/fixture/github-read-owned.git',
    ]);
    configure('healthy', 'setup');
    const create = async (path: string, data: unknown, headers?: Record<string, string>) => {
      const response = await request.post(`${apiURL}/v1/${path}`, { data, headers });
      expect(response.ok()).toBe(true);
      return (await response.json()).data;
    };
    modelId = (
      await create('model-configs', {
        name: model,
        provider: 'ollama',
        model,
        apiKey: 'github-read-fixture-key',
      })
    ).id;
    agentId = (
      await create('agents', {
        name: model,
        systemPrompt: 'Perform the requested disposable Project action.',
        allowedSkillIds: [],
        allowedToolIds: [],
        allowedMcpServerIds: [],
        pluginAllowlist: [],
        modelConfigId: modelId,
        executionLimits: { maxSteps: 6, maxParallelTasks: 1, timeoutMs: 30000 },
      })
    ).id;
    projectId = (
      await create(
        'projects/desktop/register',
        { name: model, path: root },
        { 'x-agent-platform-desktop-bridge': '1' },
      )
    ).project.id;
    sessionId = (await create('sessions', { agentId, mode: 'project', projectId })).id;
    progress('initial-navigation');
    await page.goto(`/?projectId=${projectId}&sessionId=${sessionId}`);
    const input = page.getByPlaceholder('Ask about this Project...');
    await expect(input).toBeEnabled();
    await expect(
      page.getByRole('status').filter({ hasText: 'Press Enter to send, Shift+Enter for new line' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Active agent' })).toContainText(model);
    progress('initial-restoration-complete');
    const submit = input.locator('xpath=ancestor::form').locator('button[type="submit"]');
    await input.fill('/init');
    await expect(input).toHaveValue('/init');
    await expect(submit).toBeEnabled();
    await submit.click();
    await page.getByRole('button', { name: 'Approve instructions' }).click();
    progress('instructions-approved');
    await expect(input).toBeEnabled();
    await input.fill('GH_DOCKER_PROMPT_CANARY write the disposable file.');
    await expect(submit).toBeEnabled();
    await submit.click();
    const card = page.getByTestId('approval-card');
    await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
    const refresh = page.getByRole('button', { name: 'Refresh Project activity', exact: true });
    // Settle the real alternate view before arming the hold. The automatic
    // activity refresh after a tool proposal can disable Refresh before click.
    await page.getByRole('tab', { name: 'Git & GitHub', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Refresh Git state', exact: true }),
    ).toBeEnabled();
    progress('tool-proposal-ready');
    configure('hold', 'held');
    const checksResponse = page.waitForResponse((r) =>
      r.url().endsWith(`/projects/${projectId}/git/checks`),
    );
    const prsResponse = page.waitForResponse((r) =>
      r.url().endsWith(`/projects/${projectId}/github/pull-requests`),
    );
    await page.getByRole('tab', { name: 'Activity', exact: true }).click();
    await expect
      .poll(
        () =>
          new Set(
            events()
              .filter((row) => row.event === 'ready')
              .map((row) => row.kind),
          ),
      )
      .toEqual(new Set(['view', 'list']));
    evidence.ready = { observedAt: Date.now(), events: events() };
    progress('github-children-held');
    const probes = [];
    for (const path of ['/health', `/v1/sessions/${sessionId}`]) {
      const start = performance.now();
      const response = await request.get(`${apiURL}${path}`, { timeout: 1000 });
      const elapsedMs = performance.now() - start;
      expect(response.ok()).toBe(true);
      expect(elapsedMs).toBeLessThan(1000);
      probes.push({ path, elapsedMs });
    }
    await card.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(
      page.getByText('Docker write completed while GitHub waits.', { exact: true }),
    ).toBeVisible();
    expect(exec(['cat', `${root}/gh-effect.txt`])).toBe('GH_DOCKER_EFFECT_CANARY');
    progress('approved-effect-complete');
    const after = snapshot();
    expect(
      after.audits.filter((row) => row.tool_name === 'sys_write_file' && row.status === 'success'),
    ).toHaveLength(1);
    expect(
      after.messages.filter(
        (row) =>
          row.role === 'assistant' && row.content === 'Docker write completed while GitHub waits.',
      ),
    ).toHaveLength(1);
    const denied = page.waitForResponse((r) => r.url().endsWith('/api/diagnostics/report'));
    await page.getByRole('button', { name: 'Export diagnostic report', exact: true }).click();
    expect((await denied).status()).toBe(403);
    progress('export-denied-as-required');
    await expect(
      page.getByRole('status').filter({ hasText: 'Diagnostics could not be exported' }),
    ).toBeVisible();
    expect(events().filter((row) => row.event !== 'ready')).toEqual([]);
    evidence.beforeRelease = {
      observedAt: Date.now(),
      events: events(),
      probes,
      db: after,
      exportStatus: 403,
    };
    progress('held-window-proved');
    release();
    configure('healthy', 'after');
    expect((await (await checksResponse).json()).data).toMatchObject({
      available: true,
      currentBranch: 'context-fixture',
      pullRequestNumber: 71,
      summary: { success: 1 },
    });
    expect((await (await prsResponse).json()).data).toMatchObject({
      available: true,
      pullRequests: [{ number: 71, headRefName: 'context-fixture' }],
    });
    await expect(refresh).toBeEnabled();
    expect(wire).toHaveLength(2);
    expect(errors).toEqual([]);
    evidence.afterRelease = events();
    await page.screenshot({ path: test.info().outputPath('github-read-docker.png') });
  } catch (error) {
    primary = error;
  } finally {
    progress('cleanup');
    const settle = async (action: () => unknown | Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        cleanup.push(error);
      }
    };
    await settle(() => release());
    await settle(() =>
      writeFileSync(
        test.info().outputPath('github-read-docker.json'),
        JSON.stringify(
          {
            ...evidence,
            sessionId,
            projectId,
            wire,
            errors,
            failure: primary instanceof Error ? primary.message : primary,
          },
          null,
          2,
        ),
      ),
    );
    for (const [kind, id] of [
      ['sessions', sessionId],
      ['projects', projectId],
      ['agents', agentId],
      ['model-configs', modelId],
    ]) {
      if (id)
        await settle(async () => {
          const response = await request.delete(`${apiURL}/v1/${kind}/${id}`, { timeout: 10_000 });
          expect(response.ok()).toBe(true);
        });
    }
    provider.stdin.end();
    await settle(async () => {
      await expect.poll(() => provider.exitCode, { timeout: 5000 }).not.toBeNull();
    });
    if (provider.exitCode === null && providerPid) {
      await settle(() =>
        exec([
          'node',
          '-e',
          "const fs=require('node:fs');const pid=Number(process.argv[1]);if(!fs.readFileSync('/proc/'+pid+'/cmdline','utf8').split(String.fromCharCode(0)).includes(process.argv[2]))throw new Error('Owned provider identity changed');process.kill(pid,'SIGTERM');",
          String(providerPid),
          model,
        ]),
      );
      await settle(async () => {
        await expect
          .poll(() => provider.exitCode !== null || provider.signalCode !== null, { timeout: 5000 })
          .toBe(true);
      });
    }
    await settle(() => exec(['rm', '-rf', root]));
  }
  await test.info().attach('github-read-timing', {
    body: Buffer.from(
      JSON.stringify(
        {
          phases,
          ready: evidence.ready,
          heldWindowProved: phases.some(({ phase }) => phase === 'held-window-proved'),
          primaryError: primary instanceof Error ? primary.message.slice(0, 2048) : undefined,
          cleanupErrorCount: cleanup.length,
        },
        null,
        2,
      ),
    ),
    contentType: 'application/json',
  });
  if (primary && cleanup.length === 0) throw primary;
  if (primary || cleanup.length)
    throw new AggregateError(
      [...(primary ? [primary] : []), ...cleanup],
      'GitHub read connected fixture failed',
    );
});
