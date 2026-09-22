import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

import { JOURNEY_CALL_ID, JOURNEY_MODEL, startJourneyProvider } from './support/providerJourney.js';
import { getOpenPort } from './support/runtime.js';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = process.env.AGENT_PLATFORM_E2E_GIT_BINARY ?? '/usr/bin/git';
const HOST_ONLY_CANARY_ENV = 'HOST_ONLY_CANARY';
const HOST_ONLY_CANARY_VALUE = ['host', 'only', 'packaged', 'vm', 'e2e', 'canary'].join('-');
const VM_E2E_MARKER_COMMAND = 'pwd';
const JOURNEY_COMMAND = "printf 'approved change\\n' >> journey.txt";
const JOURNEY_BEFORE = 'original content\n';
const JOURNEY_AFTER = `${JOURNEY_BEFORE}approved change\n`;
const JOURNEY_FINAL = 'Evaluation turn finished';
const E2E_SECRETS_MASTER_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

type VmFixtureHealth = 'ready' | 'failed';

type VmFixture = {
  backendPort: number;
  evidenceDir?: string;
  heartbeatTimer?: NodeJS.Timeout;
  projectDir: string;
  realVmRuntimeDir?: string;
  rendererPort: number;
  resourcesDir: string;
  runtimeDir: string;
  tempRoot: string;
};

