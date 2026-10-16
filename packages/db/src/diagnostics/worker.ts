import { parentPort, workerData } from 'node:worker_threads';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import Database from 'better-sqlite3';
import {
  DiagnosticEventSchema,
  DiagnosticScopeSchema,
  DiagnosticWindowSchema,
  type DiagnosticWindow,
  type DiagnosticEvent,
  type DiagnosticScope,
} from '@agent-platform/contracts';

const options = workerData as { path: string; retentionDays: number; maxEvents: number };
const port = parentPort!;
let db: Database.Database;
let previousShutdownUnclean = false;
const windowEpoch = randomUUID();
function meta(key: string): number {
  return Number(
    (
      db.prepare('SELECT value FROM diagnostic_meta WHERE key = ?').get(key) as
        | { value: string }
        | undefined
    )?.value ?? 0,
  );
}
function setMeta(key: string, value: number | string): void {
  db.prepare(
    'INSERT INTO diagnostic_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  ).run(key, String(value));
}
function maximum(): number {
  return Number(
    (
      db.prepare("SELECT seq FROM sqlite_sequence WHERE name='diagnostic_events'").get() as
        | { seq: number }
        | undefined
    )?.seq ?? 0,
  );
}
function earliest(): number {
  return Number(
    (
      db.prepare('SELECT min(sequence) AS value FROM diagnostic_events').get() as {
        value: number | null;
      }
    ).value ?? 0,
  );
}
function stats() {
  return {
    pruned: meta('pruned'),
    conflicts: meta('conflicts'),
    dropped: meta('dropped'),
    acknowledgedSequence: maximum(),
    lastAcknowledgedAtMs: meta('last_ack') || null,
    previousShutdownUnclean,
  };
}
function prune(): void {
  const before = Date.now() - options.retentionDays * 86400000;
  const cutoff =
    (
      db
        .prepare('SELECT sequence FROM diagnostic_events ORDER BY sequence DESC LIMIT 1 OFFSET ?')
        .get(options.maxEvents - 1) as { sequence: number } | undefined
    )?.sequence ?? 0;
  const gone = db
    .prepare(
      'SELECT max(sequence) AS maximum, count(*) AS count FROM diagnostic_events WHERE observed_at < ? OR sequence < ?',
    )
    .get(before, cutoff) as { maximum: number | null; count: number };
  if (gone.count) {
    db.prepare('DELETE FROM diagnostic_events WHERE observed_at < ? OR sequence < ?').run(
      before,
      cutoff,
    );
    setMeta('pruned', meta('pruned') + gone.count);
    setMeta('pruned_through', Math.max(meta('pruned_through'), gone.maximum ?? 0));
  }
}
function scopeKey(scope: DiagnosticScope): string {
  return JSON.stringify(DiagnosticScopeSchema.parse(scope));
}
function where(scope: DiagnosticScope): { sql: string; values: string[] } {
  if ('requestId' in scope) return { sql: 'request_id = ?', values: [scope.requestId] };
  return scope.runId
    ? { sql: 'session_id = ? AND run_id = ?', values: [scope.sessionId, scope.runId] }
    : { sql: 'session_id = ?', values: [scope.sessionId] };
}
function sign(payload: string): string {
  const secret = (
    db.prepare("SELECT value FROM diagnostic_meta WHERE key='cursor_secret'").get() as {
      value: string;
    }
  ).value;
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
function cursor(scope: DiagnosticScope, after: number, snapshot: number): string {
  const payload = Buffer.from(
    JSON.stringify({
      scope: scopeKey(scope),
      after,
      snapshot,
      prunedThrough: meta('pruned_through'),
    }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function decode(value: string, scope: DiagnosticScope): { after: number; snapshot: number } {
  if (value.length > 2048) throw new Error('invalid_cursor');
  const [payload, signature, extra] = value.split('.');
  if (
    !payload ||
    !signature ||
    extra ||
    Buffer.byteLength(signature) !== Buffer.byteLength(sign(payload)) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))
  )
    throw new Error('invalid_cursor');
  const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (typeof parsed !== 'object' || parsed === null) throw new Error('invalid_cursor');
  const data = parsed as { scope: string; after: number; snapshot: number; prunedThrough: number };
  if (
    data.scope !== scopeKey(scope) ||
    !Number.isSafeInteger(data.after) ||
    !Number.isSafeInteger(data.snapshot) ||
    data.after < 0 ||
    data.snapshot < data.after ||
    data.snapshot > maximum()
  )
    throw new Error('invalid_cursor');
  if (meta('pruned_through') > data.prunedThrough) throw new Error(`expired_history:${earliest()}`);
  return data;
}
function rows(sql: string, values: (string | number)[]) {
  return (db.prepare(sql).all(...values) as { sequence: number; content: string }[]).map((row) => ({
    sequence: row.sequence,
    event: DiagnosticEventSchema.parse(JSON.parse(row.content)),
  }));
}
function query(input: { scope: DiagnosticScope; cursor?: string; limit?: number }) {
  // Retention applies on idle-store reads too, never just during incoming writes.
  db.transaction(prune)();
  const scope = DiagnosticScopeSchema.parse(input.scope);
  const limit = Math.max(1, Math.min(1000, Math.floor(input.limit ?? 1000)));
  const bound = input.cursor ? decode(input.cursor, scope) : { after: 0, snapshot: maximum() };
  const filter = where(scope);
  const records = rows(
    `SELECT sequence,content FROM diagnostic_events WHERE ${filter.sql} AND sequence > ? AND sequence <= ? ORDER BY sequence LIMIT ?`,
    [...filter.values, bound.after, bound.snapshot, limit + 1],
  );
  const truncated = records.length > limit;
  const events = records.slice(0, limit);
  return {
    scope,
    events,
    snapshotSequence: bound.snapshot,
    earliestSequence: earliest(),
    truncated,
    ...(truncated && events.length
      ? { nextCursor: cursor(scope, events.at(-1)!.sequence, bound.snapshot) }
      : {}),
    stats: stats(),
  };
}
function windowCursor(
  window: DiagnosticWindow,
  after: number,
  snapshot: number,
  done: boolean,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      scope: JSON.stringify(window),
      after,
      snapshot,
      prunedThrough: meta('pruned_through'),
      epoch: windowEpoch,
      done,
    }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function decodeWindow(
  value: string,
  window: DiagnosticWindow,
): { after: number; snapshot: number; done: boolean } {
  if (value.length > 2048) throw new Error('invalid_cursor');
  const [payload, signature, extra] = value.split('.');
  if (
    !payload ||
    !signature ||
    extra ||
    Buffer.byteLength(signature) !== Buffer.byteLength(sign(payload)) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))
  )
    throw new Error('invalid_cursor');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
  if (
    !data ||
    Object.keys(data).sort().join(',') !== 'after,done,epoch,prunedThrough,scope,snapshot' ||
    data.scope !== JSON.stringify(window) ||
    data.epoch !== windowEpoch ||
    typeof data.done !== 'boolean' ||
    !Number.isSafeInteger(data.after) ||
    !Number.isSafeInteger(data.snapshot) ||
    !Number.isSafeInteger(data.prunedThrough) ||
    Number(data.after) < 0 ||
    Number(data.snapshot) < Number(data.after) ||
    Number(data.snapshot) > maximum()
  )
    throw new Error('invalid_cursor');
  if (meta('pruned_through') > Number(data.prunedThrough))
    throw new Error(`expired_history:${earliest()}`);
  return data as { after: number; snapshot: number; done: boolean };
}
function queryWindow(input: { window: DiagnosticWindow; cursor?: string; limit?: number }) {
  db.transaction(prune)();
  const window = DiagnosticWindowSchema.parse(input.window);
  const limit = Math.max(1, Math.min(1000, Math.floor(input.limit ?? 1000)));
  const bound = input.cursor
    ? decodeWindow(input.cursor, window)
    : { after: 0, snapshot: maximum(), done: false };
  const filter = window.sessionId ? ' AND session_id = ?' : '';
  const args: (string | number)[] = [
    window.fromMs,
    window.toMs,
    bound.snapshot,
    ...(window.sessionId ? [window.sessionId] : []),
  ];
  const observed = db
    .prepare(
      `SELECT min(observed_at) AS oldest,max(observed_at) AS newest FROM diagnostic_events WHERE observed_at >= ? AND observed_at < ? AND sequence <= ?${filter}`,
    )
    .get(...args) as { oldest: number | null; newest: number | null };
  const records = bound.done
    ? []
    : rows(
        `SELECT sequence,content FROM diagnostic_events WHERE observed_at >= ? AND observed_at < ? AND sequence <= ?${filter} AND sequence > ? ORDER BY sequence LIMIT ?`,
        [...args, bound.after, limit + 1],
      );
  const truncated = records.length > limit;
  const events = records.slice(0, limit),
    after = events.at(-1)?.sequence ?? bound.after;
  return {
    window,
    events,
    snapshotSequence: bound.snapshot,
    earliestSequence: earliest(),
    truncated,
    ...(truncated
      ? { nextCursor: windowCursor(window, after, bound.snapshot, false) }
      : { completedCursor: windowCursor(window, after, bound.snapshot, true) }),
    coverage: {
      oldestObservedAtMs: observed.oldest,
      newestObservedAtMs: observed.newest,
      gaps: 0,
      historyMayBeMissing:
        meta('pruned') > 0 ||
        meta('dropped') > 0 ||
        previousShutdownUnclean ||
        observed.oldest === null,
    },
    stats: stats(),
  };
}
function append(input: { events: DiagnosticEvent[]; dropped: number }) {
  if (!Array.isArray(input.events) || input.events.length > 32) throw new Error('invalid_batch');
  const insert = db.prepare(
    'INSERT INTO diagnostic_events(event_id,request_id,session_id,run_id,observed_at,content) VALUES (?,?,?,?,?,?)',
  );
  db.transaction(() => {
    for (const inputEvent of input.events) {
      const event = DiagnosticEventSchema.parse(inputEvent);
      const content = JSON.stringify(event);
      if (Buffer.byteLength(content) > 4096) throw new Error('invalid_event');
      const found = db
        .prepare('SELECT content FROM diagnostic_events WHERE event_id = ?')
        .get(event.eventId) as { content: string } | undefined;
      if (found) {
        if (found.content !== content) setMeta('conflicts', meta('conflicts') + 1);
        continue;
      }
      insert.run(
        event.eventId,
        event.requestId,
        event.sessionId ?? null,
        event.runId ?? null,
        event.observedAtMs,
        content,
      );
    }
    setMeta('dropped', Math.max(meta('dropped'), input.dropped));
    setMeta('last_ack', Date.now());
    prune();
  })();
  return stats();
}
try {
  mkdirSync(dirname(options.path), { recursive: true, mode: 0o700 });
  db = new Database(options.path, { timeout: 0 });
  chmodSync(options.path, 0o600);
  if (
    db.pragma('page_size', { simple: true }) !== 4096 ||
    db.pragma('journal_mode', { simple: true }) !== 'delete'
  )
    throw new Error('schema_incompatible');
  const version = db.pragma('user_version', { simple: true });
  if (version !== 0 && version !== 1) throw new Error('schema_incompatible');
  if (Number(db.pragma('max_page_count = 16384', { simple: true })) > 16384)
    throw new Error('storage_limited');
  db.pragma('synchronous = FULL');
  db.exec(`CREATE TABLE IF NOT EXISTS diagnostic_events(sequence INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT NOT NULL UNIQUE,request_id TEXT NOT NULL,session_id TEXT,run_id TEXT,observed_at INTEGER NOT NULL,content TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS diagnostic_time ON diagnostic_events(observed_at,sequence);
    CREATE INDEX IF NOT EXISTS diagnostic_request ON diagnostic_events(request_id,sequence);
    CREATE INDEX IF NOT EXISTS diagnostic_session ON diagnostic_events(session_id,run_id,sequence);
    CREATE TABLE IF NOT EXISTS diagnostic_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  db.pragma('user_version = 1');
  previousShutdownUnclean = meta('open') === 1;
  db.transaction(() => {
    setMeta('open', 1);
    if (!db.prepare("SELECT 1 FROM diagnostic_meta WHERE key='cursor_secret'").get())
      setMeta('cursor_secret', randomBytes(32).toString('hex'));
    prune();
  })();
  port.postMessage({ type: 'ready', stats: stats() });
} catch (error) {
  port.postMessage({
    type: 'disabled',
    reason:
      error instanceof Error && ['schema_incompatible', 'storage_limited'].includes(error.message)
        ? error.message
        : 'storage_unavailable',
  });
  try {
    db!.close();
  } catch {
    /* failed open */
  }
  port.close();
}
type WorkerMessage = { id: number; type: string; input: unknown };

function listRecent(input: { limit?: number }) {
  db.transaction(prune)();
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 20)));
  const events = rows(
    'SELECT sequence,content FROM diagnostic_events WHERE sequence IN (SELECT max(sequence) FROM diagnostic_events GROUP BY request_id) ORDER BY sequence DESC LIMIT ?',
    [limit],
  );
  return { events, stats: stats() };
}

function closeStore(input: { dropped: number }): null {
  db.transaction(() => {
    setMeta('dropped', Math.max(meta('dropped'), input.dropped));
    setMeta('open', 0);
  })();
  db.close();
  return null;
}

function executeCommand(message: WorkerMessage): unknown {
  switch (message.type) {
    case 'append':
      return append(message.input as Parameters<typeof append>[0]);
    case 'queryWindow':
      return queryWindow(message.input as Parameters<typeof queryWindow>[0]);
    case 'query':
      return query(message.input as Parameters<typeof query>[0]);
    case 'list':
      return listRecent(message.input as Parameters<typeof listRecent>[0]);
    case 'prune':
      db.transaction(prune)();
      return stats();
    case 'close':
      return closeStore(message.input as Parameters<typeof closeStore>[0]);
    default:
      throw new Error('invalid_command');
  }
}

function failureReason(error: unknown): string {
  const messageText = error instanceof Error ? error.message : '';
  if (messageText.startsWith('expired_history:')) return messageText;
  if (messageText === 'invalid_cursor') return 'invalid_cursor';
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  if (code === 'SQLITE_BUSY') return 'busy';
  if (code === 'SQLITE_FULL') return 'storage_limited';
  return 'storage_unavailable';
}

port.on('message', (message: WorkerMessage) => {
  try {
    const result = executeCommand(message);
    port.postMessage({ id: message.id, result });
    if (message.type === 'close') port.close();
  } catch (error) {
    port.postMessage({ id: message.id, error: failureReason(error) });
  }
});
