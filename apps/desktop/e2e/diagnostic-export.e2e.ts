import { expect, test } from '@playwright/test';
import {
  _electron as electron,
  chromium,
  type ElectronApplication,
  type Browser,
} from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DiagnosticHealthSchema } from '@agent-platform/contracts';
import { getOpenPort, seedDesktopDatabase } from './support/runtime.js';
const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');

test('local diagnostics export connects real browser, BFF, API, SQLite and native Save As', async () => {
  const testInfo = test.info();
  test.setTimeout(120_000);
  const tempRoot = join(repoRoot, '.agent-platform', 'diagnostic-export-e2e', String(Date.now()));
  const runtimeDir = join(tempRoot, 'runtime');
  const destination = join(tempRoot, 'saved-report.json');
  const partialDestination = join(tempRoot, 'partial-report.json');
  const browserDestination = join(tempRoot, 'browser-report.json');
  const restartedDestination = join(tempRoot, 'restarted-report.json');
  mkdirSync(tempRoot, { recursive: true });
  seedDesktopDatabase(join(runtimeDir, 'data', 'agent.sqlite'), {
    secretsMasterKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  });
  const backendPort = await getOpenPort();
  const rendererPort = await getOpenPort();
  let app: ElectronApplication | undefined;
  let browser: Browser | undefined;
  let stopDownloadObservation = () => {};
  let browserExportEvidence: { status: number; elapsedMs: number; code: string } | undefined;
  try {
    const launchOptions = {
      cwd: desktopDir,
      args: ['.', `--user-data-dir=${join(tempRoot, 'electron-profile')}`],
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
        AGENT_PLATFORM_DESKTOP_TEST_SAVE_DIAGNOSTIC_PATHS: JSON.stringify([
          null,
          destination,
          join(tempRoot, 'missing-parent', 'cannot-write.json'),
          partialDestination,
        ]),
        AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: 'Deterministic diagnostic journey complete.',
        SECRETS_MASTER_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      },
    };
    app = await electron.launch(launchOptions);
    expect(await app.evaluate(() => process.env.DIAGNOSTICS_LOCAL_CAPABILITY === undefined)).toBe(
      true,
    );
    const page = await app.firstWindow();
    await page.getByRole('link', { name: /^Chat/ }).click();
    const input = page.getByPlaceholder(/Send a message/);
    await expect(input).toBeEnabled();
    await expect(
      page.getByRole('status').filter({ hasText: 'Press Enter to send, Shift+Enter for new line' }),
    ).toBeVisible();
    await input.fill('PRIVATE_PROMPT_CANARY must not enter the diagnostic export');
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    await input.press('Enter');
    const exportButton = page.getByRole('button', {
      name: 'Export diagnostic report',
      exact: true,
    });
    await expect(exportButton).toBeVisible();
    // Editable restoration drafts do not establish admission; require the actual completed reply.
    await expect(
      page.getByText('Deterministic diagnostic journey complete.', { exact: true }),
    ).toBeVisible();
    await expect(input).toBeEnabled({ timeout: 30000 });
    await exportButton.click();
    await expect(page.getByRole('status').filter({ hasText: 'Export cancelled' })).toBeVisible();
    expect(existsSync(destination)).toBe(false);
    await exportButton.click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Diagnostic report saved locally' }),
    ).toBeVisible();
    const reportText = readFileSync(destination, 'utf8');
    const report = JSON.parse(reportText);
    expect(report.source).toBe('local-store');
    expect(report.events.length).toBeGreaterThan(0);
    expect(reportText).not.toContain('PRIVATE_PROMPT_CANARY');
    expect(reportText).not.toContain(runtimeDir);
    expect(report.coverage.durable).toBe(true);
    await exportButton.click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Diagnostics could not be exported' }),
    ).toBeVisible();

    // Use a separate real browser, not the Electron preload, against the same actual local installation.
    browser = await chromium.launch();
    const web = await browser.newPage();
    await web.goto(`http://127.0.0.1:${rendererPort}`);
    await web.getByRole('link', { name: /^Chat/ }).click();
    const webInput = web.getByPlaceholder(/Send a message/);
    await expect(webInput).toBeEnabled();
    await expect(
      web.getByRole('status').filter({ hasText: 'Press Enter to send, Shift+Enter for new line' }),
    ).toBeVisible();
    await webInput.fill('BROWSER_PROMPT_CANARY');
    await expect(web.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    await webInput.press('Enter');
    await expect(
      web.getByText('Deterministic diagnostic journey complete.', { exact: true }),
    ).toBeVisible();
    await expect(webInput).toBeEnabled({ timeout: 30000 });
    // Observe the one real request before clicking; a 503 must not become a download timeout.
    const responded = web
      .waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/diagnostics/report' &&
          response.request().method() === 'POST',
      )
      .catch(() => undefined);
    const downloaded = new Promise<import('playwright').Download>((resolveDownload) => {
      web.once('download', resolveDownload);
      stopDownloadObservation = () => web.off('download', resolveDownload);
    });
    const exportStartedAt = performance.now();
    await web.getByRole('button', { name: 'Export diagnostic report', exact: true }).click();
    const response = await responded;
    expect(response, 'The browser export must receive an actual report response').toBeDefined();
    browserExportEvidence = {
      status: response!.status(),
      elapsedMs: performance.now() - exportStartedAt,
      code: response!.status() === 200 ? 'success' : 'unknown',
    };
    if (response!.status() !== 200) {
      try {
        const body = await response!.json();
        if (
          [
            'DIAGNOSTICS_DENIED',
            'INVALID_SCOPE',
            'DIAGNOSTICS_UNAVAILABLE',
            'REPORT_TOO_LARGE',
            'SCOPE_MISMATCH',
          ].includes(body?.error?.code)
        )
          browserExportEvidence.code = body.error.code;
      } catch {
        // An unreadable error body remains unknown; never retain raw upstream content.
      }
    }
    expect(response!.status(), JSON.stringify(browserExportEvidence)).toBe(200);
    await (await downloaded).saveAs(browserDestination);
    stopDownloadObservation();
    const browserReport = JSON.parse(readFileSync(browserDestination, 'utf8'));
    expect(browserReport.events.length).toBeGreaterThan(0);
    expect(browserReport.source).toBe('local-store');
    expect(browserReport.scope).not.toEqual(report.scope);
    expect(
      browserReport.events.every(
        ({ event }: { event: { sessionId: string } }) =>
          event.sessionId === browserReport.scope.sessionId,
      ),
    ).toBe(true);
    expect(readFileSync(browserDestination, 'utf8')).not.toContain('BROWSER_PROMPT_CANARY');
    // A foreign Origin cannot borrow the server-side capability.
    const denied = await fetch(`http://127.0.0.1:${rendererPort}/api/diagnostics/report`, {
      method: 'POST',
      headers: {
        origin: 'https://evil.test',
        'sec-fetch-site': 'cross-site',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ scope: report.scope }),
    });
    expect(denied.status).toBe(403);
    const invalidIpc = await page.evaluate(async () => {
      const api = (
        window as unknown as {
          agentPlatformDesktop: {
            diagnostics: { savePartial: (input: unknown) => Promise<unknown> };
          };
        }
      ).agentPlatformDesktop;
      try {
        await api.diagnostics.savePartial({
          requestId: crypto.randomUUID(),
          observedAtMs: 1,
          phase: 'connection',
          errorCode: 'backend_unavailable',
          path: '/tmp/forbidden',
        });
        return false;
      } catch {
        return true;
      }
    });
    expect(invalidIpc).toBe(true);
    // Stop only this Electron fixture's direct API child; do not mock the BFF or report path.
    const ownerPid = app.process().pid;
    const apiEntry = join(repoRoot, 'apps/api/dist/index.js');
    const processes = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,args='], { encoding: 'utf8' });
    const candidate = processes
      .split('\n')
      .map((line) => /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line))
      .filter((match) => match && Number(match[2]) === ownerPid && match[3]?.endsWith(apiEntry));
    expect(candidate).toHaveLength(1);
    process.kill(Number(candidate[0]![1]), 'SIGTERM');
    await expect
      .poll(async () => {
        try {
          await fetch(`http://127.0.0.1:${backendPort}/health/ready`);
          return false;
        } catch {
          return true;
        }
      })
      .toBe(true);
    await input.fill('NO_BACKEND_CANARY');
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    await input.press('Enter');
    await expect(
      page.getByText(
        'Partial current-view report: unverified and not retained after this view closes.',
      ),
    ).toBeVisible();
    await exportButton.click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Diagnostic report saved locally' }),
    ).toBeVisible();
    const partial = JSON.parse(readFileSync(partialDestination, 'utf8'));
    expect(partial).toMatchObject({
      source: 'current-view',
      coverage: { verified: false, durable: false },
    });
    expect(readFileSync(partialDestination, 'utf8')).not.toContain('NO_BACKEND_CANARY');
    // Restart both real managed processes, keep the same SQLite/profile, reopen the original session.
    await browser.close();
    browser = undefined;
    await app.close();
    app = undefined;
    app = await electron.launch({
      ...launchOptions,
      env: {
        ...launchOptions.env,
        AGENT_PLATFORM_DESKTOP_TEST_SAVE_DIAGNOSTIC_PATHS: JSON.stringify([restartedDestination]),
      },
    });
    const restartedPage = await app.firstWindow();
    await restartedPage.getByRole('link', { name: /^Chat/ }).click();
    await restartedPage.getByLabel('Open sessions menu').click();
    await restartedPage.getByRole('menuitem').filter({ hasText: 'PRIVATE_PROMPT_CANARY' }).click();
    await expect(
      restartedPage.getByText(
        'Partial current-view report: unverified and not retained after this view closes.',
      ),
    ).toHaveCount(0);
    await restartedPage
      .getByRole('button', { name: 'Export diagnostic report', exact: true })
      .click();
    await expect(
      restartedPage.getByRole('status').filter({ hasText: 'Diagnostic report saved locally' }),
    ).toBeVisible();
    const restarted = JSON.parse(readFileSync(restartedDestination, 'utf8'));
    expect(restarted.scope).toEqual(report.scope);
    expect(restarted.coverage.durable).toBe(true);
    expect(
      restarted.events.map(({ event }: { event: { eventId: string } }) => event.eventId),
    ).toEqual(
      expect.arrayContaining(
        report.events.map(({ event }: { event: { eventId: string } }) => event.eventId),
      ),
    );
    expect(restarted.summary).toContain('succeeded');
    expect(partial.summary).toContain('backend_unavailable');
    await testInfo.attach('restarted-diagnostic-report', {
      path: restartedDestination,
      contentType: 'application/json',
    });
    await testInfo.attach('diagnostic-report', {
      path: destination,
      contentType: 'application/json',
    });
    await testInfo.attach('browser-diagnostic-report', {
      path: browserDestination,
      contentType: 'application/json',
    });
    await testInfo.attach('partial-diagnostic-report', {
      path: partialDestination,
      contentType: 'application/json',
    });
  } finally {
    stopDownloadObservation();
    const shutdown = await Promise.allSettled([browser?.close(), app?.close()]);
    try {
      // Retain only the fixed read-failure categories, not general backend/user output.
      const logPath = join(runtimeDir, 'logs', 'backend.stdout.log');
      const observations = existsSync(logPath)
        ? readFileSync(logPath, 'utf8')
            .split('\n')
            .flatMap((line) => {
              try {
                const row = JSON.parse(line);
                if (
                  row.service !== 'diagnostics-read' ||
                  !['flush', 'query', 'report'].includes(row.phase) ||
                  !Number.isFinite(row.elapsedMs)
                )
                  return [];
                const state = DiagnosticHealthSchema.shape.state.safeParse(row.state);
                const reason = DiagnosticHealthSchema.shape.reason.safeParse(row.reason);
                return [
                  {
                    phase: row.phase,
                    elapsedMs: row.elapsedMs,
                    state: state.success ? state.data : 'unknown',
                    reason: reason.success ? reason.data : 'unknown',
                    ...Object.fromEntries(
                      ['pending', 'dropped', 'acknowledgedSequence'].map((key) => [
                        key,
                        Number.isSafeInteger(row[key]) && row[key] >= 0 ? row[key] : null,
                      ]),
                    ),
                  },
                ];
              } catch {
                return [];
              }
            })
        : [];
      const evidencePath = testInfo.outputPath('diagnostic-export-read-evidence.json');
      writeFileSync(
        evidencePath,
        JSON.stringify({
          browserExport: browserExportEvidence ?? null,
          observations,
          shutdown: shutdown.map(({ status }) => status),
        }),
      );
      await testInfo.attach('diagnostic-export-read-evidence', {
        path: evidencePath,
        contentType: 'application/json',
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
    expect(
      shutdown.map(({ status }) => status),
      'Both owned fixtures must close',
    ).toEqual(['fulfilled', 'fulfilled']);
  }
});
