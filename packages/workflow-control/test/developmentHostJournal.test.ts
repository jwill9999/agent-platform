import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  mkdtempSync,
  rmSync,
  chmodSync,
  writeFileSync,
  symlinkSync,
  linkSync,
  readFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  DevelopmentHostJournal,
  assertDevelopmentAdmission,
  developmentOwnerAlive,
  developmentEffectiveCode,
  reconcileDevelopmentProbe,
  settleDevelopmentProbeContainer,
} from '../src/developmentHostJournal.js';
import {
  classifyDevelopmentError,
  developmentHostConfigSchema,
  writeDevelopmentFile,
  DevelopmentHost,
  runDevelopmentCommand,
  assertBrokerHardening,
} from '../src/developmentHost.js';
const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'development-journal-'));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'state.sqlite');
  const journal = new DevelopmentHostJournal(path);
  cleanup.push(() => journal.close());
  return { journal, path };
}
it('fences concurrent owners even after lease expiry while the old process is alive', () => {
  const { journal } = fixture();
  const owner = journal.claim('one');
  expect(() => journal.claim('one', Date.now() + 20000)).toThrow('service_owner_active');
  expect(() => journal.claim('two')).toThrow('service_identity_mismatch');
  journal.release(owner);
  const replacement = journal.claim('one');
  expect(replacement.epoch).toBe(owner.epoch + 1);
  expect(() => journal.observe(owner, 'ready')).toThrow('service_owner_lost');
});
it('retains lost probe issuance intent across reopening until revocation is confirmed', () => {
  const { journal, path } = fixture();
  const owner = journal.claim('one');
  const id = journal.probeIntent(owner, 'generation');
  const observer = new DevelopmentHostJournal(path, true);
  try {
    expect(observer.pendingProbes()).toEqual([{ id, generation: 'generation' }]);
  } finally {
    observer.close();
  }
  journal.confirmProbe(owner, id, 'revoke');
  journal.settleProbe(owner, id);
  expect(journal.pendingProbes()).toHaveLength(1);
  journal.confirmProbe(owner, id, 'cancel');
  journal.settleProbe(owner, id);
  expect(journal.pendingProbes()).toEqual([]);
});
it('persists operator recovery and original failure after owner release', () => {
  const { journal } = fixture();
  const owner = journal.claim('one');
  journal.observe(owner, 'control_unavailable');
  journal.request('recover');
  journal.request('stop');
  journal.release(owner);
  expect(journal.state()).toMatchObject({
    code: 'control_unavailable',
    pid: null,
    recovery_requested: 1,
    stop_requested: 1,
  });
});
it('rejects a publicly readable journal', () => {
  const { path } = fixture();
  chmodSync(path, 0o644);
  expect(() => new DevelopmentHostJournal(path, true)).toThrow(
    'private_lifecycle_journal_required',
  );
});
it('redacts arbitrary transport exceptions and rejects inherited settings', () => {
  expect(classifyDevelopmentError(new Error('secret token in transport stderr'))).toBe(
    'cleanup_pending',
  );
  expect(classifyDevelopmentError(new Error('control_unavailable'))).toBe('control_unavailable');
  expect(developmentHostConfigSchema.safeParse({ mcpServers: { host: 'inherited' } }).success).toBe(
    false,
  );
});

it.each(['cancel', 'revoke'] as const)(
  'attempts both probe cleanup obligations when %s fails and preserves partial progress',
  async (failure) => {
    const { journal, path } = fixture();
    const owner = journal.claim('one');
    const id = journal.probeIntent(owner, 'generation');
    const calls: string[] = [];
    const effect = (step: string) => async () => {
      calls.push(step);
      if (step === failure) throw new Error('injected_failure');
    };
    await expect(
      reconcileDevelopmentProbe(journal, owner, id, effect('cancel'), effect('revoke')),
    ).rejects.toThrow('cleanup_pending');
    expect(calls.sort()).toEqual(['cancel', 'revoke']);
    expect(journal.pendingProbes()).toHaveLength(1);
    const db = new Database(path, { readonly: true });
    try {
      expect(db.prepare('SELECT cancel,revoke FROM development_probes').get()).toEqual({
        cancel: failure === 'cancel' ? 0 : 1,
        revoke: failure === 'revoke' ? 0 : 1,
      });
    } finally {
      db.close();
    }
    await reconcileDevelopmentProbe(
      journal,
      owner,
      id,
      async () => undefined,
      async () => undefined,
    );
    expect(journal.pendingProbes()).toEqual([]);
  },
);

