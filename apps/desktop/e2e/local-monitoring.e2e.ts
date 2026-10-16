import { expect, test } from '@playwright/test';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type ElectronApplication,
  type Page,
} from 'playwright';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { projectMonitoringReport, type MonitoringReport } from '@agent-platform/contracts';
import { startContextTokenProvider } from './support/contextTokenProvider.js';
import {
  createContextTokenFixture,
  launchContextTokenFixture,
  createContextTokenAgent,
  openContextTokenProject,
  selectContextTokenModel,
  sendContextTokenMessage,
  removeContextTokenFixture,
  contextTokenRepoRoot,
  type ContextTokenFixture,
} from './support/contextTokenFixture.js';
import { getDesktopPorts } from './support/runtime.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const snapshotScript = `import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(process.argv[1],{readOnly:true});
try { console.log(JSON.stringify({
 samples:db.prepare('SELECT sequence,content FROM monitoring_events ORDER BY sequence').all().map(row=>({sequence:row.sequence,sample:JSON.parse(row.content)})),
 preference:db.prepare("SELECT key,value FROM monitoring_meta WHERE key IN ('sampling_enabled','retention_days','preference_version') ORDER BY key").all()
})); } finally { db.close(); }`;
function snapshot(fixture: ContextTokenFixture) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--no-warnings',
        '--input-type=module',
        '-e',
        snapshotScript,
        join(fixture.runtimeDir, 'data', 'monitoring.sqlite'),
      ],
      {
        cwd: contextTokenRepoRoot,
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 2_000_000,
        env: { PATH: '/usr/bin:/bin' },
      },
    ),
  ) as {
    samples: Array<{
      sequence: number;
      sample: {
        sampleId: string;
        processInstanceId: string;
        observedAtMs: number;
        intervalMs: number;
      };
    }>;
    preference: Array<{ key: string; value: string }>;
  };
}
function stoppedCount(fixture: ContextTokenFixture) {
  const path = join(fixture.runtimeDir, 'logs', 'desktop.stderr.log');
  return existsSync(path)
    ? readFileSync(path, 'utf8')
        .split('\n')
        .filter(
          (line) => line.includes('AGENT_PLATFORM_STARTUP') && line.includes('stop-confirmed'),
        ).length
    : 0;
}
async function closeApp(app: ElectronApplication, fixture: ContextTokenFixture) {
  const before = stoppedCount(fixture);
  await app.close();
  expect(stoppedCount(fixture)).toBeGreaterThan(before);
  await expect
    .poll(async () => {
      try {
        await fetch(`http://127.0.0.1:${fixture.backendPort}/health`, {
          signal: AbortSignal.timeout(1000),
        });
        return false;
      } catch {
        return true;
      }
    })
    .toBe(true);
}
async function settings(page: Page, fixture: ContextTokenFixture) {
  await page.goto(`http://127.0.0.1:${fixture.rendererPort}/settings/workspace`);
  await expect(page.getByRole('heading', { name: 'Local monitoring', exact: true })).toBeVisible();
}
async function resumeSession(
  page: Page,
  fixture: ContextTokenFixture,
  session: { id: string; projectId: string },
) {
  await page.goto(`http://127.0.0.1:${fixture.rendererPort}/?projectId=${session.projectId}`);
  const agent = page.getByRole('combobox', { name: 'Active agent' });
  await expect(agent).toBeEnabled();
  if (!(await agent.textContent())?.includes('Context token fixture')) {
    await agent.click();
    await page.getByRole('option', { name: 'Context token fixture', exact: true }).click();
  }
  await expect(agent).toContainText('Context token fixture');
  await page.getByRole('button', { name: 'Open sessions menu', exact: true }).click();
  await page.getByRole('menuitem', { name: new RegExp(`^Context-token ${session.id}`) }).click();
  await expect(page.getByPlaceholder('Ask about this Project...')).toBeEnabled();
}
async function windowFields(page: Page, fromMs: number, toMs: number) {
  await page.getByLabel('From (UTC, inclusive)').fill(new Date(fromMs).toISOString());
  await page.getByLabel('To (UTC, exclusive)').fill(new Date(toMs).toISOString());
}
function checkedReport(path: string, fromMs: number, toMs: number): MonitoringReport {
  const raw = readFileSync(path, 'utf8');
  for (const forbidden of [
    'MONITORING_PROMPT_CANARY',
    'context-token-fixture-key-canary',
    '/Users/',
    'x-diagnostics-capability',
  ])
    expect(raw).not.toContain(forbidden);
  const report = projectMonitoringReport(JSON.parse(raw), {
    window: { fromMs, toMs },
    limit: 1000,
  });
  expect(report.monitoring.health.state).toBe('ready');
  expect(report.diagnostics.health.state).toBe('ready');
  for (const h of [report.monitoring.health, report.diagnostics.health]) {
    expect(h.pending).toBe(0);
    expect(h.dropped).toBe(0);
    expect(h.conflicts).toBe(0);
  }
  expect(report.monitoring.truncated).toBe(false);
  expect(report.diagnostics.truncated).toBe(false);
  expect(report.summary).toContain('Independent snapshots');
  return report;
}

