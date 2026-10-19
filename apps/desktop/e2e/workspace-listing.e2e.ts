import { expect, test, type ElectronApplication, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from './support/fixtureEnvironment.js';
import { getDesktopLaunchPorts, seedDesktopDatabase } from './support/runtime.js';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function portReleased(port: number): Promise<boolean> {
  return new Promise((resolveReleased) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (released: boolean) => {
      socket.destroy();
      resolveReleased(released);
    };
    socket.once('connect', () => finish(false));
    socket.once('error', (error: NodeJS.ErrnoException) => finish(error.code === 'ECONNREFUSED'));
    socket.setTimeout(500, () => finish(false));
  });
}

async function requireReleasedPorts(ports: Awaited<ReturnType<typeof getDesktopLaunchPorts>>) {
  await expect
    .poll(async () => (await Promise.all(Object.values(ports).map(portReleased))).every(Boolean))
    .toBe(true);
}

async function finishFixture(options: {
  app: ElectronApplication | undefined;
  browser?: import('playwright').Browser;
  contexts: import('playwright').BrowserContext[];
  fixture: Awaited<ReturnType<typeof makeFixture>>;
  info: TestInfo;
  name: string;
  evidence: Record<string, unknown>;
  primaryFailure: boolean;
}) {
  const traces = await Promise.allSettled(
    options.contexts.map((context, index) =>
      context.tracing.stop({ path: options.info.outputPath(`${options.name}-${index}-trace.zip`) }),
    ),
  );
  const cleanup = await Promise.allSettled([options.app?.close(), options.browser?.close()]);
  const released = await requireReleasedPorts(options.fixture.ports).then(
    () => true,
    () => false,
  );
  let failed = [...traces, ...cleanup].some((x) => x.status === 'rejected') || !released;
  const receipt = {
    ...options.evidence,
    passed: options.evidence.passed === true && !failed,
    traces: traces.map((x) => x.status),
    cleanup: cleanup.map((x) => x.status),
    portsReleased: released,
    fixtureRetained: failed,
    evidenceWriteFailed: false,
    evidenceAttachFailed: false,
  };
  const persist = () =>
    writeFileSync(
      options.info.outputPath(`${options.name}-receipt.json`),
      JSON.stringify(receipt, null, 2),
    );
  try {
    persist();
  } catch {
    receipt.evidenceWriteFailed = true;
    failed = true;
  }
  try {
    await options.info.attach(options.name, {
      body: Buffer.from(JSON.stringify(receipt)),
      contentType: 'application/json',
    });
  } catch {
    receipt.evidenceAttachFailed = true;
    failed = true;
  }
  if (failed) {
    receipt.passed = false;
    receipt.fixtureRetained = true;
    try {
      persist();
    } catch {
      /* Retain the fixture and original journey failure. */
    }
  } else {
    rmSync(options.fixture.root, { recursive: true, force: true });
  }
  if (failed && !options.primaryFailure)
    throw new Error('Workspace evidence or owned cleanup failed; disposable profile retained');
}

async function openWorkspace(page: Page) {
  await expect(page.getByRole('heading', { name: 'Choose a workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Open settings menu' }).click();
  await page.getByRole('menuitem', { name: 'Workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workspace', exact: true })).toBeVisible();
}

async function makeFixture(blocked: boolean) {
  const root = mkdtempSync(join(tmpdir(), 'native-workspace-e2e-'));
  const runtime = join(root, 'runtime');
  for (const dir of ['home', 'tmp']) mkdirSync(join(root, dir));
  seedDesktopDatabase(join(runtime, 'data', 'agent.sqlite'), {
    secretsMasterKey: Buffer.alloc(32, 7).toString('base64'),
  });
  const ports = await getDesktopLaunchPorts();
  const workspace = join(runtime, 'data', 'workspace');
  if (blocked) writeFileSync(workspace, 'blocked-root-canary');
  return {
    root,
    runtime,
    workspace,
    ports,
    options: {
      cwd: desktopDir,
      args: [
        `--inspect=${ports.nodeInspectorPort}`,
        `--remote-debugging-port=${ports.chromiumDebuggerPort}`,
        '.',
        `--user-data-dir=${join(root, 'profile')}`,
      ],
      env: {
        ...fixtureEnvironment(root, process.execPath, process.env),
        AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
        AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(ports.backendPort),
        AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
        AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
        AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(ports.rendererPort),
        AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtime,
        AGENT_PLATFORM_DESKTOP_LOG_DIR: join(runtime, 'logs'),
        AGENT_PLATFORM_COMMAND_RUNNER: 'disabled',
        SECRETS_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'),
      },
    },
  };
}