it('denies admission immediately for either signal or durable stop, even with fresh readiness', () => {
  const { journal } = fixture();
  const owner = journal.claim('one');
  journal.observe(owner, 'ready');
  expect(() =>
    assertDevelopmentAdmission(journal.state()!, false, true, 'settled', Date.now(), Date.now()),
  ).not.toThrow();
  expect(() =>
    assertDevelopmentAdmission(journal.state()!, true, true, 'settled', Date.now(), Date.now()),
  ).toThrow('control_unavailable');
  journal.request('stop');
  expect(() =>
    assertDevelopmentAdmission(journal.state()!, false, true, 'settled', Date.now(), Date.now()),
  ).toThrow('control_unavailable');
});

it.each(['symlink', 'hardlink'] as const)(
  'preserves an account behind a generated %s alias',
  async (kind) => {
    const root = mkdtempSync(join(tmpdir(), 'lifecycle-alias-'));
    cleanup.push(() => rmSync(root, { recursive: true, force: true }));
    const account = join(root, 'account.json'),
      generated = join(root, 'server.json');
    writeFileSync(account, 'preserve-account', { mode: 0o600 });
    if (kind === 'symlink') symlinkSync(account, generated);
    else linkSync(account, generated);
    await expect(writeDevelopmentFile(generated, 'replacement')).rejects.toThrow(
      'invalid_configuration',
    );
    expect(readFileSync(account, 'utf8')).toBe('preserve-account');
  },
);

it('rejects an account inside the generated state directory before opening its journal', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lifecycle-account-'));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const stateDirectory = join(root, 'state');
  mkdirSync(stateDirectory, { mode: 0o700 });
  const accountFile = join(stateDirectory, 'server.json');
  writeFileSync(accountFile, 'preserve', { mode: 0o600 });
  await expect(
    DevelopmentHost.create({
      stateDirectory,
      accountFile,
      brokerImage: 'sha256:' + 'a'.repeat(64),
      workerImage: 'sha256:' + 'b'.repeat(64),
      containerUser: '501:20',
      controlPort: 19341,
      clientVersion: 'fixture',
    }),
  ).rejects.toThrow('invalid_configuration');
  expect(readFileSync(accountFile, 'utf8')).toBe('preserve');
});

it.each(['runtime', 'command'] as const)(
  'preserves an input %s file colliding with generated state',
  async (kind) => {
    const root = mkdtempSync(join(tmpdir(), 'lifecycle-input-'));
    cleanup.push(() => rmSync(root, { recursive: true, force: true }));
    const stateDirectory = join(root, 'state');
    mkdirSync(stateDirectory, { mode: 0o700 });
    const accountFile = join(root, 'account.json');
    writeFileSync(accountFile, '{}', { mode: 0o600 });
    const path = join(stateDirectory, 'adapter.json');
    const config = {
      stateDirectory,
      accountFile,
      brokerImage: 'sha256:' + 'a'.repeat(64),
      workerImage: 'sha256:' + 'b'.repeat(64),
      containerUser: `${process.getuid?.() || 501}:20`,
      controlPort: 19341,
      clientVersion: 'fixture',
    };
    const bytes = kind === 'runtime' ? 'preserve-runtime' : JSON.stringify(config);
    writeFileSync(path, bytes, { mode: 0o600 });
    const action =
      kind === 'runtime'
        ? DevelopmentHost.create({
            ...config,
            workflow: { database: join(root, 'workflow.sqlite'), runtimeConfig: path },
          })
        : runDevelopmentCommand('development-host', path);
    await expect(action).rejects.toThrow('invalid_configuration');
    expect(readFileSync(path, 'utf8')).toBe(bytes);
  },
);

it('preserves a real workflow SQLite database at a generated destination', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lifecycle-db-'));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const stateDirectory = join(root, 'state');
  mkdirSync(stateDirectory, { mode: 0o700 });
  const accountFile = join(root, 'account.json'),
    runtimeConfig = join(root, 'runtime.json'),
    database = join(stateDirectory, 'adapter.json');
  writeFileSync(accountFile, '{}', { mode: 0o600 });
  writeFileSync(runtimeConfig, '{}', { mode: 0o600 });
  const db = new Database(database);
  db.exec("CREATE TABLE retained(value TEXT); INSERT INTO retained VALUES('preserve');");
  db.close();
  const original = readFileSync(database);
  await expect(
    DevelopmentHost.create({
      stateDirectory,
      accountFile,
      brokerImage: 'sha256:' + 'a'.repeat(64),
      workerImage: 'sha256:' + 'b'.repeat(64),
      containerUser: `${process.getuid?.() || 501}:20`,
      controlPort: 19341,
      clientVersion: 'fixture',
      workflow: { database, runtimeConfig },
    }),
  ).rejects.toThrow('invalid_configuration');
  expect(readFileSync(database)).toEqual(original);
});