test.describe('packaged Electron macOS VM command runner', () => {
  test('runs approved Project shell commands in the packaged VM workspace', async () => {
    const fixture = await createVmFixture({ health: 'ready' });
    let app: ElectronApplication | undefined;

    try {
      app = await launchVmFixture(fixture);
      const page = await app.firstWindow();
      await openProject(page);
      const realVmStatus = fixture.realVmRuntimeDir ? startRealVmRunner(fixture) : undefined;

      await expect(page.getByLabel('Project command status: Commands ready')).toBeVisible({
        timeout: 15_000,
      });
      await sendChatMessage(page, '/help init');
      await expect(page.getByText('Usage: /init').last()).toBeVisible();
      await expect(page.getByText('Scope: Selected Project').last()).toBeVisible();

      await sendChatMessage(page, 'Show the VM working directory');
      await expect(page.getByTestId('approval-card')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Approve' }).click();

      const toolActivity = await openToolActivity(page);
      await expect(toolActivity.getByText('Run terminal command').first()).toBeVisible();
      await expect(toolActivity.getByText('Completed').first()).toBeVisible();
      await toolActivity.getByText('Technical details').first().click();
      await expectVmWorkspaceOutput(toolActivity);
      await expect(page.getByText(fixture.projectDir)).toHaveCount(0);
      await expect(page.getByText(HOST_ONLY_CANARY_VALUE)).toHaveCount(0);
      writeVmEvidence(fixture, 'success', realVmStatus);
    } finally {
      await app?.close();
      stopRealVmRunner(fixture);
      if (fixture.heartbeatTimer) clearInterval(fixture.heartbeatTimer);
      rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
  });

  test('fails closed visibly when packaged VM runtime is unhealthy', async () => {
    const fixture = await createVmFixture({ health: 'failed' });
    let app: ElectronApplication | undefined;

    try {
      app = await launchVmFixture(fixture, { finalText: 'VM command failed closed' });
      const page = await app.firstWindow();
      await openProject(page);

      await expect(page.getByLabel('Project command status: Commands unavailable')).toBeVisible({
        timeout: 15_000,
      });
      await sendChatMessage(page, 'Show the VM working directory');
      await expect(page.getByTestId('approval-card')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Approve' }).click();

      const toolActivity = await openToolActivity(page);
      await expect(toolActivity.getByText('Command runner unavailable').first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(toolActivity.getByText('Failed').first()).toBeVisible();
      await expect(toolActivity.getByText('E2E VM unavailable').first()).toBeVisible();
      await expect(page.getByText(`HOST_CWD:${fixture.projectDir}`)).toHaveCount(0);
      await expect(page.getByText(HOST_ONLY_CANARY_VALUE)).toHaveCount(0);
    } finally {
      await app?.close();
      if (fixture.heartbeatTimer) clearInterval(fixture.heartbeatTimer);
      rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
  });
});

const journeyCases = (['node-double', 'provider-http'] as const).flatMap((reasoning) =>
  (['approve', 'reject'] as const).flatMap((decision) =>
    (reasoning === 'provider-http' ? [false, true] : [false]).map((reload) => ({
      reasoning,
      decision,
      reload,
      failFirst: false,
    })),
  ),
);
journeyCases.push({
  reasoning: 'provider-http',
  decision: 'approve',
  reload: false,
  failFirst: true,
});
for (const { reasoning, decision, reload, failFirst } of journeyCases) {
  test(`Project Chat disposable edit: ${decision} with backend evidence (${reasoning}${reload ? ', reload recovery' : ''}${failFirst ? ', transient retry' : ''})`, async () => {
    const fixture = await createVmFixture({ health: 'ready' });
    const file = join(fixture.projectDir, 'journey.txt');
    writeFileSync(file, JOURNEY_BEFORE);
    const provider =
      reasoning === 'provider-http'
        ? await startJourneyProvider(JOURNEY_COMMAND, JOURNEY_FINAL, { failFirst })
        : undefined;
    let app: ElectronApplication | undefined;
    let approval: ApprovalEvidence | undefined;
    let audits: AuditEvidence[] = [];
    const duplicateResumes: Array<{ status: number; body: unknown }> = [];
    let messages: Array<{ role: string; content: string }> = [];
    const streams: Array<{ status: number; events: unknown[] }> = [];
    const captures: Promise<void>[] = [];
    const milestones: Array<{ event: string; at: string }> = [];
    const mark = (event: string) => milestones.push({ event, at: new Date().toISOString() });
    let tracing = false;
    try {
      app = await launchVmFixture(fixture, {
        command: JOURNEY_COMMAND,
        finalText: JOURNEY_FINAL,
        providerURL: provider?.baseURL,
      });
      if (provider) {
        await expect
          .poll(
            async () => {
              try {
                return (await fetch(`http://127.0.0.1:${fixture.backendPort}/health/ready`)).ok;
              } catch {
                return false;
              }
            },
            { timeout: 20000 },
          )
          .toBe(true);
        const configs = await readEvidence<{ id: string }>(fixture, 'model-configs');
        expect(configs).toHaveLength(1);
        const configured = await fetch(
          `http://127.0.0.1:${fixture.backendPort}/v1/model-configs/${configs[0]!.id}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider: 'ollama', model: JOURNEY_MODEL }),
          },
        );
        expect(configured.ok).toBe(true);
      }
      await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
      tracing = true;
      const page = await app.firstWindow();
      page.on('response', (response) => {
        if (!response.headers()['content-type']?.includes('application/x-ndjson')) return;
        captures.push(
          response
            .text()
            .then((body) => {
              const events = body
                .split('\n')
                .filter(Boolean)
                .map((line) => {
                  try {
                    return JSON.parse(line) as unknown;
                  } catch {
                    return { type: 'unparsed_event' };
                  }
                });
              streams.push({ status: response.status(), events });
            })
            .catch(() => {
              streams.push({ status: response.status(), events: [{ type: 'capture_failed' }] });
            }),
        );
      });
      await openProject(page);
      if (fixture.realVmRuntimeDir) startRealVmRunner(fixture);
      await sendChatMessage(page, '/init');
      await expect(page.getByRole('button', { name: 'Approve instructions' })).toBeVisible();
      await page.getByRole('button', { name: 'Approve instructions' }).click();
      await expect(page.getByText('Project instructions approved').last()).toBeVisible();
      mark('project_onboarding_approved');
      await sendChatMessage(page, 'Append one line saying approved change to journey.txt.');
      const card = page.getByTestId('approval-card').last();
      await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
      expect(readFileSync(file, 'utf8')).toBe(JOURNEY_BEFORE);
      const pending = await readEvidence<ApprovalEvidence>(fixture, 'approval-requests');
      approval = pending.find((row) => row.toolName === 'sys_bash');
      expect(approval?.status).toBe('pending');
      if (provider) {
        expect(provider.requests).toHaveLength(1);
        expect(provider.requests[0]?.messages.some((m) => m.role === 'tool')).toBe(false);
      }
      mark('approval_pending_file_unchanged');
      if (reload) {
        await Promise.all(captures);
        await page.reload();
        await expect(card.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
        const restored = (await readEvidence<ApprovalEvidence>(fixture, 'approval-requests')).find(
          (row) => row.id === approval?.id,
        );
        expect(restored).toEqual(approval);
        expect(readFileSync(file, 'utf8')).toBe(JOURNEY_BEFORE);
        expect(provider?.requests).toHaveLength(1);
        mark('pending_approval_restored_after_reload');
      }
      await card
        .getByRole('button', { name: decision === 'approve' ? 'Approve' : 'Deny', exact: true })
        .click();
      await expect(card).toContainText(
        decision === 'approve' ? 'Approved action completed' : 'Denied',
        { timeout: 20_000 },
      );
      await Promise.all(captures);
      approval = (await readEvidence<ApprovalEvidence>(fixture, 'approval-requests')).find(
        (row) => row.id === approval?.id,
      );
      audits = (await readEvidence<AuditEvidence>(fixture, 'tool-executions')).filter(
        (row) => row.sessionId === approval?.sessionId && row.toolName === 'sys_bash',
      );
      expect(approval?.status).toBe(decision === 'approve' ? 'approved' : 'rejected');
      expect(approval?.resumedAtMs).toEqual(expect.any(Number));
      expect(readFileSync(file, 'utf8')).toBe(
        decision === 'approve' ? JOURNEY_AFTER : JOURNEY_BEFORE,
      );
      const successes = audits.filter((row) => row.status === 'success');
      expect(successes).toHaveLength(decision === 'approve' ? 1 : 0);
      if (decision === 'reject') expect(audits.some((row) => row.status === 'denied')).toBe(true);
      await Promise.all(captures);
      const events = streams.flatMap((stream) => stream.events);
      const hasEvent = (type: string, code?: string) =>
        events.some((event) => {
          if (typeof event !== 'object' || event === null) return false;
          const row = event as { type?: string; code?: string };
          return row.type === type && (code === undefined || row.code === code);
        });
      expect(hasEvent('approval_required')).toBe(true);
      expect(
        hasEvent(
          decision === 'approve' ? 'tool_result' : 'error',
          decision === 'reject' ? 'APPROVAL_REJECTED' : undefined,
        ),
      ).toBe(true);
      await expect
        .poll(
          () =>
            readBackendEvents(fixture).filter(
              (row) => row.sessionId === approval?.sessionId && row.kind === 'task_end',
            ).length,
        )
        .toBe(2);
      const lifecycle = readBackendEvents(fixture).filter(
        (row) => row.sessionId === approval?.sessionId,
      );
      const starts = lifecycle.filter((row) => row.kind === 'task_start');
      expect(starts).toHaveLength(2);
      expect(new Set(starts.map((row) => row.runId)).size).toBe(2);
      for (const start of starts) {
        expect(start.runId).toEqual(expect.any(String));
        expect(start.correlationId).toEqual(expect.any(String));
        const ends = lifecycle.filter(
          (row) => row.kind === 'task_end' && row.runId === start.runId,
        );
        expect(ends).toHaveLength(1);
        expect(ends[0]?.correlationId).toBe(start.correlationId);
        expect(Number.isFinite(Date.parse(start.at ?? ''))).toBe(true);
        expect(Date.parse(ends[0]?.at ?? '')).toBeGreaterThanOrEqual(Date.parse(start.at!));
      }
      if (provider) {
        expect(provider.errors).toEqual([]);
        expect(provider.attempts.map((attempt) => attempt.status)).toEqual(
          failFirst ? [503, 200, 200] : [200, 200],
        );
        expect(provider.requests).toHaveLength(2);
        const result = provider.requests[1]?.messages.find(
          (m) => m.role === 'tool' && m.tool_call_id === JOURNEY_CALL_ID,
        );
        expect(result).toBeDefined();
        await expect(page.getByText(JOURNEY_FINAL).last()).toBeVisible();
        messages = await readEvidence<{ role: string; content: string }>(
          fixture,
          `sessions/${approval!.sessionId}/messages`,
        );
        expect(
          messages.filter((m) => m.role === 'assistant' && m.content === JOURNEY_FINAL),
        ).toHaveLength(1);
        expect(JSON.stringify(result?.content)).toContain(
          decision === 'reject' ? 'APPROVAL_REJECTED' : 'The command completed successfully.',
        );
      }
      if (reload) {
        const messagesBefore = messages;
        const auditsBefore = audits;
        await Promise.all(
          [0, 1].map(async () => {
            const response = await fetch(
              `http://127.0.0.1:${fixture.backendPort}/v1/sessions/${approval!.sessionId}/resume`,
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ approvalRequestId: approval!.id }),
                signal: AbortSignal.timeout(5_000),
              },
            );
            const body = (await response.json()) as { data?: ApprovalEvidence };
            duplicateResumes.push({ status: response.status, body });
            expect(response.status).toBe(200);
            expect(body.data?.id).toBe(approval!.id);
            expect(body.data?.resumedAtMs).toBe(approval!.resumedAtMs);
          }),
        );
        messages = await readEvidence(fixture, `sessions/${approval!.sessionId}/messages`);
        audits = (await readEvidence<AuditEvidence>(fixture, 'tool-executions')).filter(
          (row) => row.sessionId === approval!.sessionId && row.toolName === 'sys_bash',
        );
        expect(messages).toEqual(messagesBefore);
        expect(audits).toEqual(auditsBefore);
        expect(provider?.requests).toHaveLength(2);
        expect(readFileSync(file, 'utf8')).toBe(
          decision === 'approve' ? JOURNEY_AFTER : JOURNEY_BEFORE,
        );
        mark('duplicate_completed_resumes_no_new_effect');
      }
      mark('turn_settled_file_and_audit_verified');
    } finally {
      // Snapshot durable evidence even when a UI assertion fails; never repair or manufacture it.
      approval =
        (await readEvidence<ApprovalEvidence>(fixture, 'approval-requests').catch(() => [])).find(
          (row) => row.toolName === 'sys_bash',
        ) ?? approval;
      audits = (
        await readEvidence<AuditEvidence>(fixture, 'tool-executions').catch(() => audits)
      ).filter((row) => row.toolName === 'sys_bash');
      if (app && tracing) {
        const tracePath = test.info().outputPath('journey-trace.zip');
        await app.context().tracing.stop({ path: tracePath });
        await test
          .info()
          .attach('journey-browser-trace', { path: tracePath, contentType: 'application/zip' });
      }
      await app?.close();
      await provider?.close();
      await Promise.all(captures);
      stopRealVmRunner(fixture);
      if (fixture.heartbeatTimer) clearInterval(fixture.heartbeatTimer);
      try {
        const backendEvents = readBackendEvents(fixture);
        const evaluation = {
          decision,
          reasoning,
          reload,
          duplicateResumes,
          sourceRevision: execFileSync(GIT_BINARY, ['rev-parse', 'HEAD'], {
            cwd: repoRoot,
            encoding: 'utf8',
          }).trim(),
          providerRequests: provider?.requests,
          providerErrors: provider?.errors,
          providerAttempts: provider?.attempts,
          failFirst,
          messages,
          passed: milestones.some(
            (entry) => entry.event === 'turn_settled_file_and_audit_verified',
          ),
          executionMode: `${reasoning}-${fixture.realVmRuntimeDir ? 'real-vm' : 'fixture-runner'}`,
          before: JOURNEY_BEFORE,
          after: existsSync(file) ? readFileSync(file, 'utf8') : null,
          approval,
          audits,
          milestones,
          backendEvents,
          streams,
          limitations: [
            provider
              ? 'Real provider factory, SDK and reasoning; HTTP responses scripted. Ordinary chat excludes evaluator nodes.'
              : 'Model reasoning node is deterministic; evaluator nodes are disabled by existing E2E mode.',
            'Default runner is a fixed-command test double, not VM isolation evidence.',
            'Internal harness graph trace is not exported as a complete durable span timeline.',
            'Resume may use a new run identifier; approval/session identifiers link the phases.',
          ],
        };
        const evidencePath = test.info().outputPath('journey-evaluation.json');
        writeFileSync(
          evidencePath,
          JSON.stringify(evaluation, null, 2).replaceAll(fixture.tempRoot, '<disposable-root>'),
        );
        await test
          .info()
          .attach('journey-evaluation', { path: evidencePath, contentType: 'application/json' });
        await test.info().attach('journey-summary', {
          body: Buffer.from(
            [
              `# Project Chat ${decision} evaluation`,
              `Result: ${evaluation.passed ? 'PASS' : 'FAIL — inspect evidence and Playwright trace'}`,
              `Mode: ${evaluation.executionMode}`,
              `Backend events captured: ${backendEvents.length}`,
              `Durable approval: ${approval?.status ?? 'unavailable'}`,
              `Tool audit records: ${audits.length}`,
              ...evaluation.limitations,
            ].join('\n\n'),
          ),
          contentType: 'text/markdown',
        });
      } finally {
        rmSync(fixture.tempRoot, { recursive: true, force: true });
      }
    }
  });
}

