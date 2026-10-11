import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { readFileSync, chmodSync, lstatSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

export interface DevelopmentHostState {
  service_id: string;
  config_digest: string;
  pid: number | null;
  process_identity: string | null;
  epoch: number;
  lease_until_ms: number;
  code: string;
  observed_at_ms: number;
  ready_until_ms: number;
  stop_requested: number;
  recovery_requested: number;
}

export function developmentProcessIdentity(pid: number): string | undefined {
  try {
    process.kill(pid, 0);
    let identity: string;
    if (process.platform === 'linux') {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const start = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
      identity = readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() + ':' + start;
    } else if (process.platform === 'darwin') {
      const boot = execFileSync('/usr/sbin/sysctl', ['-n', 'kern.boottime'], {
        env: {},
        timeout: 2000,
        encoding: 'utf8',
      }).trim();
      const start = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'comm='], {
        env: { LC_ALL: 'C' },
        timeout: 2000,
        encoding: 'utf8',
      }).trim();
      if (!start) return undefined;
      identity = boot + ':' + start;
    } else throw new Error('process_identity_unavailable');
    return createHash('sha256').update(identity).digest('hex');
  } catch (error) {
    if (['ESRCH', 'ENOENT'].includes((error as NodeJS.ErrnoException).code ?? '')) return undefined;
    throw new Error('process_identity_unavailable');
  }
}
export function developmentOwnerAlive(owner: DevelopmentHostState | undefined): boolean {
  if (!owner?.pid) return false;
  const identity = developmentProcessIdentity(owner.pid);
  if (!identity) return false;
  if (!owner.process_identity) throw new Error('process_identity_unavailable');
  return identity === owner.process_identity;
}

function migrateHostColumns(db: Database.Database): void {
  const hostColumns = db.prepare('PRAGMA table_info(development_host)').all() as Array<{
    name: string;
  }>;
  if (!hostColumns.some((column) => column.name === 'ready_until_ms'))
    db.exec('ALTER TABLE development_host ADD COLUMN ready_until_ms INTEGER NOT NULL DEFAULT 0');
  if (!hostColumns.some((column) => column.name === 'process_identity'))
    db.exec('ALTER TABLE development_host ADD COLUMN process_identity TEXT');
}

function migrateProbeColumns(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(development_probes)').all() as Array<{
    name: string;
  }>;
  if (!columns.some((item) => item.name === 'container_id'))
    db.exec('ALTER TABLE development_probes ADD COLUMN container_id TEXT');
  for (const column of ['cancel', 'revoke'])
    if (!columns.some((item) => item.name === column))
      db.exec(`ALTER TABLE development_probes ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`);
  if (!columns.some((item) => item.name === 'create_state')) {
    db.exec(
      "ALTER TABLE development_probes ADD COLUMN create_state TEXT NOT NULL DEFAULT 'not_dispatched'",
    );
    db.exec(
      "UPDATE development_probes SET create_state=CASE WHEN container_id IS NULL THEN 'create_pending' ELSE 'acknowledged' END WHERE state='pending'",
    );
  }
}