test('NW-T02 default managed workspace lists and downloads safely through native and browser views across restart', async ({
  playwright,
}, info) => {
  const fixture = await makeFixture(false);
  let app: ElectronApplication | undefined;
  let browser: import('playwright').Browser | undefined;
  const contexts: import('playwright').BrowserContext[] = [];
  let evidence: Record<string, unknown> = { passed: false };
  let primaryFailure = false;
  try {
    browser = await playwright.chromium.launch();
    app = await playwright._electron.launch(fixture.options);
    await app.context().tracing.start({ screenshots: true, snapshots: true });
    contexts.push(app.context());
    const native = await app.firstWindow();
    const listing = native
      .waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/workspace/files')
      .catch(() => undefined);
    await openWorkspace(native);
    const initial = await listing;
    if (!initial) throw new Error('Workspace listing response was not captured');
    expect(initial.status()).toBe(200);
    await expect(native.getByRole('heading', { name: 'No workspace files yet' })).toBeVisible();
    await expect(native.getByText('File listing unavailable. Refresh to retry.')).toHaveCount(0);
    const output = join(fixture.workspace, 'generated', 'native-report.txt');
    const bytes = 'Disposable generated report\n';
    writeFileSync(output, bytes);
    const outside = join(fixture.root, 'outside.txt');
    writeFileSync(outside, 'outside-unchanged');
    symlinkSync(outside, join(fixture.workspace, 'generated', 'outside-link'));
    await native.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(native.getByRole('row').filter({ hasText: 'native-report.txt' })).toBeVisible();
    await expect(native.getByText('outside-link', { exact: true })).toHaveCount(0);

    const web = await browser.newPage();
    await web.goto(`http://127.0.0.1:${fixture.ports.rendererPort}/settings/workspace`);
    const row = web.getByRole('row').filter({ hasText: 'native-report.txt' });
    await expect(row).toBeVisible();
    const [download] = await Promise.all([
      web.waitForEvent('download'),
      row.getByRole('link', { name: 'Download' }).click(),
    ]);
    const downloaded = await download.path();
    expect(downloaded).not.toBeNull();
    expect(readFileSync(downloaded!, 'utf8')).toBe(bytes);
    const denied: number[] = [];
    for (const path of ['../outside.txt', outside, 'generated/outside-link']) {
      const response = await web.request.get(
        `http://127.0.0.1:${fixture.ports.rendererPort}/api/v1/workspace/files/download`,
        { params: { path } },
      );
      denied.push(response.status());
      expect(response.status()).toBe(403);
      expect(await response.text()).not.toContain('outside-unchanged');
    }
    expect(readFileSync(outside, 'utf8')).toBe('outside-unchanged');
    await browser.close();
    await app.context().tracing.stop({ path: info.outputPath('workspace-first-launch-trace.zip') });
    contexts.pop();
    await app.close();
    app = undefined;
    await requireReleasedPorts(fixture.ports);
    app = await playwright._electron.launch(fixture.options);
    await app.context().tracing.start({ screenshots: true, snapshots: true });
    contexts.push(app.context());
    const restarted = await app.firstWindow();
    await openWorkspace(restarted);
    await expect(restarted.getByRole('row').filter({ hasText: 'native-report.txt' })).toBeVisible();
    expect(readFileSync(output, 'utf8')).toBe(bytes);
    expect(readFileSync(outside, 'utf8')).toBe('outside-unchanged');
    evidence = {
      passed: true,
      defaultManagedRoot: true,
      explicitWorkspaceOverride: false,
      initialListingStatus: initial.status(),
      downloadedBytesMatch: true,
      restartBytesMatch: true,
      outsideDenials: denied,
      outsideBytesUnchanged: true,
      providerCalls: 0,
    };
  } catch (error) {
    primaryFailure = true;
    throw error;
  } finally {
    await finishFixture({
      app,
      browser,
      contexts,
      fixture,
      info,
      name: 'workspace-default',
      evidence,
      primaryFailure,
    });
  }
});

test('NW-T04 unavailable managed root reports a safe correlated failure without breaking policies or monitoring', async ({
  playwright,
}, info) => {
  const fixture = await makeFixture(true);
  let app: ElectronApplication | undefined;
  let evidence: Record<string, unknown> = { passed: false };
  let primaryFailure = false;
  try {
    app = await playwright._electron.launch(fixture.options);
    await app.context().tracing.start({ screenshots: true, snapshots: true });
    const page = await app.firstWindow();
    const responded = page
      .waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/workspace/files')
      .catch(() => undefined);
    await openWorkspace(page);
    const response = await responded;
    if (!response) throw new Error('Workspace failure response was not captured');
    expect(response.status()).toBe(503);
    expect((await response.json()).error.code).toBe('WORKSPACE_FILES_UNAVAILABLE');
    await expect(page.getByText('File listing unavailable. Refresh to retry.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Execution policy' })).toBeVisible();
    await expect(page.getByText('Resource recording:', { exact: false })).toBeVisible();
    expect(readFileSync(fixture.workspace, 'utf8')).toBe('blocked-root-canary');
    const logs = readFileSync(join(fixture.runtime, 'logs', 'backend.stdout.log'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const record = logs.find((x) => x.service === 'workspace-files');
    expect(record).toMatchObject({
      phase: 'initialize',
      category: 'EEXIST',
      correlationId: response.headers()['x-request-id'],
    });
    expect(record.correlationId).toBeTruthy();
    const safe = JSON.stringify(record) + JSON.stringify(await response.json());
    for (const value of [fixture.root, fixture.workspace, 'blocked-root-canary'])
      expect(safe).not.toContain(value);
    evidence = {
      passed: true,
      listingStatus: response.status(),
      phase: record.phase,
      category: record.category,
      requestId: record.correlationId,
      rootBytesUnchanged: true,
      providerCalls: 0,
    };
  } catch (error) {
    primaryFailure = true;
    throw error;
  } finally {
    await finishFixture({
      app,
      contexts: app ? [app.context()] : [],
      fixture,
      info,
      name: 'workspace-unavailable',
      evidence,
      primaryFailure,
    });
  }
});
