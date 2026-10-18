import { expect, test, type ElectronApplication } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
  createMigrationProfile,
  inspectMigrationProfile,
} from '../../../scripts/testing/migration-profile.mjs';
import { fixtureEnvironment } from './support/fixtureEnvironment.js';
import { getDesktopLaunchPorts } from './support/runtime.js';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireFromDesktop = createRequire(join(desktopDir, 'package.json'));

function recordRows(value: unknown): Record<string, unknown>[] {
  if (
    !Array.isArray(value) ||
    value.some((row) => typeof row !== 'object' || row === null || Array.isArray(row))
  )
    throw new Error('Expected synthetic fixture records');
  return value as Record<string, unknown>[];
}

async function fixture(mode: 'legacy' | 'blocked') {
  const root = mkdtempSync(join(tmpdir(), 'electron-migration-'));
  const runtime = join(root, 'runtime');
  const sqlitePath = join(runtime, 'data', 'agent.sqlite');
  createMigrationProfile(sqlitePath, mode);
  for (const path of [join(root, 'home'), join(root, 'tmp')]) mkdirSync(path, { recursive: true });
  const ports = await getDesktopLaunchPorts();
  return {
    root,
    sqlitePath,
    runtime,
    ports,
    options: {
      cwd: desktopDir,
      args: ['.', `--user-data-dir=${join(root, 'profile')}`],
      env: {
        ...fixtureEnvironment(root, process.execPath, process.env),
        AGENT_PLATFORM_DESKTOP_BACKEND: 'managed',
        AGENT_PLATFORM_DESKTOP_BACKEND_PORT: String(ports.backendPort),
        AGENT_PLATFORM_DESKTOP_NODE_PATH: process.execPath,
        AGENT_PLATFORM_DESKTOP_RENDERER: 'standalone',
        AGENT_PLATFORM_DESKTOP_RENDERER_PORT: String(ports.rendererPort),
        AGENT_PLATFORM_DESKTOP_RUNTIME_DIR: runtime,
        AGENT_PLATFORM_DESKTOP_LOG_DIR: join(runtime, 'logs'),
        SECRETS_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'),
      },
    },
  };
}
function portReleased(port: number): Promise<boolean> {
  return new Promise((resolveReleased) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (released: boolean) => {
      socket.destroy();
      resolveReleased(released);
    };
    socket.once('connect', () => finish(false));
    socket.once('error', (error: NodeJS.ErrnoException) => finish(error.code === 'ECONNREFUSED'));
    socket.setTimeout(1000, () => finish(false));
  });
}

function ownedGroupExists(pid: number) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

/** This process alone was spawned detached: never signal a shared/Playwright process group. */
async function stopRejectedGroup(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await once(child, 'close', { signal: AbortSignal.timeout(5000) });
    }
    return;
  }
  for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
    if (!ownedGroupExists(child.pid)) return;
    process.kill(-child.pid, signal);
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
      if (!ownedGroupExists(child.pid)) return;
      await delay(50);
    }
  }
  throw new Error('Owned rejected desktop group did not stop; fixture retained');
}

async function removeReleasedFixture(f: Awaited<ReturnType<typeof fixture>>) {
  // If cleanup fails, retain logs/database instead of deleting files used by a surviving process.
  await expect.poll(() => portReleased(f.ports.backendPort)).toBe(true);
  await expect.poll(() => portReleased(f.ports.rendererPort)).toBe(true);
  rmSync(f.root, { recursive: true, force: true });
}

