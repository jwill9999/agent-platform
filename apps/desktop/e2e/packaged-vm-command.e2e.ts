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
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopDir, '../..');
const GIT_BINARY = '/usr/bin/git';
const HOST_ONLY_CANARY_ENV = 'HOST_ONLY_CANARY';
const HOST_ONLY_CANARY_VALUE = ['host', 'only', 'packaged', 'vm', 'e2e', 'canary'].join('-');
const VM_E2E_MARKER_COMMAND = 'pwd';
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

      await expect(page.getByLabel('Command runner status')).toContainText('macos-vm ready', {
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

      await expect(page.getByLabel('Command runner status')).toContainText('macos-vm failed', {
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
  options: { finalText?: string } = {},
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
      AGENT_PLATFORM_DESKTOP_TEMP_DIR: join(fixture.runtimeDir, 'tmp'),
      AGENT_PLATFORM_DESKTOP_TEST_PROJECT_DIRS: JSON.stringify([fixture.projectDir]),
      AGENT_PLATFORM_E2E_MOCK_LLM_FINAL_TEXT: options.finalText ?? 'VM command complete',
      AGENT_PLATFORM_E2E_MOCK_LLM_TOOL_CALL_JSON: JSON.stringify({
        name: 'sys_bash',
        args: { command: VM_E2E_MARKER_COMMAND },
      }),
      SECRETS_MASTER_KEY: E2E_SECRETS_MASTER_KEY,
      [HOST_ONLY_CANARY_ENV]: HOST_ONLY_CANARY_VALUE,
      CI: process.env.CI,
    },
  });
}

async function openProject(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Open Project' }).click();
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

function getOpenPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) {
          resolvePort(address.port);
          return;
        }
        reject(new Error('Failed to allocate a local port.'));
      });
    });
  });
}