type ApprovalEvidence = {
  id: string;
  sessionId: string;
  runId: string;
  toolName: string;
  status: string;
  resumedAtMs?: number | null;
};
type AuditEvidence = { id: string; sessionId: string; toolName: string; status: string };

async function readEvidence<T>(fixture: VmFixture, resource: string): Promise<T[]> {
  const response = await fetch(`http://127.0.0.1:${fixture.backendPort}/v1/${resource}?limit=100`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Evidence request failed: ${response.status}`);
  return ((await response.json()) as { data: T[] }).data;
}

function readBackendEvents(fixture: VmFixture) {
  const file = join(fixture.runtimeDir, 'logs', 'backend.stdout.log');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line) => {
      try {
        const row = JSON.parse(line) as {
          ts?: string;
          level?: string;
          service?: string;
          correlationId?: string;
          event?: { kind?: string; sessionId?: string; runId?: string; toolId?: string };
        };
        if (!row.event) return [];
        return [
          {
            at: row.ts,
            level: row.level,
            service: row.service,
            correlationId: row.correlationId,
            kind: row.event.kind,
            sessionId: row.event.sessionId,
            runId: row.event.runId,
            toolId: row.event.toolId,
          },
        ];
      } catch {
        return [];
      }
    });
}

async function createVmFixture(options: { health: VmFixtureHealth }): Promise<VmFixture> {
  const tempRoot = mkdtempSync(join(tmpdir(), 'agent-platform-electron-vm-e2e-'));
  const runtimeDir = join(tempRoot, 'runtime');
  const fixtureResourcesDir = join(tempRoot, 'resources');
  const evidenceDir = process.env.AGENT_PLATFORM_E2E_EVIDENCE_DIR;
  const projectDir = join(tempRoot, 'client', 'packaged-vm-project');
  const sqlitePath = join(runtimeDir, 'data', 'agent.sqlite');
  const backendPort = await getOpenPort();
  const rendererPort = await getOpenPort();
  const realPackagedResourcesDir =
    options.health === 'ready'
      ? process.env.AGENT_PLATFORM_E2E_PACKAGED_VM_RESOURCES_DIR
      : undefined;
  const resourcesDir = realPackagedResourcesDir ?? fixtureResourcesDir;

  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'README.md'), '# Packaged VM E2E Project\n');
  execFileSync(GIT_BINARY, ['init', '-b', 'main'], { cwd: projectDir, stdio: 'ignore' });
  execFileSync(GIT_BINARY, ['config', 'user.email', 'e2e@example.com'], {
    cwd: projectDir,
    stdio: 'ignore',
  });
  execFileSync(GIT_BINARY, ['config', 'user.name', 'Electron E2E'], {
    cwd: projectDir,
    stdio: 'ignore',
  });
  execFileSync(GIT_BINARY, ['add', 'README.md'], { cwd: projectDir, stdio: 'ignore' });
  execFileSync(GIT_BINARY, ['commit', '-m', 'initial'], { cwd: projectDir, stdio: 'ignore' });

  if (realPackagedResourcesDir) {
    assertPackagedResources(realPackagedResourcesDir);
  } else {
    writePackagedVmResources(resourcesDir, options.health);
  }
  const realVmRuntimeDir = realPackagedResourcesDir ? join(runtimeDir, 'data', 'vm') : undefined;
  const heartbeatTimer = realPackagedResourcesDir
    ? undefined
    : writeRuntimeHealth(runtimeDir, options.health);
  seedDesktopDatabase(sqlitePath);

  return {
    backendPort,
    evidenceDir,
    heartbeatTimer,
    projectDir,
    realVmRuntimeDir,
    rendererPort,
    resourcesDir,
    runtimeDir,
    tempRoot,
  };
}

async function launchVmFixture(
  fixture: VmFixture,
  options: { finalText?: string; command?: string; providerURL?: string } = {},
): Promise<ElectronApplication> {
  return electron.launch({
    cwd: desktopDir,
    args: ['.'],
    env: {
      ...process.env,
      AGENT_OPENAI_API_KEY: 'sk-test-key',
      AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
      AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(fixture.backendPort),
      AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
      AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
      AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(fixture.rendererPort),
      AGENT_PLATFORM_DESKTOP_RESOURCES_DIR: fixture.resourcesDir,
      AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: fixture.runtimeDir,
      AGENT_PLATFORM_DESKTOP_LOG_DIR: join(fixture.runtimeDir, 'logs'),
      AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(fixture.runtimeDir, 'tmp'),
      AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([fixture.projectDir]),
      AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: options.providerURL
        ? ''
        : (options.finalText ?? 'VM command complete'),
      AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: options.providerURL
        ? ''
        : JSON.stringify({
            name: 'sys_bash',
            args: { command: options.command ?? VM_E2E_MARKER_COMMAND },
          }),
      ...(options.providerURL
        ? {
            OLLAMA_BASE_URL: options.providerURL,
            NODE_OPTIONS: `--require=${join(desktopDir, 'e2e/support/provider-network-guard.cjs')}`,
            AGENT_ANTHROPIC_API_KEY: '',
            OPENAI_API_KEY: '',
            ANTHROPIC_API_KEY: '',
          }
        : {}),
      SECRETS_MASTER_KEY: E2E_SECRETS_MASTER_KEY,
      [HOST_ONLY_CANARY_ENV]: HOST_ONLY_CANARY_VALUE,
      ...(process.env.CI ? { CI: process.env.CI } : {}),
    },
  });
}

async function openProject(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Open folder' }).click();
  await expect(page.locator('[data-workspace-surface="project-chat"]')).toBeVisible();
}

async function sendChatMessage(page: Page, message: string): Promise<void> {
  const input = page.getByPlaceholder('Ask about this Project...');
  await input.fill(message);
  await input.press('Enter');
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible();
}

async function expectVmWorkspaceOutput(toolActivity: ReturnType<Page['locator']>): Promise<void> {
  await expect
    .poll(
      async () => {
        const text = await toolActivity.textContent();
        return text?.includes('VM_CWD:/workspace') || text?.includes('/workspace') || false;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

async function openToolActivity(page: Page) {
  const toolActivity = page.locator('details').filter({ hasText: 'Tool activity' }).first();
  await expect(toolActivity).toBeVisible({ timeout: 20_000 });
  const isOpen = await toolActivity.evaluate((element) => element.hasAttribute('open'));
  if (!isOpen) {
    await toolActivity.locator('summary').first().click();
  }
  return toolActivity;
}

function writePackagedVmResources(resourcesDir: string, health: VmFixtureHealth): void {
  const vmDir = join(resourcesDir, 'macos-vm');
  const imagesDir = join(vmDir, 'images');
  mkdirSync(imagesDir, { recursive: true });
  writeFileSync(join(imagesDir, 'base-linux.img'), 'image');
  writeFileSync(join(imagesDir, 'vmlinuz'), 'kernel');
  writeFileSync(join(imagesDir, 'initrd.img'), 'initrd');
  writeFileSync(join(imagesDir, 'guest-bootstrap.sh'), '#!/bin/sh\n');
  writeFileSync(
    join(imagesDir, 'manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        architecture: 'arm64',
        imageFormat: 'raw',
        image: 'base-linux.img',
        imageSha256: sha256('image'),
        boot: {
          loader: 'linux',
          kernel: 'vmlinuz',
          kernelSha256: sha256('kernel'),
          initrd: 'initrd.img',
          initrdSha256: sha256('initrd'),
          commandLine: 'console=hvc0 root=/dev/vda rw systemd.unit=multi-user.target',
        },
        bootstrap: 'guest-bootstrap.sh',
        bootstrapSha256: sha256('#!/bin/sh\n'),
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(vmDir, 'macos-vm-runner'),
    [
      `#!${process.execPath}`,
      'const args = process.argv.slice(2);',
      "const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';",
      "const command = args.slice(args.indexOf('--') + 1).join(' ');",
      health === 'failed' ? 'if (true) {' : 'if (false) {',
      "  console.log(JSON.stringify({ ok: false, mode: 'macos-vm', state: 'unavailable', message: 'E2E VM unavailable' }));",
      '  process.exit(0);',
      '}',
      `if (args[0] === 'exec' && command === ${JSON.stringify(JOURNEY_COMMAND.replace('journey.txt', '/workspace/journey.txt'))}) {`,
      "  const fs = require('node:fs');",
      "  const path = require('node:path');",
      "  fs.appendFileSync(path.join(option('--workspace'), 'journey.txt'), 'approved change\\n');",
      '}',
      'console.log(JSON.stringify({',
      '  ok: true,',
      "  mode: 'macos-vm',",
      "  state: 'ready',",
      "  message: 'E2E VM ready',",
      '  exitCode: 0,',
      "  stdout: `VM_CWD:/workspace\\nVM_COMMAND:${command}\\nVM_WORKSPACE:${option('--workspace') ? '/workspace' : 'missing'}\\nVM_SECRET_MISSING:true\\n`,",
      "  stderr: '',",
      '  durationMs: 7,',
      '}));',
      '',
    ].join('\n'),
  );
  chmodSync(join(vmDir, 'macos-vm-runner'), 0o755);
}