it('distinguishes a reused live PID from the recorded supervisor incarnation', () => {
  const { journal, path } = fixture();
  const owner = journal.claim('one');
  expect(developmentOwnerAlive(owner)).toBe(true);
  const db = new Database(path);
  try {
    db.prepare(
      "UPDATE development_host SET process_identity='older-process-incarnation',lease_until_ms=0",
    ).run();
  } finally {
    db.close();
  }
  expect(developmentOwnerAlive(journal.state())).toBe(false);
  const replacement = journal.claim('one');
  expect(replacement.epoch).toBe(owner.epoch + 1);
  expect(developmentOwnerAlive(replacement)).toBe(true);
});

it.each([
  { CapAdd: ['SYS_ADMIN'] },
  { SecurityOpt: ['no-new-privileges', 'seccomp=unconfined'] },
  { PidMode: 'host' },
  { Devices: [{}] },
])('rejects additional broker hardening authority %j', (extra) => {
  const base = { CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'], IpcMode: 'private' };
  expect(() => assertBrokerHardening(base)).not.toThrow();
  expect(() => assertBrokerHardening({ ...base, ...extra })).toThrow('service_identity_mismatch');
});

it('rejects stale topology even when broker readiness is freshly refreshed', () => {
  const { journal } = fixture();
  const owner = journal.claim('one');
  journal.observe(owner, 'ready');
  expect(() =>
    assertDevelopmentAdmission(
      journal.state()!,
      false,
      true,
      'settled',
      Date.now(),
      Date.now() - 5001,
    ),
  ).toThrow('topology_stale');
});

it('bounds the entire topology check rather than each individual inspection', async () => {
  const { checkDevelopmentTopology } = await import('../src/developmentHost.js');
  await expect(checkDevelopmentTopology(() => new Promise(() => undefined), 10)).rejects.toThrow(
    'topology_stale',
  );
});

it.each([
  'permissions',
  'uid',
  'json',
  'runtime-json',
  'runtime-null',
  'runtime-missing-image',
  'runtime-array',
])('reports invalid private configuration through the CLI: %s', (kind) => {
  const root = mkdtempSync(join(tmpdir(), 'lifecycle-invalid-'));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const accountFile = join(root, 'account.json');
  writeFileSync(accountFile, '{}', { mode: 0o600 });
  const config = join(root, 'config.json');
  writeFileSync(
    config,
    JSON.stringify({
      stateDirectory: join(root, 'state'),
      accountFile,
      brokerImage: 'sha256:' + 'a'.repeat(64),
      workerImage: 'sha256:' + 'b'.repeat(64),
      containerUser: `${(process.getuid?.() ?? 501) + (kind === 'uid' ? 1 : 0)}:20`,
      controlPort: 19341,
      clientVersion: 'fixture',
    }),
    { mode: kind === 'permissions' ? 0o644 : 0o600 },
  );
  if (kind === 'json') writeFileSync(config, '{');
  if (kind.startsWith('runtime-')) {
    const runtimeConfig = join(root, 'runtime.json'),
      database = join(root, 'workflow.sqlite');
    writeFileSync(
      runtimeConfig,
      kind === 'runtime-json'
        ? '{'
        : kind === 'runtime-null'
          ? 'null'
          : kind === 'runtime-array'
            ? '[]'
            : JSON.stringify({
                runId: 'fixture',
                sourceRoot: root,
                containerUser: `${process.getuid?.() || 501}:20`,
              }),
      { mode: 0o600 },
    );
    writeFileSync(database, '');
    const body = JSON.parse(readFileSync(config, 'utf8'));
    body.workflow = { runtimeConfig, database };
    writeFileSync(config, JSON.stringify(body));
  }

  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../dist/cli.js', import.meta.url)), 'development-host', config],
    { env: {}, encoding: 'utf8', timeout: 10000 },
  );
  expect(result.status).toBe(2);
  expect(result.stdout + result.stderr).toContain('invalid_configuration');
  expect(result.stdout + result.stderr).not.toContain('cleanup_pending');
});

it('persists readiness expiry so status and admission agree while the owner lease is live', () => {
  const { journal, path } = fixture();
  const now = Date.now(),
    owner = journal.claim('one', now);
  journal.observe(owner, 'ready', now, now + 1000);
  const observer = new DevelopmentHostJournal(path, true);
  try {
    const state = observer.state()!;
    expect(state.lease_until_ms).toBeGreaterThan(now + 2000);
    expect(developmentEffectiveCode(state, now + 999)).toBe('ready');
    expect(developmentEffectiveCode(state, now + 1000)).toBe('topology_stale');
    expect(() =>
      assertDevelopmentAdmission(state, false, true, 'settled', now + 1000, now),
    ).toThrow('control_unavailable');
  } finally {
    observer.close();
  }
});

