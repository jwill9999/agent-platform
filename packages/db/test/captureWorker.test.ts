import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import { windowCursorCodec } from '../src/diagnostics/captureWorker.js';
const secret = 'owned-pure-control-secret';
const scope = JSON.stringify({
  fromMs: 10,
  toMs: 20,
  sessionId: '00000000-0000-4000-8000-000000000001',
});
const sign = (payload: string) => createHmac('sha256', secret).update(payload).digest('base64url');
function token(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
const fields = {
  scope,
  after: 1,
  snapshot: 3,
  prunedThrough: 0,
  epoch: 'owned-epoch',
  done: false,
};
function authority(prunedThrough = 0) {
  return windowCursorCodec({
    epoch: 'owned-epoch',
    sign,
    maximum: () => 3,
    earliest: () => 2,
    prunedThrough: () => prunedThrough,
  });
}
it('preserves the exact signed field serialization and completed-cursor state without relying on key sorting', () => {
  const codec = authority();
  expect(codec.encode(scope, 1, 3, false)).toBe(token(fields));
  expect(codec.decode(token({ ...fields, done: true }), scope)).toEqual({ ...fields, done: true });
  const reordered = {
    done: false,
    epoch: 'owned-epoch',
    prunedThrough: 0,
    snapshot: 3,
    after: 1,
    scope,
  };
  expect(codec.decode(token(reordered), scope)).toEqual(reordered);
});
it('rejects signed wrong field sets and every authority-bound mismatch', () => {
  const withoutDone = { scope, after: 1, snapshot: 3, prunedThrough: 0, epoch: 'owned-epoch' };
  const malformed = [
    withoutDone,
    { ...fields, extra: 1 },
    { ...withoutDone, replacement: false },
    { ...fields, epoch: 'other' },
    { ...fields, scope: 'other' },
    { ...fields, done: 0 },
    { ...fields, after: -1 },
    { ...fields, after: 4 },
    { ...fields, snapshot: 4 },
    { ...fields, prunedThrough: '0' },
  ];
  for (const value of malformed)
    expect(() => authority().decode(token(value), scope)).toThrow('invalid_cursor');
  expect(() => authority().decode(token(fields) + 'x', scope)).toThrow('invalid_cursor');
  expect(() => authority(1).decode(token(fields), scope)).toThrow('expired_history:2');
});
