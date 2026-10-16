import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MessagePort } from 'node:worker_threads';
import type Database from 'better-sqlite3';

/** Closed table choices for the two worker-owned observational databases. */
export function captureMetadata(
  database: () => Database.Database,
  kind: 'diagnostics' | 'monitoring',
) {
  const table = kind === 'diagnostics' ? 'diagnostic_meta' : 'monitoring_meta';
  const records = kind === 'diagnostics' ? 'diagnostic_events' : 'monitoring_events';
  function meta(key: string): number {
    return Number(
      (
        database().prepare(`SELECT value FROM ${table} WHERE key = ?`).get(key) as
          | { value: string }
          | undefined
      )?.value ?? 0,
    );
  }
  function setMeta(key: string, value: number | string): void {
    database()
      .prepare(
        `INSERT INTO ${table}(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      )
      .run(key, String(value));
  }
  function maximum(): number {
    return Number(
      (
        database().prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(records) as
          | { seq: number }
          | undefined
      )?.seq ?? 0,
    );
  }
  function earliest(): number {
    return Number(
      (
        database().prepare(`SELECT min(sequence) AS value FROM ${records}`).get() as {
          value: number | null;
        }
      ).value ?? 0,
    );
  }
  function sign(payload: string): string {
    const secret = (
      database().prepare(`SELECT value FROM ${table} WHERE key='cursor_secret'`).get() as {
        value: string;
      }
    ).value;
    return createHmac('sha256', secret).update(payload).digest('base64url');
  }
  return { meta, setMeta, maximum, earliest, sign };
}

type WindowBound = { after: number; snapshot: number; done: boolean };
type CursorAuthority = {
  epoch: string;
  sign: (payload: string) => string;
  maximum: () => number;
  earliest: () => number;
  prunedThrough: () => number;
};
const cursorKeys = ['scope', 'after', 'snapshot', 'prunedThrough', 'epoch', 'done'] as const;
export function windowCursorCodec(authority: CursorAuthority) {
  function encode(scope: string, after: number, snapshot: number, done: boolean): string {
    const payload = Buffer.from(
      JSON.stringify({
        scope,
        after,
        snapshot,
        prunedThrough: authority.prunedThrough(),
        epoch: authority.epoch,
        done,
      }),
    ).toString('base64url');
    return `${payload}.${authority.sign(payload)}`;
  }
  function decode(value: string, scope: string): WindowBound {
    if (value.length > 2048) throw new Error('invalid_cursor');
    const [payload, signature, extra] = value.split('.');
    if (
      !payload ||
      !signature ||
      extra ||
      Buffer.byteLength(signature) !== Buffer.byteLength(authority.sign(payload)) ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(authority.sign(payload)))
    )
      throw new Error('invalid_cursor');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (
      !data ||
      Object.keys(data).length !== cursorKeys.length ||
      !cursorKeys.every((key) => Object.hasOwn(data, key)) ||
      data.scope !== scope ||
      data.epoch !== authority.epoch ||
      typeof data.done !== 'boolean' ||
      !Number.isSafeInteger(data.after) ||
      !Number.isSafeInteger(data.snapshot) ||
      !Number.isSafeInteger(data.prunedThrough) ||
      Number(data.after) < 0 ||
      Number(data.snapshot) < Number(data.after) ||
      Number(data.snapshot) > authority.maximum()
    )
      throw new Error('invalid_cursor');
    if (authority.prunedThrough() > Number(data.prunedThrough))
      throw new Error(`expired_history:${authority.earliest()}`);
    return data as WindowBound;
  }
  return { encode, decode };
}

type WorkerMessage = { id: number; type: string; input: unknown };
function failureReason(error: unknown): string {
  const text = error instanceof Error ? error.message : '';
  if (text.startsWith('expired_history:')) return text;
  if (text === 'invalid_cursor') return 'invalid_cursor';
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  if (code === 'SQLITE_BUSY') return 'busy';
  if (code === 'SQLITE_FULL') return 'storage_limited';
  return 'storage_unavailable';
}
export function attachCaptureWorker(
  port: MessagePort,
  execute: (message: WorkerMessage) => unknown,
): void {
  port.on('message', (message: WorkerMessage) => {
    try {
      const result = execute(message);
      port.postMessage({ id: message.id, result });
      if (message.type === 'close') port.close();
    } catch (error) {
      port.postMessage({ id: message.id, error: failureReason(error) });
    }
  });
}