function assertPackagedResources(resourcesDir: string): void {
  const required = [
    join(resourcesDir, 'macos-vm', 'macos-vm-runner'),
    join(resourcesDir, 'macos-vm', 'package-manifest.json'),
    join(resourcesDir, 'macos-vm', 'images', 'manifest.json'),
  ];
  for (const path of required) {
    if (!existsSync(path)) {
      throw new Error(`Packaged macOS VM resource is missing: ${path}`);
    }
  }
}

function startRealVmRunner(fixture: VmFixture): unknown {
  if (!fixture.realVmRuntimeDir) return undefined;
  const helperPath = join(fixture.resourcesDir, 'macos-vm', 'macos-vm-runner');
  const status = execFileSync(
    helperPath,
    ['start', '--runtime-dir', fixture.realVmRuntimeDir, '--workspace', fixture.projectDir],
    { encoding: 'utf8', timeout: 90_000 },
  );
  const parsed = JSON.parse(status) as { ok?: boolean; message?: string; state?: string };
  if (!parsed.ok || parsed.state !== 'ready') {
    throw new Error(`macOS VM runner did not start: ${status}`);
  }
  return parsed;
}

function stopRealVmRunner(fixture: VmFixture): void {
  if (!fixture.realVmRuntimeDir) return;
  const helperPath = join(fixture.resourcesDir, 'macos-vm', 'macos-vm-runner');
  try {
    execFileSync(helperPath, ['stop', '--runtime-dir', fixture.realVmRuntimeDir], {
      encoding: 'utf8',
      timeout: 20_000,
    });
  } catch {
    // Best-effort cleanup; the test has already captured the relevant failure.
  }
}

