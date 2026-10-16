import { parentPort, workerData } from 'node:worker_threads';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import Database from 'better-sqlite3';
import {
  MonitoringSampleSchema,
  MonitoringPreferenceInputSchema,
  MonitoringPreferenceSchema,
  MonitoringWindowSchema,
  type MonitoringSample,
  type MonitoringWindow,
} from '@agent-platform/contracts';

const options = workerData as { path: string };
const epoch = randomUUID();
const port = parentPort!;
let db: Database.Database;
let previousShutdownUnclean = false;
function meta(key: string): number {
  return Number(
    (
      db.prepare('SELECT value FROM monitoring_meta WHERE key = ?').get(key) as
        | { value: string }
        | undefined
    )?.value ?? 0,
  );
}
function setMeta(key: string, value: number | string): void {
  db.prepare(
    'INSERT INTO monitoring_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
  ).run(key, String(value));
}
function maximum(): number {
  return Number(
    (
      db.prepare("SELECT seq FROM sqlite_sequence WHERE name='monitoring_events'").get() as
        | { seq: number }
        | undefined
    )?.seq ?? 0,
  );
}
function earliest(): number {
  return Number(
    (
      db.prepare('SELECT min(sequence) AS value FROM monitoring_events').get() as {
        value: number | null;
      }
    ).value ?? 0,
  );
}
function preference() {
  const values = db
    .prepare(
      "SELECT key,value FROM monitoring_meta WHERE key IN ('sampling_enabled','retention_days','preference_version')",
    )
    .all() as { key: string; value: string }[];
  const current = new Map(values.map(({ key, value }) => [key, value]));
  if (!['0', '1'].includes(current.get('sampling_enabled') ?? ''))
    throw new Error('schema_incompatible');
  return MonitoringPreferenceSchema.parse({
    samplingEnabled: current.get('sampling_enabled') === '1',
    retentionDays: Number(current.get('retention_days')),
    version: Number(current.get('preference_version')),
  });
}
function stats() {
  return {
    pruned: meta('pruned'),
    conflicts: meta('conflicts'),
    dropped: meta('dropped'),
    acknowledgedSequence: maximum(),
    lastAcknowledgedAtMs: meta('last_ack') || null,
    previousShutdownUnclean,
    preference: preference(),
  };
}
function prune(): void {
  const before = Date.now() - preference().retentionDays * 86400000;
  const cutoff =
    (
      db
        .prepare('SELECT sequence FROM monitoring_events ORDER BY sequence DESC LIMIT 1 OFFSET ?')
        .get(25000 - 1) as { sequence: number } | undefined
    )?.sequence ?? 0;
  const gone = db
    .prepare(
      'SELECT max(sequence) AS maximum, count(*) AS count FROM monitoring_events WHERE observed_at < ? OR sequence < ?',
    )
    .get(before, cutoff) as { maximum: number | null; count: number };
  if (gone.count) {
    db.prepare('DELETE FROM monitoring_events WHERE observed_at < ? OR sequence < ?').run(
      before,
      cutoff,
    );
    setMeta('pruned', meta('pruned') + gone.count);
    setMeta('pruned_through', Math.max(meta('pruned_through'), gone.maximum ?? 0));
  }
}
function sign(payload: string): string {
  const secret = (
    db.prepare("SELECT value FROM monitoring_meta WHERE key='cursor_secret'").get() as {
      value: string;
    }
  ).value;
  return createHmac('sha256', secret).update(payload).digest('base64url');
}
function cursor(window: MonitoringWindow, after: number, snapshot: number, done: boolean): string {
  const payload = Buffer.from(
    JSON.stringify({
      scope: JSON.stringify(window),
      after,
      snapshot,
      prunedThrough: meta('pruned_through'),
      epoch,
      done,
    }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function decode(
  value: string,
  window: MonitoringWindow,
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
    data.epoch !== epoch ||
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
function queryWindow(input: { window: MonitoringWindow; cursor?: string; limit?: number }) {
  db.transaction(prune)();
  const window = MonitoringWindowSchema.parse(input.window);
  const limit = Math.max(1, Math.min(1000, Math.floor(input.limit ?? 1000)));
  const bound = input.cursor
    ? decode(input.cursor, window)
    : { after: 0, snapshot: maximum(), done: false };
  const all = db
    .prepare(
      'SELECT sequence,observed_at FROM monitoring_events WHERE observed_at >= ? AND observed_at < ? AND sequence <= ? ORDER BY sequence',
    )
    .all(window.fromMs, window.toMs, bound.snapshot) as { sequence: number; observed_at: number }[];
  let gaps = 0;
  let oldest: number | null = null;
  let newest: number | null = null;
  for (let i = 0; i < all.length; i++) {
    const observedAt = all[i]!.observed_at;
    oldest = oldest === null ? observedAt : Math.min(oldest, observedAt);
    newest = newest === null ? observedAt : Math.max(newest, observedAt);
    const previous = all[i - 1];
    // Sequence order is authoritative for pagination; UTC need not be monotonic.
    // A non-increasing observation is a coverage discontinuity, not a proven cause.
    if (
      previous &&
      (observedAt <= previous.observed_at || observedAt - previous.observed_at > 45000)
    )
      gaps++;
  }
  const rows = bound.done
    ? []
    : (db
        .prepare(
          'SELECT sequence,content FROM monitoring_events WHERE observed_at >= ? AND observed_at < ? AND sequence > ? AND sequence <= ? ORDER BY sequence LIMIT ?',
        )
        .all(window.fromMs, window.toMs, bound.after, bound.snapshot, limit + 1) as {
        sequence: number;
        content: string;
      }[]);
  const truncated = rows.length > limit;
  const samples = rows.slice(0, limit).map((row) => ({
    sequence: row.sequence,
    sample: MonitoringSampleSchema.parse(JSON.parse(row.content)),
  }));
  const after = samples.at(-1)?.sequence ?? bound.after;
  return {
    window,
    samples,
    snapshotSequence: bound.snapshot,
    earliestSequence: earliest(),
    truncated,
    ...(truncated
      ? { nextCursor: cursor(window, after, bound.snapshot, false) }
      : { completedCursor: cursor(window, after, bound.snapshot, true) }),
    coverage: {
      oldestObservedAtMs: oldest,
      newestObservedAtMs: newest,
      gaps,
      historyMayBeMissing:
        oldest === null ||
        oldest > window.fromMs + 45000 ||
        newest! < window.toMs - 45000 ||
        gaps > 0 ||
        meta('pruned') > 0 ||
        meta('dropped') > 0 ||
        previousShutdownUnclean,
    },
    stats: stats(),
  };
}
function append(input: { samples: MonitoringSample[]; dropped: number }) {
  if (!Array.isArray(input.samples) || input.samples.length > 32) throw new Error('invalid_batch');
  const insert = db.prepare(
    'INSERT INTO monitoring_events(sample_id,observed_at,content) VALUES (?,?,?)',
  );
  db.transaction(() => {
    for (const inputSample of input.samples) {
      const sample = MonitoringSampleSchema.parse(inputSample);
      const content = JSON.stringify(sample);
      if (Buffer.byteLength(content) > 4096) throw new Error('invalid_event');
      const found = db
        .prepare('SELECT content FROM monitoring_events WHERE sample_id = ?')
        .get(sample.sampleId) as { content: string } | undefined;
      if (found) {
        if (found.content !== content) setMeta('conflicts', meta('conflicts') + 1);
        continue;
      }
      insert.run(sample.sampleId, sample.observedAtMs, content);
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
  if (Number(db.pragma('max_page_count = 8192', { simple: true })) > 8192)
    throw new Error('storage_limited');
  db.pragma('synchronous = FULL');
  db.pragma('journal_size_limit = 35651584');
  db.exec(`CREATE TABLE IF NOT EXISTS monitoring_events(sequence INTEGER PRIMARY KEY AUTOINCREMENT,sample_id TEXT NOT NULL UNIQUE,observed_at INTEGER NOT NULL,content TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS monitoring_time ON monitoring_events(observed_at,sequence);
    CREATE TABLE IF NOT EXISTS monitoring_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  db.pragma('user_version = 1');
  previousShutdownUnclean = meta('open') === 1;
  db.transaction(() => {
    setMeta('open', 1);
    if (
      !db
        .prepare(
          "SELECT 1 FROM monitoring_meta WHERE key IN ('sampling_enabled','retention_days','preference_version')",
        )
        .get()
    ) {
      setMeta('preference_version', 1);
      setMeta('sampling_enabled', 0);
      setMeta('retention_days', 7);
    }
    if (!db.prepare("SELECT 1 FROM monitoring_meta WHERE key='cursor_secret'").get())
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

function setPreference(input: unknown) {
  const value = MonitoringPreferenceInputSchema.parse(input);
  db.transaction(() => {
    setMeta('sampling_enabled', Number(value.samplingEnabled));
    setMeta('retention_days', value.retentionDays);
    setMeta('preference_version', preference().version + 1);
    prune();
  })();
  return stats();
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
    case 'preference':
      return stats();
    case 'setPreference':
      return setPreference(message.input);
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
