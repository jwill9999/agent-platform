import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { chmodSync, lstatSync } from 'node:fs';

export interface DevelopmentHostState {
  service_id: string;
  config_digest: string;
  pid: number | null;
  epoch: number;
  lease_until_ms: number;
  code: string;
  observed_at_ms: number;
  stop_requested: number;
  recovery_requested: number;
}

/** Private operator journal. Never mounted into a worker or used as workflow/task authority. */
export class DevelopmentHostJournal {
  readonly #db: Database.Database;
  constructor(path: string, readonly = false) {
    try {
      const file = lstatSync(path);
      if (!file.isFile() || file.isSymbolicLink() || (file.mode & 0o077) !== 0)
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
      const columns = this.#db.prepare('PRAGMA table_info(development_probes)').all() as Array<{
        name: string;
      }>;
      for (const column of ['cancel', 'revoke'])
        if (!columns.some((item) => item.name === column))
          this.#db.exec(
            `ALTER TABLE development_probes ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`,
          );
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
          let alive = true;
          try {
            process.kill(old.pid, 0);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false;
          }
          if (alive || old.lease_until_ms > now) throw new Error('service_owner_active');
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
  observe(owner: DevelopmentHostState, code: string, now = Date.now()): void {
    if (!/^[a-z][a-z0-9_]{0,95}$/u.test(code)) throw new Error('invalid_status_code');
    this.#db
      .transaction(() => {
        this.assertOwner(owner, now);
        if (this.state()!.code !== code)
          this.#db
            .prepare('INSERT INTO development_events(code,observed_at_ms) VALUES(?,?)')
            .run(code, now);
        this.#db
          .prepare('UPDATE development_host SET code=?,observed_at_ms=? WHERE singleton=1')
          .run(code, now);
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
  confirmProbe(owner: DevelopmentHostState, id: string, step: 'cancel' | 'revoke'): void {
    this.#db
      .transaction(() => {
        this.assertOwner(owner);
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