function writeVmEvidence(fixture: VmFixture, scenario: string, runnerStatus: unknown): void {
  if (!fixture.evidenceDir) return;
  mkdirSync(fixture.evidenceDir, { recursive: true });
  const packageManifestPath = join(fixture.resourcesDir, 'macos-vm', 'package-manifest.json');
  const assetManifestPath = join(fixture.resourcesDir, 'macos-vm', 'images', 'manifest.json');
  writeFileSync(
    join(fixture.evidenceDir, `${scenario}.json`),
    `${JSON.stringify(
      {
        scenario,
        commandRunner: 'macos-vm',
        projectPathVisibleToUser: false,
        hostSecretVisibleToUser: false,
        packageManifest: JSON.parse(readFileSync(packageManifestPath, 'utf8')),
        assetManifest: JSON.parse(readFileSync(assetManifestPath, 'utf8')),
        runnerStatus,
      },
      null,
      2,
    )}\n`,
  );
}

function writeRuntimeHealth(
  runtimeDir: string,
  health: VmFixtureHealth,
): NodeJS.Timeout | undefined {
  const vmRuntimeDir = join(runtimeDir, 'data', 'vm');
  const stateDir = join(vmRuntimeDir, 'state');
  const logsDir = join(vmRuntimeDir, 'logs');
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  if (health === 'ready') {
    writeFileSync(join(stateDir, 'runner.sock'), '');
    writeFileSync(join(stateDir, 'daemon.pid'), `${process.pid}\n`);
    const heartbeatPath = join(stateDir, 'daemon.heartbeat');
    writeFileSync(heartbeatPath, `${Date.now()}\n`);
    const timer = setInterval(() => {
      writeFileSync(heartbeatPath, `${Date.now()}\n`);
    }, 1_000);
    timer.unref();
    return timer;
  }
  writeFileSync(join(logsDir, 'last-error.log'), 'E2E VM unavailable');
  return undefined;
}

