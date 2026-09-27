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
  reconcileDevelopmentProbe,
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
  expect(() => assertDevelopmentAdmission(journal.state()!, false, true, 'settled')).not.toThrow();
  expect(() => assertDevelopmentAdmission(journal.state()!, true, true, 'settled')).toThrow(
    'control_unavailable',
  );
  journal.request('stop');
  expect(() => assertDevelopmentAdmission(journal.state()!, false, true, 'settled')).toThrow(
    'control_unavailable',
  );
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
