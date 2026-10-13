import { expect, test } from '@playwright/test';
import type { ElectronApplication } from 'playwright';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { McpServer } from '@agent-platform/contracts';
import {
  createContextTokenFixture,
  createContextTokenAgent,
  launchContextTokenFixture,
  openContextTokenProject,
  readContextTokenApi,
  removeContextTokenFixture,
  sendContextTokenMessage,
  exportContextTokenReport,
  snapshotContextTokenDb,
  snapshotContextTokenDiagnosticStore,
  type ContextTokenFixture,
} from './support/contextTokenFixture.js';
import {
  startContextTokenProvider,
  type ContextTokenProviderReply,
} from './support/contextTokenProvider.js';
import {
  importNativeMcp,
  testNativeMcp,
  assignNativeMcp,
  startMcpHttpFixture,
} from './support/mcpOnboardingFixture.js';

// Import credentials are synthetic but do not capture input contents in traces or videos.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
for (const mode of ['stdio', 'http', 'unknown'] as const) {
  test(`MCP native ${mode}: import, test, assignment, restart and permission-controlled chat`, async () => {
    const info = test.info();
    test.setTimeout(150_000);
    const replies: ContextTokenProviderReply[] = [];
    const provider = await startContextTokenProvider(replies);
    const http = await startMcpHttpFixture();
    let fixture: ContextTokenFixture | undefined;
    let app: ElectronApplication | undefined;
    let sessionId: string | undefined;
    let passed = false;
    const evidence: Record<string, unknown> = {
      mode,
      externalModel: 'deterministic HTTP provider; no paid calls',
    };
    try {
      fixture = await createContextTokenFixture(provider);
      const journal = join(fixture.root, 'native journal.jsonl');
      const control = join(fixture.root, 'control.json');
      writeFileSync(control, JSON.stringify({ lostResponse: mode === 'unknown' }));
      const effects = () =>
        mode === 'http'
          ? http.events.filter((row) => row.event === 'tools/call').length
          : existsSync(journal)
            ? readFileSync(journal, 'utf8')
                .split('\n')
                .filter((line) => line.includes('"event":"effect"')).length
            : 0;
      const savedReports = [join(fixture.root, 'waiting.json'), join(fixture.root, 'final.json')];
      app = await launchContextTokenFixture(fixture, savedReports);
      let page = await app.firstWindow();
      const name = `Native MCP ${mode}`;
      const config =
        mode === 'http'
          ? { transport: 'http', url: http.url, headers: { Authorization: 'Bearer test-value' } }
          : {
              command: process.execPath,
              args: [resolve('../api/test/fixtures/mcp-chat-server.mjs'), journal, control],
              env: { FIXTURE_SECRET: 'test-value' },
            };
      const server = await importNativeMcp(page, fixture, name, config);
      expect(effects()).toBe(0);
      if (mode !== 'http') expect(existsSync(journal)).toBe(false);
      else expect(http.events).toHaveLength(0);
      await testNativeMcp(page, name);
      expect(effects()).toBe(0);
      const agent = await createContextTokenAgent(fixture);
      await assignNativeMcp(page, fixture, agent, server);
      const persisted = await readContextTokenApi<McpServer>(fixture, `mcp-servers/${server.id}`);
      expect(JSON.stringify(persisted)).not.toContain('test-value');
      await app.close();
      app = await launchContextTokenFixture(fixture, savedReports);
      page = await app.firstWindow();
      expect(await readContextTokenApi<McpServer>(fixture, `mcp-servers/${server.id}`)).toEqual(
        persisted,
      );
      const session = await openContextTokenProject(page, fixture, agent);
      sessionId = session.id;
      replies.push({
        kind: 'tools',
        calls: [{ id: 'mcp-native-call', name: `${server.id}__fixture_effect`, args: {} }],
      });
      replies.push(
        mode === 'unknown'
          ? {
              kind: 'tools',
              calls: [{ id: 'would-duplicate', name: `${server.id}__fixture_effect`, args: {} }],
            }
          : { kind: 'text', text: 'MCP native action complete.' },
      );
      await sendContextTokenMessage(page, 'Perform one disposable MCP fixture action.');
      await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
      expect(effects()).toBe(0);
      const waiting = await exportContextTokenReport(page, savedReports[0]!, [
        fixture.root,
        'test-value',
      ]);
      expect(waiting.events.some((row) => row.event.outcome === 'waiting')).toBe(true);
      copyFileSync(savedReports[0]!, info.outputPath('waiting-diagnostics.json'));
      await page.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(
        page
          .getByText(
            mode === 'unknown'
              ? 'The MCP call may have taken effect, but its result could not be confirmed. Inspect the server before starting a new request. This turn will not retry the action.'
              : 'MCP native action complete.',
            { exact: true },
          )
          .last(),
      ).toBeVisible();
      await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
      expect(effects()).toBe(1);
      expect(provider.requests).toHaveLength(mode === 'unknown' ? 1 : 2);
      expect(provider.errors).toHaveLength(0);
      expect(
        provider.requests[0]!.tools?.some(
          (tool) => tool.function.name === `${server.id}__fixture_effect`,
        ),
      ).toBe(true);
      expect(
        provider.requests[0]!.tools?.some((tool) => tool.function.name === `${server.id}__bash`),
      ).toBe(false);
      const report = await exportContextTokenReport(page, savedReports[1]!, [
        fixture.root,
        'test-value',
      ]);
      expect(report.scope).toEqual({ sessionId });
      expect(
        report.events.some(
          (row) =>
            row.event.phase === 'tool' && ['succeeded', 'failed'].includes(row.event.outcome),
        ),
      ).toBe(true);
      copyFileSync(savedReports[1]!, info.outputPath('final-diagnostics.json'));
      evidence.sessionId = sessionId;
      evidence.effects = effects();
      evidence.providerRequests = provider.requests.length;
      evidence.db = snapshotContextTokenDb(fixture, sessionId);
      evidence.diagnosticCoverage = report.coverage;
      await page.screenshot({ path: info.outputPath('terminal.png') });
      passed = true;
    } finally {
      const captureErrors: string[] = [];
      // Evidence failures must neither mask the test failure nor prevent cleanup.
      const attempt = async (label: string, action: () => unknown | Promise<unknown>) => {
        try {
          await action();
        } catch {
          captureErrors.push(label);
        }
      };
      evidence.passed = passed;
      evidence.providerRequests = provider.requests.length;
      evidence.providerErrors = provider.errors;
      try {
        if (app && fixture && sessionId) {
          const activeApp = app;
          const activeFixture = fixture;
          const activeSessionId = sessionId;
          await attempt('visible-state', async () => {
            const page = await activeApp.firstWindow();
            evidence.visibleState = (await page.locator('body').innerText())
              .split(activeFixture.root)
              .join('[fixture]');
          });
          await attempt('native-report-transport', async () => {
            evidence.nativeReportTransport = await activeApp.evaluate(
              () =>
                (
                  globalThis as typeof globalThis & {
                    __contextTokenNativeTransport?: Array<{
                      status?: number;
                      errorName?: string;
                      errorCode?: string;
                    }>;
                  }
                ).__contextTokenNativeTransport ?? [],
            );
          });
          await attempt('diagnostics', async () => {
            const page = await activeApp.firstWindow();
            evidence.diagnostics = await page.evaluate(async (id) => {
              const response = await fetch('/api/diagnostics/report', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: { sessionId: id } }),
              });
              return { status: response.status, body: await response.json() };
            }, activeSessionId);
          });
          await attempt('screenshot', async () => {
            const page = await activeApp.firstWindow();
            await page.screenshot({ path: info.outputPath('terminal.png') });
          });
        }
        if (fixture && sessionId) {
          const activeFixture = fixture;
          const activeSessionId = sessionId;
          await attempt('diagnostic-store', () => {
            evidence.liveDiagnosticStore = snapshotContextTokenDiagnosticStore(
              activeFixture,
              activeSessionId,
            );
          });
          await attempt('database', () => {
            evidence.finalDb = snapshotContextTokenDb(activeFixture, activeSessionId);
          });
        }
      } finally {
        if (app) await attempt('app-close', () => app!.close());
        await attempt('http-close', () => http.close());
        await attempt('provider-close', () => provider.close());
        if (fixture) await attempt('fixture-remove', () => removeContextTokenFixture(fixture!));
      }
      evidence.captureOrCleanupErrors = captureErrors;
      await attempt('evidence-write', () =>
        writeFileSync(info.outputPath('mcp-evidence.json'), JSON.stringify(evidence, null, 2)),
      );
      await attempt('evidence-attach', () =>
        info.attach('mcp-evidence', {
          path: info.outputPath('mcp-evidence.json'),
          contentType: 'application/json',
        }),
      );
      // A successful journey still requires its evidence and cleanup to succeed.
      if (passed) expect(captureErrors).toEqual([]);
    }
  });
}