/** Private operator journal. Never mounted into a worker or used as workflow/task authority. */
export class DevelopmentHostJournal {
  readonly #db: Database.Database;
  constructor(path: string, readonly = false) {
    try {
      const file = lstatSync(path);
      if (!file.isFile() || file.isSymbolicLink() || (file.mode & 0o077) !== 0 || file.nlink !== 1)
        throw new Error('private_lifecycle_journal_required');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || readonly) throw error;
    }
    this.#db = new Database(path, { readonly, fileMustExist: readonly });
    this.#db.pragma('busy_timeout = 2000');
    if (!readonly) {
      chmodSync(path, 0o600);
      this.#db.pragma('journal_mode = DELETE');
      this.#db.pragma('synchronous = FULL');
      this.#db.exec(`CREATE TABLE IF NOT EXISTS development_host (
        singleton INTEGER PRIMARY KEY CHECK(singleton=1), service_id TEXT NOT NULL,
        config_digest TEXT NOT NULL,pid INTEGER,epoch INTEGER NOT NULL,lease_until_ms INTEGER NOT NULL,
        code TEXT NOT NULL,observed_at_ms INTEGER NOT NULL,stop_requested INTEGER NOT NULL DEFAULT 0,
        recovery_requested INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS development_probes (
          id TEXT PRIMARY KEY,generation TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',
          created_at_ms INTEGER NOT NULL,cancel INTEGER NOT NULL DEFAULT 0,revoke INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS development_events (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL,observed_at_ms INTEGER NOT NULL);
      `);
      try {
        this.#db
          .transaction(() => {
            migrateHostColumns(this.#db);
            migrateProbeColumns(this.#db);
          })
          .immediate();
      } catch (error) {
        this.#db.close();
        throw error;
      }
    }
  }
  close(): void {
    this.#db.close();
  }
  state(): DevelopmentHostState | undefined {
    return this.#db.prepare('SELECT * FROM development_host WHERE singleton=1').get() as
      | DevelopmentHostState
      | undefined;
  }
  claim(configDigest: string, now = Date.now()): DevelopmentHostState {
    return this.#db
      .transaction(() => {
        const old = this.state();
        if (old && old.config_digest !== configDigest) throw new Error('service_identity_mismatch');
        if (old?.pid) {
          if (developmentOwnerAlive(old) || old.lease_until_ms > now)
            throw new Error('service_owner_active');
        }
        if (!old)
          this.#db
            .prepare(
              `INSERT INTO development_host
        (singleton,service_id,config_digest,pid,epoch,lease_until_ms,code,observed_at_ms)
        VALUES(1,?,?,?,1,?,'starting',?)`,
            )
            .run(randomUUID(), configDigest, process.pid, now + 15000, now);
        else
          this.#db
            .prepare(
              `UPDATE development_host SET pid=?,epoch=epoch+1,lease_until_ms=?,
        code='starting',observed_at_ms=?,stop_requested=0 WHERE singleton=1`,
            )
            .run(process.pid, now + 15000, now);
        this.#db
          .prepare('UPDATE development_host SET process_identity=? WHERE singleton=1')
          .run(developmentProcessIdentity(process.pid));
        return this.state()!;
      })
      .immediate();
  }
  assertOwner(owner: DevelopmentHostState, now = Date.now()): void {
    const current = this.state();
    if (
      !current ||
      current.pid !== process.pid ||
      current.epoch !== owner.epoch ||
      current.lease_until_ms <= now
    )
      throw new Error('service_owner_lost');
  }
  renew(owner: DevelopmentHostState, now = Date.now()): void {
    this.#db
      .transaction(() => {
        this.assertOwner(owner, now);
        this.#db
          .prepare('UPDATE development_host SET lease_until_ms=? WHERE singleton=1')
          .run(now + 15000);
      })
      .immediate();
  }
  observe(
    owner: DevelopmentHostState,
    code: string,
    now = Date.now(),
    readyUntil = now + 5000,
  ): void {
    if (!/^[a-z][a-z0-9_]{0,95}$/u.test(code)) throw new Error('invalid_status_code');
    this.#db
      .transaction(() => {
        this.assertOwner(owner, now);
        if (this.state()!.code !== code)
          this.#db
            .prepare('INSERT INTO development_events(code,observed_at_ms) VALUES(?,?)')
            .run(code, now);
        this.#db
          .prepare(
            'UPDATE development_host SET code=?,observed_at_ms=?,ready_until_ms=? WHERE singleton=1',
          )
          .run(code, now, code === 'ready' ? Math.min(now + 5000, readyUntil) : 0);
      })
      .immediate();
  }
  release(owner: DevelopmentHostState): void {
    this.#db
      .transaction(() => {
        this.assertOwner(owner);
        this.#db
          .prepare(
            "UPDATE development_host SET pid=NULL,lease_until_ms=0,code=CASE WHEN code IN ('ready','starting') THEN 'stopped' ELSE code END WHERE singleton=1",
          )
          .run();
      })
      .immediate();
  }
  request(kind: 'stop' | 'recover'): void {
    if (!this.state()) throw new Error('service_not_started');
    this.#db
      .prepare(
        kind === 'stop'
          ? 'UPDATE development_host SET stop_requested=1 WHERE singleton=1'
          : 'UPDATE development_host SET recovery_requested=recovery_requested+1 WHERE singleton=1',
      )
      .run();
  }
  probeIntent(owner: DevelopmentHostState, generation: string): string {
    return this.#db
      .transaction(() => {
        this.assertOwner(owner);
        const id = randomUUID();
        this.#db
          .prepare('INSERT INTO development_probes(id,generation,created_at_ms) VALUES(?,?,?)')
          .run(id, generation, Date.now());
        return id;
      })
      .immediate();
  }
  pendingProbes(): Array<{ id: string; generation: string }> {
    return this.#db
      .prepare("SELECT id,generation FROM development_probes WHERE state='pending'")
      .all() as Array<{ id: string; generation: string }>;
  }
  probeContainer(id: string): { create_state: string; container_id: string | null } {
    const row = this.#db
      .prepare(
        "SELECT create_state,container_id FROM development_probes WHERE id=? AND state='pending'",
      )
      .get(id) as { create_state: string; container_id: string | null } | undefined;
    if (!row) throw new Error('probe_intent_missing');
    return row;
  }
  beginProbeCreate(owner: DevelopmentHostState, id: string): void {
    this.#db
      .transaction(() => {
        this.assertOwner(owner);
        const result = this.#db
          .prepare(
            "UPDATE development_probes SET create_state='create_pending',container_id=NULL,cancel=0 WHERE id=? AND state='pending' AND create_state IN ('not_dispatched','removal_confirmed')",
          )
          .run(id);
        if (result.changes !== 1) throw new Error('cleanup_pending');
      })
      .immediate();
  }
  confirmProbeRemoval(owner: DevelopmentHostState, id: string, containerId: string): void {
    this.#db
      .transaction(() => {
        this.assertOwner(owner);
        const result = this.#db
          .prepare(
            "UPDATE development_probes SET create_state='removal_confirmed' WHERE id=? AND state='pending' AND create_state='acknowledged' AND container_id=?",
          )
          .run(id, containerId);
        if (result.changes !== 1) throw new Error('cleanup_pending');
      })
      .immediate();
  }
  bindProbeContainer(owner: DevelopmentHostState, id: string, containerId: string): void {
    this.#db
      .transaction(() => {
        this.assertOwner(owner);
        if (!/^[a-f0-9]{64}$/u.test(containerId)) throw new Error('invalid_container_id');
        const result = this.#db
          .prepare(
            "UPDATE development_probes SET container_id=?,create_state='acknowledged' WHERE id=? AND state='pending' AND create_state='create_pending' AND container_id IS NULL",
          )
          .run(containerId, id);
        if (result.changes !== 1) throw new Error('cleanup_pending');
      })
      .immediate();
  }
  hasProbeContainer(id: string, probeId?: string): boolean {
    return !!this.#db
      .prepare(
        "SELECT 1 FROM development_probes WHERE state='pending' AND (container_id=? OR (id=? AND create_state='create_pending'))",
      )
      .get(id, probeId ?? '');
  }
  confirmProbe(owner: DevelopmentHostState, id: string, step: 'cancel' | 'revoke'): void {
    this.#db
      .transaction(() => {
        this.assertOwner(owner);
        if (
          step === 'cancel' &&
          !['not_dispatched', 'removal_confirmed'].includes(this.probeContainer(id).create_state)
        )
          throw new Error('cleanup_pending');
        this.#db
          .prepare(`UPDATE development_probes SET ${step}=1 WHERE id=? AND state='pending'`)
          .run(id);
      })
      .immediate();
  }
  settleProbe(owner: DevelopmentHostState, id: string): void {
    this.#db
      .transaction(() => {
        this.assertOwner(owner);
        this.#db
          .prepare(
            "UPDATE development_probes SET state='settled' WHERE id=? AND cancel=1 AND revoke=1",
          )
          .run(id);
      })
      .immediate();
  }
}

/** Absence after an initiated create is not proof of cancellation. Exact acknowledged IDs
 * can be removed/reobserved; unacknowledged requests remain pending across restart. */
export async function settleDevelopmentProbeContainer(
  journal: DevelopmentHostJournal,
  owner: DevelopmentHostState,
  id: string,
  inspect: (knownId: string | null) => Promise<string | undefined>,
  remove: (containerId: string) => Promise<void>,
): Promise<void> {
  const state = journal.probeContainer(id);
  if (state.create_state === 'removal_confirmed' || state.create_state === 'not_dispatched') return;
  const observed = await inspect(state.container_id);
  if (!observed) {
    if (state.create_state === 'create_pending') throw new Error('cleanup_pending');
    journal.confirmProbeRemoval(owner, id, state.container_id!);
    return;
  }
  if (state.create_state === 'create_pending') journal.bindProbeContainer(owner, id, observed);
  else if (state.container_id !== observed) throw new Error('service_identity_mismatch');
  await remove(observed);
  if (await inspect(observed)) throw new Error('cleanup_pending');
  journal.confirmProbeRemoval(owner, id, observed);
}

/** Both effects must be attempted even when the other fails; acknowledgements are owner fenced. */
export async function reconcileDevelopmentProbe(
  journal: DevelopmentHostJournal,
  owner: DevelopmentHostState,
  id: string,
  cancel: () => Promise<void>,
  revoke: () => Promise<void>,
): Promise<void> {
  const results = await Promise.allSettled([
    cancel().then(() => journal.confirmProbe(owner, id, 'cancel')),
    revoke().then(() => journal.confirmProbe(owner, id, 'revoke')),
  ]);
  if (results.some((result) => result.status === 'rejected')) throw new Error('cleanup_pending');
  journal.settleProbe(owner, id);
}

export function assertDevelopmentAdmission(
  state: DevelopmentHostState,
  stopping: boolean,
  qualified: boolean,
  cleanup: string,
  now = Date.now(),
  topologyObservedAt = 0,
): void {
  if (now - topologyObservedAt > 5000) throw new Error('topology_stale');
  if (
    stopping ||
    state.stop_requested ||
    !qualified ||
    cleanup !== 'settled' ||
    state.code !== 'ready' ||
    now >= (state.ready_until_ms ?? 0) ||
    now - state.observed_at_ms > 5000
  )
    throw new Error('control_unavailable');
}

export function developmentEffectiveCode(
  state: DevelopmentHostState | undefined,
  now = Date.now(),
): string | undefined {
  if (state?.code !== 'ready') return state?.code;
  if (state.lease_until_ms <= now) return 'service_owner_lost';
  if (state.stop_requested) return 'service_stopped';
  if (now >= (state.ready_until_ms ?? 0)) return 'topology_stale';
  return 'ready';
}
