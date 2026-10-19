import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
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
import { isDeepStrictEqual } from 'node:util';
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

async function fixture(mode: 'legacy' | 'blocked' | 'sdk-watermark') {
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

type ProfileTable = { name: string; columns: string[]; rows: Record<string, unknown>[] };
type ProfileSnapshot = { tables: ProfileTable[]; journal: Record<string, unknown>[] };
type ReadOnlySqlite = {
  prepare(sql: string): { all(): unknown[] };
  close(): void;
};

/** Independent read-only inspection of every original column, including encrypted records. */
function fullProfileSnapshot(sqlitePath: string): ProfileSnapshot {
  const requireFromDb = createRequire(resolve(desktopDir, '../../packages/db/package.json'));
  const Database = requireFromDb('better-sqlite3') as new (
    path: string,
    options: { readonly: true; fileMustExist: true },
  ) => ReadOnlySqlite;
  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;
  try {
    const tables = recordRows(
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='__drizzle_migrations' ORDER BY name",
        )
        .all(),
    );
    return {
      tables: tables.map(({ name }) => {
        if (typeof name !== 'string') throw new Error('Expected a synthetic table name');
        return {
          name,
          columns: recordRows(sqlite.prepare(`PRAGMA table_info(${quoted(name)})`).all()).map(
            (column) => {
              if (typeof column.name !== 'string') throw new Error('Expected a synthetic column');
              return column.name;
            },
          ),
          rows: recordRows(sqlite.prepare(`SELECT * FROM ${quoted(name)} ORDER BY rowid`).all()),
        };
      }),
      journal: recordRows(
        sqlite.prepare('SELECT * FROM __drizzle_migrations ORDER BY rowid').all(),
      ),
    };
  } finally {
    sqlite.close();
  }
}