it('retains uncertain probe creation across owner replacement and reconciles only the late exact container', async () => {
  const { journal, path } = fixture();
  const owner = journal.claim('one');
  const id = journal.probeIntent(owner, 'generation');
  journal.beginProbeCreate(owner, id);
  const absent = async () => undefined;
  const removed: string[] = [];
  await expect(
    reconcileDevelopmentProbe(
      journal,
      owner,
      id,
      () =>
        settleDevelopmentProbeContainer(journal, owner, id, absent, async (value) => {
          removed.push(value);
        }),
      async () => undefined,
    ),
  ).rejects.toThrow('cleanup_pending');
  expect(removed).toEqual([]);
  expect(() => journal.confirmProbe(owner, id, 'cancel')).toThrow('cleanup_pending');
  journal.release(owner);
  const reopened = new DevelopmentHostJournal(path);
  try {
    const next = reopened.claim('one');
    expect(reopened.probeContainer(id)).toEqual({
      create_state: 'create_pending',
      container_id: null,
    });
    expect(() => reopened.bindProbeContainer(owner, id, 'a'.repeat(64))).toThrow(
      'service_owner_lost',
    );
    let container: string | undefined = 'b'.repeat(64);
    await reconcileDevelopmentProbe(
      reopened,
      next,
      id,
      () =>
        settleDevelopmentProbeContainer(
          reopened,
          next,
          id,
          async () => container,
          async (value) => {
            removed.push(value);
            container = undefined;
          },
        ),
      async () => undefined,
    );
    expect(removed).toEqual(['b'.repeat(64)]);
    expect(reopened.pendingProbes()).toEqual([]);
    reopened.release(next);
  } finally {
    reopened.close();
  }
});

it('requires confirmed removal before reusing a probe intent for the revoked-token check', async () => {
  const { journal } = fixture();
  const owner = journal.claim('one');
  const id = journal.probeIntent(owner, 'generation');
  journal.beginProbeCreate(owner, id);
  expect(() => journal.beginProbeCreate(owner, id)).toThrow('cleanup_pending');
  journal.bindProbeContainer(owner, id, 'a'.repeat(64));
  await settleDevelopmentProbeContainer(
    journal,
    owner,
    id,
    async () => undefined,
    async () => undefined,
  );
  journal.beginProbeCreate(owner, id);
  expect(journal.probeContainer(id)).toEqual({
    create_state: 'create_pending',
    container_id: null,
  });
  expect(() => journal.confirmProbeRemoval(owner, id, 'a'.repeat(64))).toThrow('cleanup_pending');
});

it('rolls back probe schema addition when legacy backfill fails and preserves uncertainty after reopen', async () => {
  const root = mkdtempSync(join(tmpdir(), 'probe-upgrade-'));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, 'state.sqlite');
  const legacy = new Database(path);
  legacy.exec(`CREATE TABLE development_probes (
    id TEXT PRIMARY KEY,generation TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',
    created_at_ms INTEGER NOT NULL,cancel INTEGER NOT NULL DEFAULT 0,revoke INTEGER NOT NULL DEFAULT 0,
    container_id TEXT);
    INSERT INTO development_probes(id,generation,created_at_ms) VALUES('legacy','generation',0);
    CREATE TRIGGER interrupt_backfill BEFORE UPDATE ON development_probes BEGIN
      SELECT RAISE(ABORT,'injected_migration_failure');
    END;`);
  legacy.close();
  chmodSync(path, 0o600);
  expect(() => new DevelopmentHostJournal(path)).toThrow('injected_migration_failure');
  const inspect = new Database(path);
  try {
    expect(
      (
        inspect.prepare('PRAGMA table_info(development_probes)').all() as Array<{ name: string }>
      ).map((row) => row.name),
    ).not.toContain('create_state');
    inspect.exec('DROP TRIGGER interrupt_backfill');
  } finally {
    inspect.close();
  }
  const reopened = new DevelopmentHostJournal(path);
  try {
    const owner = reopened.claim('one');
    expect(reopened.probeContainer('legacy')).toEqual({
      create_state: 'create_pending',
      container_id: null,
    });
    await expect(
      reconcileDevelopmentProbe(
        reopened,
        owner,
        'legacy',
        () =>
          settleDevelopmentProbeContainer(
            reopened,
            owner,
            'legacy',
            async () => undefined,
            async () => undefined,
          ),
        async () => undefined,
      ),
    ).rejects.toThrow('cleanup_pending');
    expect(reopened.pendingProbes()).toHaveLength(1);
    expect(reopened.state()?.code).toBe('starting');
    reopened.release(owner);
  } finally {
    reopened.close();
  }
});