function seedDesktopDatabase(sqlitePath: string): void {
  mkdirSync(dirname(sqlitePath), { recursive: true });
  const seedPath = join(repoRoot, 'packages/db/dist/seed/run.js');
  try {
    execFileSync(process.execPath, [seedPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        SQLITE_PATH: sqlitePath,
        E2E_SEED: '1',
        SECRETS_MASTER_KEY: E2E_SECRETS_MASTER_KEY,
      },
      stdio: 'pipe',
    });
  } catch (error) {
    throw new Error(
      [
        `Failed to seed packaged VM E2E database: ${sqlitePath}`,
        `Seed script: ${seedPath}`,
        execFileErrorDetails(error),
      ].join('\n'),
    );
  }
}

function execFileErrorDetails(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const details: string[] = [error.message];
  const maybeProcessError = error as Error & {
    readonly status?: number;
    readonly signal?: NodeJS.Signals;
    readonly stdout?: string | Buffer;
    readonly stderr?: string | Buffer;
  };
  if (maybeProcessError.status !== undefined) details.push(`status: ${maybeProcessError.status}`);
  if (maybeProcessError.signal) details.push(`signal: ${maybeProcessError.signal}`);
  const stdout = outputToString(maybeProcessError.stdout).trim();
  const stderr = outputToString(maybeProcessError.stderr).trim();
  if (stdout) details.push(`stdout:\n${stdout}`);
  if (stderr) details.push(`stderr:\n${stderr}`);
  return details.join('\n');
}

function outputToString(output: string | Buffer | undefined): string {
  if (output === undefined) return '';
  return typeof output === 'string' ? output : output.toString('utf8');
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
