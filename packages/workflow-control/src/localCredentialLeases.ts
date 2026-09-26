import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { z } from 'zod';

const identity = z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/u);
interface Lease {
  id: string;
  generation: string;
  execution_id: string;
  revoked: number;
  expires_ms: number;
  token_hash: string;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Private, single gateway owner. Restart fences all previous leases, never revives them. */
export class LocalCredentialLeases {
  readonly generation = randomUUID();
  readonly #db: Database.Database;
  readonly #key: string;
  readonly #now: () => number;
  readonly #ttlMs: number;

  constructor(path: string, ttlMs = 300_000, now = Date.now) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 3_600_000)
      throw new Error('invalid credential lifetime');
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    try {
      if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
        throw new Error('credential database must be a regular file');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    this.#db = new Database(path);
    chmodSync(path, 0o600);
    this.#db.pragma('journal_mode = DELETE');
    this.#db.pragma('synchronous = FULL');
    this.#db
      .exec(`CREATE TABLE IF NOT EXISTS broker_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS credential_leases (
        id TEXT PRIMARY KEY, generation TEXT NOT NULL, execution_id TEXT NOT NULL,
        revoked INTEGER NOT NULL, expires_ms INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS broker_generations (id TEXT PRIMARY KEY);`);
    this.#key = randomBytes(32).toString('hex');
    this.#db
      .transaction(() => {
        this.#db.prepare('UPDATE credential_leases SET revoked = 1').run();
        this.#db.prepare('INSERT INTO broker_generations VALUES (?)').run(this.generation);
        this.#db
          .prepare("INSERT OR REPLACE INTO broker_meta VALUES ('owner', ?)")
          .run(this.generation);
      })
      .immediate();
    this.#now = now;
    this.#ttlMs = ttlMs;
  }

  #assertOwner(): void {
    const owner = this.#db.prepare("SELECT value FROM broker_meta WHERE key = 'owner'").get() as
      | { value: string }
      | undefined;
    if (owner?.value !== this.generation) throw new Error('credential gateway superseded');
  }

  issue(id: string, generation: string, executionId: string, ttlMs = this.#ttlMs) {
    identity.parse(id);
    identity.parse(generation);
    identity.parse(executionId);
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > this.#ttlMs)
      throw new Error('invalid lease TTL');
    return this.#db
      .transaction(() => {
        this.#assertOwner();
        if (generation !== this.generation) throw new Error('credential generation mismatch');
        const old = this.#db.prepare('SELECT * FROM credential_leases WHERE id = ?').get(id) as
          | Lease
          | undefined;
        if (
          old &&
          (old.revoked ||
            old.expires_ms <= this.#now() ||
            old.execution_id !== executionId ||
            old.generation !== generation)
        )
          throw new Error('credential lease unavailable');
        const token = createHmac('sha256', this.#key)
          .update(JSON.stringify([id, generation, executionId]))
          .digest('hex');
        if (!old)
          this.#db
            .prepare('INSERT INTO credential_leases VALUES (?, ?, ?, 0, ?, ?)')
            .run(id, generation, executionId, this.#now() + ttlMs, hash(token));
        return { token, leaseId: id, generation };
      })
      .immediate();
  }

  revoke(id: string, generation: string): void {
    identity.parse(id);
    identity.parse(generation);
    this.#db
      .transaction(() => {
        this.#assertOwner();
        if (!this.#db.prepare('SELECT id FROM broker_generations WHERE id = ?').get(generation))
          throw new Error('unknown credential generation');
        const old = this.#db.prepare('SELECT * FROM credential_leases WHERE id = ?').get(id) as
          | Lease
          | undefined;
        if (old && old.generation !== generation) throw new Error('credential generation mismatch');
        if (old) this.#db.prepare('UPDATE credential_leases SET revoked = 1 WHERE id = ?').run(id);
        else
          this.#db
            .prepare('INSERT INTO credential_leases VALUES (?, ?, ?, 1, 0, ?)')
            .run(id, generation, '', hash(randomBytes(32).toString('hex')));
      })
      .immediate();
  }

  status(id: string, generation: string): 'active' | 'revoked' {
    this.#assertOwner();
    identity.parse(id);
    identity.parse(generation);
    const row = this.#db.prepare('SELECT * FROM credential_leases WHERE id = ?').get(id) as
      | Lease
      | undefined;
    if (row?.generation !== generation) throw new Error('unknown credential lease');
    return !row.revoked && row.generation === this.generation && row.expires_ms > this.#now()
      ? 'active'
      : 'revoked';
  }

  authorize(token: string): { leaseId: string; generation: string } | undefined {
    this.#assertOwner();
    if (!/^[a-f0-9]{64}$/u.test(token)) return undefined;
    const row = this.#db
      .prepare('SELECT * FROM credential_leases WHERE token_hash = ?')
      .get(hash(token)) as Lease | undefined;
    return row && this.status(row.id, row.generation) === 'active'
      ? { leaseId: row.id, generation: row.generation }
      : undefined;
  }

  conformance() {
    const id = 'probe-' + randomUUID();
    const lease = this.issue(id, this.generation, id, Math.min(30_000, this.#ttlMs));
    if (!this.authorize(lease.token)) throw new Error('probe admission failed');
    this.revoke(id, this.generation);
    let rejected = false;
    try {
      this.issue(id, this.generation, id);
    } catch {
      rejected = true;
    }
    if (!rejected || this.authorize(lease.token)) throw new Error('revocation probe failed');
    const delayedId = 'delayed-probe-' + randomUUID();
    this.revoke(delayedId, this.generation);
    let delayedRejected = false;
    try {
      this.issue(delayedId, this.generation, delayedId);
    } catch {
      delayedRejected = true;
    }
    if (!delayedRejected || this.status(delayedId, this.generation) !== 'revoked')
      throw new Error('delayed issuance probe failed');
    return {
      protocol: 'revoke-wins-v1',
      passed: true,
      cleanup: 'broker_owned_ttl',
      generation: this.generation,
      probeTtlSeconds: Math.min(30_000, this.#ttlMs) / 1000,
    };
  }

  close(): void {
    this.#db.close();
  }
}