function originalRowsRetained(original: ProfileTable, current: ProfileTable): boolean {
  const remaining = [...current.rows];
  return original.rows.every((row) => {
    const index = remaining.findIndex((candidate) =>
      original.columns.every((column) => isDeepStrictEqual(candidate[column], row[column])),
    );
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}

function expectOriginalProfilePreserved(original: ProfileSnapshot, current: ProfileSnapshot) {
  for (const table of original.tables) {
    const upgraded = current.tables.find((candidate) => candidate.name === table.name);
    expect(upgraded?.columns, `Original columns remain in ${table.name}`).toEqual(
      expect.arrayContaining(table.columns),
    );
    // Compare in memory and publish only a boolean: never attach encrypted credential fields.
    expect(
      upgraded !== undefined && originalRowsRetained(table, upgraded),
      `Every original record remains unchanged in ${table.name}`,
    ).toBe(true);
  }
}

async function expectAllFixturePortsReleased(f: Awaited<ReturnType<typeof fixture>>) {
  for (const port of Object.values(f.ports)) await expect.poll(() => portReleased(port)).toBe(true);
}

async function viewRetainedSdkConfiguration(page: Page, backendPort: number) {
  await expect(page.getByRole('heading', { name: 'Choose a workspace' })).toBeVisible();
  const health = await page.request.get(`http://127.0.0.1:${backendPort}/health/ready`);
  expect(health.status()).toBe(200);
  await expect(
    page
      .getByRole('region', { name: 'Recent Projects' })
      .getByLabel('Retained synthetic Project open again to reconnect', {
        exact: true,
      }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open settings menu' }).click();
  await page.getByRole('menuitem', { name: /Models/ }).click();
  await expect(page.getByRole('heading', { name: 'Models & API Keys' })).toBeVisible();
  const card = page
    .getByRole('heading', { name: 'Retained synthetic model', exact: true })
    .locator('..');
  await expect(card.getByText('synthetic-retained-model', { exact: true })).toBeVisible();
  await expect(card.getByText('🔑 Key stored', { exact: true })).toBeVisible();
}

function sdkMigrationStamp() {
  const migrationRoot = resolve(desktopDir, '../../packages/db/drizzle');
  const journal = JSON.parse(readFileSync(join(migrationRoot, 'meta/_journal.json'), 'utf8')) as {
    entries: { idx: number; tag: string; when: number }[];
  };
  const stamp = (entry: { tag: string; when: number }) => ({
    hash: createHash('sha256')
      .update(readFileSync(join(migrationRoot, `${entry.tag}.sql`)))
      .digest('hex'),
    created_at: entry.when,
  });
  const sdk = journal.entries.find((entry) => entry.tag === '0021_provider_continuation');
  if (!sdk) throw new Error('Expected the canonical SDK migration');
  return {
    sdk: stamp(sdk),
    predecessors: journal.entries.filter((entry) => entry.idx < 21).map(stamp),
  };
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

function sdkMigrationSourceHashes() {
  const root = resolve(desktopDir, '../..');
  return Object.fromEntries(
    [
      'apps/desktop/e2e/migration-startup.e2e.ts',
      'scripts/testing/migration-profile.mjs',
      'packages/db/src/migrationHistory.ts',
      'packages/db/src/database.ts',
      'packages/db/drizzle/0021_provider_continuation.sql',
      'packages/db/dist/migrationHistory.js',
      'packages/db/dist/database.js',
      'apps/api/dist/index.js',
      'apps/desktop/dist/main/main.js',
    ].map((path) => [
      path,
      existsSync(join(root, path))
        ? createHash('sha256')
            .update(readFileSync(join(root, path)))
            .digest('hex')
        : null,
    ]),
  );
}

test('SDK-MIG05 upgrades a pre-SDK watermark profile and restarts without replay or lost configuration', async ({
  playwright,
}, info) => {
  const f = await fixture('sdk-watermark');
  const evidence = {
    scenarioPassed: false,
    qualified: false,
    originalTables: 0,
    originalRecords: 0,
    originalJournalRows: 0,
    canonicalAddition: undefined as ReturnType<typeof sdkMigrationStamp>['sdk'] | undefined,
    legacyOpaqueValuePreserved: false,
    generationOrProbeRequests: 0,
    phases: [] as {
      phase: string;
      journalRows: number;
      originalRecordsPreserved: boolean;
      workspaceAndConfigurationVisible: boolean;
    }[],
    shutdown: [] as string[],
    ownedPortsReleased: false,
    sourceHashes: {} as ReturnType<typeof sdkMigrationSourceHashes>,
    backendLog: { available: false, migrationHistoryMismatchObserved: false },
  };
  let app: ElectronApplication | undefined;
  let tracing = false;
  let activePhase = 'upgrade';
  let upgraded: ProfileSnapshot | undefined;
  try {
    const before = fullProfileSnapshot(f.sqlitePath);
    const canonical = sdkMigrationStamp();
    expect(canonical.sdk.created_at).toBe(1778000000000);
    expect(before.journal).toHaveLength(22);
    expect(
      before.journal.slice(0, 21).map(({ hash, created_at }) => ({ hash, created_at })),
    ).toEqual(canonical.predecessors);
    expect(before.journal[21]?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(Number(before.journal[21]?.created_at)).toBeGreaterThan(canonical.sdk.created_at);
    expect(before.tables.some((table) => table.name === 'provider_continuations')).toBe(false);
    expect(before.tables.find((table) => table.name === 'messages')?.columns).not.toContain(
      'provider_continuation_format',
    );
    expect(before.tables.find((table) => table.name === 'messages')?.columns).toContain(
      'workspace_events_json',
    );
    expect(
      before.tables
        .find((table) => table.name === 'messages')
        ?.rows.find((row) => row.id === 'retained-message')?.workspace_events_json,
    ).toBe('{"syntheticOpaqueWorkspaceEvent":"retain-exactly"}');
    evidence.originalTables = before.tables.length;
    evidence.originalRecords = before.tables.reduce((count, table) => count + table.rows.length, 0);
    evidence.originalJournalRows = before.journal.length;
    evidence.canonicalAddition = canonical.sdk;
    for (const phase of ['upgrade', 'restart']) {
      activePhase = phase;
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
      page.on('request', (request) => {
        const path = new URL(request.url()).pathname;
        if (
          request.method() === 'POST' &&
          (path === '/api/chat' || (path.includes('/model-configs/') && path.endsWith('/test')))
        )
          evidence.generationOrProbeRequests++;
      });
      const after = fullProfileSnapshot(f.sqlitePath);
      expectOriginalProfilePreserved(before, after);
      evidence.legacyOpaqueValuePreserved = true;
      const inspected = inspectMigrationProfile(f.sqlitePath);
      expect(inspected.integrity).toBe('ok');
      expect(inspected.foreignKeyViolations).toBe(0);
      expect(after.journal.slice(0, before.journal.length)).toEqual(before.journal);
      expect(after.journal).toHaveLength(before.journal.length + 1);
      expect(
        after.journal
          .slice(before.journal.length)
          .map(({ hash, created_at }) => ({ hash, created_at })),
      ).toEqual([canonical.sdk]);
      expect(after.tables.find((table) => table.name === 'provider_continuations')?.rows).toEqual(
        [],
      );
      expect(
        after.tables
          .find((table) => table.name === 'messages')
          ?.rows.every((message) => message.provider_continuation_format === 0),
      ).toBe(true);
      expect(
        after.tables
          .find((table) => table.name === 'model_configs')
          ?.rows.find((config) => config.id === 'retained-model-config')?.base_url,
      ).toBeNull();
      if (upgraded) {
        expect(after.journal).toEqual(upgraded.journal);
        expect(after.tables.map(({ name, columns }) => ({ name, columns }))).toEqual(
          upgraded.tables.map(({ name, columns }) => ({ name, columns })),
        );
      }
      upgraded = after;
      const phaseEvidence = {
        phase,
        journalRows: after.journal.length,
        originalRecordsPreserved: true,
        workspaceAndConfigurationVisible: false,
      };
      evidence.phases.push(phaseEvidence);
      await viewRetainedSdkConfiguration(page, f.ports.backendPort);
      phaseEvidence.workspaceAndConfigurationVisible = true;
      expect(evidence.generationOrProbeRequests).toBe(0);
      const trace = info.outputPath(`sdk-watermark-${phase}.zip`);
      await app.context().tracing.stop({ path: trace });
      tracing = false;
      await info.attach(`sdk-watermark-${phase}-trace`, {
        path: trace,
        contentType: 'application/zip',
      });
      await app.close();
      evidence.shutdown.push('fulfilled');
      app = undefined;
      await expectAllFixturePortsReleased(f);
    }
    evidence.scenarioPassed = true;
  } finally {
    try {
      if (app && tracing) {
        const trace = info.outputPath(`sdk-watermark-${activePhase}-failure.zip`);
        await app.context().tracing.stop({ path: trace });
        await info.attach('sdk-watermark-failure-trace', {
          path: trace,
          contentType: 'application/zip',
        });
      }
    } finally {
      const shutdown = await Promise.allSettled(app ? [app.close()] : []);
      evidence.shutdown.push(...shutdown.map((result) => result.status));
      try {
        await expectAllFixturePortsReleased(f);
        evidence.ownedPortsReleased = true;
      } catch {
        evidence.ownedPortsReleased = false;
      }
      evidence.qualified =
        evidence.scenarioPassed &&
        evidence.ownedPortsReleased &&
        evidence.shutdown.every((status) => status === 'fulfilled');
      evidence.sourceHashes = sdkMigrationSourceHashes();
      const backendLogPath = join(f.runtime, 'logs', 'backend.stderr.log');
      evidence.backendLog.available = existsSync(backendLogPath);
      evidence.backendLog.migrationHistoryMismatchObserved =
        evidence.backendLog.available &&
        readFileSync(backendLogPath, 'utf8').includes('DATABASE_MIGRATION_HISTORY_MISMATCH');
      evidence.qualified &&=
        Object.values(evidence.sourceHashes).every((hash) => hash !== null) &&
        evidence.backendLog.available &&
        !evidence.backendLog.migrationHistoryMismatchObserved;
      await info.attach('sdk-watermark-migration-evaluation', {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json',
      });
      expect(evidence.shutdown.every((status) => status === 'fulfilled')).toBe(true);
      expect(evidence.ownedPortsReleased).toBe(true);
      expect(Object.values(evidence.sourceHashes).every((hash) => hash !== null)).toBe(true);
      expect(evidence.backendLog.available).toBe(true);
      expect(evidence.backendLog.migrationHistoryMismatchObserved).toBe(false);
      await removeReleasedFixture(f);
    }
  }
});