test('MIG-R06 opens a retained profile through the real managed desktop and preserves its records', async ({
  playwright,
}, info) => {
  const f = await fixture('legacy');
  const before = inspectMigrationProfile(f.sqlitePath);
  let app: ElectronApplication | undefined;
  let tracing = false;
  try {
    app = await playwright._electron.launch({
      ...f.options,
      args: [
        ...f.options.args,
        `--inspect=127.0.0.1:${f.ports.nodeInspectorPort}`,
        `--remote-debugging-port=${f.ports.chromiumDebuggerPort}`,
      ],
    });
    await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
    tracing = true;
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { name: 'Choose a workspace' })).toBeVisible();
    const health = await page.request.get(`http://127.0.0.1:${f.ports.backendPort}/health/ready`);
    expect(health.status()).toBe(200);
    const after = inspectMigrationProfile(f.sqlitePath);
    // The additive SDK migration supplies a legacy default; every original
    // record field must still match, including unrelated tables and credentials.
    for (const message of recordRows(before.retained.messages))
      expect(message).not.toHaveProperty('provider_continuation_format');
    expect(after.retained).toEqual({
      ...before.retained,
      messages: recordRows(before.retained.messages).map((message) => ({
        ...message,
        provider_continuation_format: 0,
      })),
    });
    expect(
      recordRows(after.schema).find((row) => row.type === 'table' && row.name === 'messages')?.sql,
    ).toMatch(/[`"]?provider_continuation_format[`"]? integer DEFAULT 0 NOT NULL/i);
    expect(before.tables).not.toContain('provider_continuations');
    expect(after.tables).toEqual(
      expect.arrayContaining([
        'git_delivery_operations',
        'controlled_runs',
        'run_executions',
        'run_attempts',
        'provider_continuations',
      ]),
    );
    expect(after.journal.slice(0, before.journal.length)).toEqual(before.journal);
    const pendingTags = [
      '0019_git_delivery_operations',
      '0020_run_control',
      '0021_provider_continuation',
    ];
    const migrationRoot = resolve(desktopDir, '../../packages/db/drizzle');
    const journal = JSON.parse(readFileSync(join(migrationRoot, 'meta/_journal.json'), 'utf8')) as {
      entries: { tag: string; when: number }[];
    };
    const pending = journal.entries.filter((entry) => pendingTags.includes(entry.tag));
    expect(pending.map((entry) => entry.tag)).toEqual(pendingTags);
    expect(
      recordRows(after.journal.slice(before.journal.length)).map(({ hash, created_at }) => ({
        hash,
        created_at,
      })),
    ).toEqual(
      pending.map((entry) => ({
        hash: createHash('sha256')
          .update(readFileSync(join(migrationRoot, `${entry.tag}.sql`)))
          .digest('hex'),
        created_at: entry.when,
      })),
    );
    expect(after.integrity).toBe('ok');
    expect(after.foreignKeyViolations).toBe(0);
  } finally {
    try {
      if (app && tracing) {
        const trace = info.outputPath('retained-profile-upgrade.zip');
        await app.context().tracing.stop({ path: trace });
        await info.attach('retained-profile-upgrade-trace', {
          path: trace,
          contentType: 'application/zip',
        });
      }
    } finally {
      await app?.close();
      await removeReleasedFixture(f);
    }
  }
});

// Playwright requires destructuring even when startup fails before a browser fixture is usable.
// eslint-disable-next-line no-empty-pattern
test('MIG-R06 refuses inconsistent retained history with safe diagnostics and no readiness or mutation', async ({}, info) => {
  const f = await fixture('blocked');
  const before = inspectMigrationProfile(f.sqlitePath);
  // A rejected app can exit before Playwright's Electron handshake; observe the real process instead.
  // Match Playwright's Linux Electron launch policy for this disposable fixture. The direct
  // failure-path launch must reach our main process, rather than fail in Chromium's CI sandbox.
  // This changes no product launch flags or native macOS sandbox coverage.
  const args = process.platform === 'linux' ? ['--no-sandbox', ...f.options.args] : f.options.args;
  const child = spawn(requireFromDesktop('electron') as string, args, {
    cwd: f.options.cwd,
    env: f.options.env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume();
  let stderr = '';
  child.stderr.on('data', (data: Buffer) => {
    stderr = (stderr + data.toString('utf8')).slice(-64_000);
  });
  try {
    await once(child, 'close', { signal: AbortSignal.timeout(20_000) });
    const backendLog = readFileSync(join(f.runtime, 'logs', 'backend.stderr.log'), 'utf8');
    expect(backendLog).toContain('DATABASE_MIGRATION_HISTORY_MISMATCH');
    expect(backendLog).toContain('Back up');
    expect(stderr).toContain('"phase":"stop-confirmed"');
    expect(stderr).not.toContain('"phase":"backend-ready"');
    expect(stderr).not.toContain('"phase":"window-ready"');
    expect(await portReleased(f.ports.backendPort)).toBe(true);
    expect(await portReleased(f.ports.rendererPort)).toBe(true);
    expect(inspectMigrationProfile(f.sqlitePath)).toEqual(before);
    expect(existsSync(join(f.runtime, 'data', 'diagnostics.sqlite'))).toBe(false);
    const evidence = info.outputPath('migration-startup-failure.json');
    writeFileSync(
      evidence,
      JSON.stringify({
        code: 'DATABASE_MIGRATION_HISTORY_MISMATCH',
        databasePreserved: true,
        ready: false,
        shutdownConfirmed: true,
        v1Diagnostics: 'not_started',
        wrapperExitCode: child.exitCode,
      }),
    );
    await info.attach('migration-startup-failure', {
      contentType: 'application/json',
      path: evidence,
    });
  } finally {
    try {
      // Retain isolated launch evidence even if Electron exits before creating backend logs.
      // fixtureEnvironment excludes inherited credentials and all application/provider settings.
      await info.attach('rejected-desktop-stderr', {
        body: stderr,
        contentType: 'text/plain',
      });
    } finally {
      await stopRejectedGroup(child);
      await removeReleasedFixture(f);
    }
  }
});