test('local monitoring records desktop and browser use, survives backend restart and exports bounded safe history', async () => {
  test.setTimeout(180_000);
  const info = test.info();
  const failures: string[] = [];
  const reports: Record<string, unknown> = {};
  let provider: Awaited<ReturnType<typeof startContextTokenProvider>> | undefined;
  let fixture: ContextTokenFixture | undefined;
  let app: ElectronApplication | undefined;
  let browser: Browser | undefined;
  let page: Page | undefined;
  let cleanupConfirmed = false;
  const traces = new Map<BrowserContext, string>();
  async function startTrace(context: BrowserContext, name: string) {
    await context.tracing.start({ screenshots: true, snapshots: true });
    traces.set(context, name);
  }
  async function finishTrace(context: BrowserContext) {
    const name = traces.get(context);
    if (!name) return;
    await context.tracing.stop({ path: info.outputPath(`${name}.zip`) });
    traces.delete(context);
  }
  try {
    provider = await startContextTokenProvider([
      { kind: 'text', text: 'Desktop monitoring journey completed.' },
      { kind: 'text', text: 'Browser monitoring journey completed.' },
      { kind: 'text', text: 'Diagnostic events remain available with resource recording off.' },
    ]);
    fixture = await createContextTokenFixture(provider);
    const owned = fixture;
    const ports = await getDesktopPorts();
    owned.backendPort = ports.backendPort;
    owned.rendererPort = ports.rendererPort;
    owned.launchOptions.env.AGENT_PLATFORM_DESKTOP_BACKEND_PORT = String(ports.backendPort);
    owned.launchOptions.env.AGENT_PLATFORM_DESKTOP_RENDERER_PORT = String(ports.rendererPort);
    const paths = Object.fromEntries(
      ['before', 'after-browser', 'restart', 'off'].map((name) => [
        name,
        join(owned.root, `${name}.json`),
      ]),
    );
    Object.assign(owned.launchOptions.env, {
      AGENT_PLATFORM_DESKTOP_TEST_SAVE_MONITORING_PATHS: JSON.stringify([
        null,
        paths.before,
        paths['after-browser'],
      ]),
    });
    app = await launchContextTokenFixture(owned);
    page = await app.firstWindow();
    const fromMs = Date.now() - 1000;
    await settings(page, owned);
    await expect(page.getByText('Resource recording: Off.', { exact: false })).toBeVisible();
    await page.getByLabel('Record local resource samples').check();
    await page.getByLabel('Retention age in whole days (1–90)').fill('7');
    await page.getByRole('button', { name: 'Save monitoring preference', exact: true }).click();
    await expect(
      page.getByText('Monitoring preference saved locally.', { exact: false }),
    ).toBeVisible();
    expect(snapshot(owned).preference).toEqual(
      expect.arrayContaining([
        { key: 'sampling_enabled', value: '1' },
        { key: 'retention_days', value: '7' },
      ]),
    );
    const agent = await createContextTokenAgent(owned);
    await page.goto(`http://127.0.0.1:${owned.rendererPort}`);
    const session = await openContextTokenProject(page, owned, agent);
    await startTrace(page.context(), 'monitoring-desktop-before-restart');
    await sendContextTokenMessage(page, 'MONITORING_PROMPT_CANARY desktop observation');
    await expect(
      page.getByText('Desktop monitoring journey completed.', { exact: true }),
    ).toBeVisible();
    // Observe actual persisted samples at the production30second cadence; no accelerated timer or fixture inserts.
    await expect
      .poll(() => snapshot(owned).samples.length, { timeout: 75000, intervals: [1000] })
      .toBeGreaterThanOrEqual(2);
    const before = snapshot(owned);
    expect(before.samples[1]!.sample.intervalMs).toBeGreaterThanOrEqual(25000);
    reports.persistedBefore = before;
    const beforeTo = Date.now();
    await settings(page, owned);
    await windowFields(page, fromMs, beforeTo);
    await page.getByRole('button', { name: 'Save monitoring history', exact: true }).click();
    await expect(
      page.getByText('Export cancelled. No history file was saved.', { exact: true }),
    ).toBeVisible();
    expect(existsSync(paths.before!)).toBe(false);
    await page.getByRole('button', { name: 'Save monitoring history', exact: true }).click();
    await expect(
      page.getByText('Monitoring history saved locally.', { exact: false }),
    ).toBeVisible();
    const beforeReport = checkedReport(paths.before!, fromMs, beforeTo);
    expect(beforeReport.monitoring.samples.length).toBeGreaterThanOrEqual(2);
    expect(beforeReport.diagnostics.events.some((row) => row.event.sessionId === session.id)).toBe(
      true,
    );
    reports.before = beforeReport;
    browser = await chromium.launch();
    const web = await browser.newPage();
    await startTrace(web.context(), 'monitoring-browser');
    await settings(web, owned);
    await expect(
      web.getByText('This browser does not have access to private monitoring.', { exact: false }),
    ).toBeVisible();
    expect(await web.evaluate(() => 'agentPlatformDesktop' in globalThis)).toBe(false);
    const denied = await web.request.post(
      `http://127.0.0.1:${owned.backendPort}/v1/diagnostics/monitoring/status`,
      { data: {} },
    );
    expect(denied.status()).toBe(403);
    reports.browserPrivateDenied = denied.status();
    await resumeSession(web, owned, session);
    await selectContextTokenModel(web);
    await sendContextTokenMessage(web, 'MONITORING_PROMPT_CANARY browser observation');
    await expect(
      web.getByText('Browser monitoring journey completed.', { exact: true }),
    ).toBeVisible();
    const afterTo = Date.now();
    await windowFields(page, fromMs, afterTo);
    await page.getByRole('button', { name: 'Save monitoring history', exact: true }).click();
    await expect(
      page.getByText('Monitoring history saved locally.', { exact: false }),
    ).toBeVisible();
    const after = checkedReport(paths['after-browser']!, fromMs, afterTo);
    expect(after.diagnostics.events.length).toBeGreaterThan(beforeReport.diagnostics.events.length);
    reports.afterBrowser = after;
    await finishTrace(web.context());
    await browser.close();
    browser = undefined;
    await finishTrace(page.context());
    await closeApp(app, owned);
    app = undefined;
    Object.assign(owned.launchOptions.env, {
      AGENT_PLATFORM_DESKTOP_TEST_SAVE_MONITORING_PATHS: JSON.stringify([paths.restart, paths.off]),
    });
    app = await launchContextTokenFixture(owned);
    page = await app.firstWindow();
    await startTrace(page.context(), 'monitoring-desktop-after-restart');
    await settings(page, owned);
    await expect(page.getByText('Resource recording: Enabled.', { exact: false })).toBeVisible();
    await windowFields(page, fromMs, afterTo);
    await page.getByRole('button', { name: 'Save monitoring history', exact: true }).click();
    await expect(
      page.getByText('Monitoring history saved locally.', { exact: false }),
    ).toBeVisible();
    const restarted = checkedReport(paths.restart!, fromMs, afterTo);
    expect(restarted.monitoring.samples).toEqual(after.monitoring.samples);
    expect(restarted.diagnostics.events).toEqual(after.diagnostics.events);
    reports.restarted = restarted;
    await page.getByLabel('Record local resource samples').uncheck();
    await page.getByRole('button', { name: 'Save monitoring preference', exact: true }).click();
    await expect(page.getByText('Resource recording: Off.', { exact: false })).toBeVisible();
    const off = snapshot(owned);
    expect(off.preference).toEqual(
      expect.arrayContaining([{ key: 'sampling_enabled', value: '0' }]),
    );
    reports.persistedOff = off;
    await resumeSession(page, owned, session);
    await sendContextTokenMessage(
      page,
      'MONITORING_PROMPT_CANARY events while resource sampling off',
    );
    await expect(
      page.getByText('Diagnostic events remain available with resource recording off.', {
        exact: true,
      }),
    ).toBeVisible();
    const offTo = Date.now();
    await settings(page, owned);
    await windowFields(page, fromMs, offTo);
    await page.getByRole('button', { name: 'Save monitoring history', exact: true }).click();
    await expect(
      page.getByText('Monitoring history saved locally.', { exact: false }),
    ).toBeVisible();
    const offReport = checkedReport(paths.off!, fromMs, offTo);
    expect(offReport.diagnostics.events.length).toBeGreaterThan(
      restarted.diagnostics.events.length,
    );
    expect(offReport.monitoring.health.preference?.samplingEnabled).toBe(false);
    expect(snapshot(owned).samples).toEqual(off.samples);
    reports.off = offReport;
    expect(provider.requests).toHaveLength(3);
    expect(provider.errors).toEqual([]);
    await info.attach('monitoring-settings', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    for (const [name, path] of Object.entries(paths)) {
      copyFileSync(path, info.outputPath(`monitoring-${name}.json`));
    }
    await finishTrace(page.context());
    await closeApp(app, owned);
    app = undefined;
    cleanupConfirmed = true;
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'unknown');
    throw error;
  } finally {
    for (const context of traces.keys()) {
      try {
        await finishTrace(context);
      } catch {
        failures.push('trace_capture_failed');
      }
    }
    if (browser)
      try {
        await browser.close();
      } catch {
        failures.push('browser_cleanup_failed');
      }
    if (app && fixture)
      try {
        await closeApp(app, fixture);
        cleanupConfirmed = true;
      } catch {
        failures.push('desktop_cleanup_unconfirmed');
      }
    if (provider)
      try {
        await provider.close();
      } catch {
        failures.push('provider_cleanup_failed');
      }
    const sourcePaths = [
      'apps/desktop/e2e/local-monitoring.e2e.ts',
      'apps/desktop/src/main/monitoringExport.ts',
      'apps/desktop/src/main/monitoringTransport.ts',
      'apps/desktop/src/main/monitoringIpc.ts',
      'apps/web/components/settings/local-monitoring.tsx',
      'apps/api/src/infrastructure/diagnostics/monitoringRuntime.ts',
      'packages/contracts/src/monitoring.ts',
    ];
    const evidence = {
      mode: 'real-managed-desktop-and-separate-chromium',
      boundaries:
        'Actual app/API/SQLite/default30second sampler and supported main-process SaveAs. Only external model wire and OS destination selection deterministic; no Docker or live-provider claim.',
      reports,
      providerRequests: provider?.requests.length,
      providerErrors: provider?.errors,
      cleanupConfirmed,
      failures,
      sourceHashes: Object.fromEntries(
        sourcePaths.map((path) => [
          path,
          createHash('sha256')
            .update(readFileSync(join(contextTokenRepoRoot, path)))
            .digest('hex'),
        ]),
      ),
    };
    const output = info.outputPath('monitoring-evaluation.json');
    writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
    await info.attach('monitoring-evaluation', { path: output, contentType: 'application/json' });
    if (fixture && cleanupConfirmed) removeContextTokenFixture(fixture);
    expect(failures).toEqual([]);
  }
});
