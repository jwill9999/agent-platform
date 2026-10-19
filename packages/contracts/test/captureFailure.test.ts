import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { CaptureFailureSchema, CaptureFailureArtifactsSchema } from '../src/captureFailure.js';

const failure = {
  schemaVersion: 1,
  processInstanceId: randomUUID(),
  store: 'diagnostics',
  operation: 'append',
  cause: 'timeout',
  observedAtMs: 1,
  elapsedMs: 1000,
  deadlineMs: 1000,
};
it('accepts only bounded fixed metadata, including the largest representable record', () => {
  const largest = CaptureFailureSchema.parse({
    ...failure,
    operation: 'configuration',
    cause: 'invalid_configuration',
    observedAtMs: Number.MAX_SAFE_INTEGER,
    elapsedMs: Number.MAX_SAFE_INTEGER,
    exitCode: -2147483648,
  });
  expect(Buffer.byteLength(JSON.stringify(largest))).toBeLessThanOrEqual(2048);
});
it.each(['message', 'stack', 'path', 'sql', 'payload', 'apiKey', 'capability', 'errorCode'])(
  'rejects private or arbitrary field %s',
  (field) => {
    expect(CaptureFailureSchema.safeParse({ ...failure, [field]: 'private-canary' }).success).toBe(
      false,
    );
  },
);
it.each([
  { processInstanceId: '/private/path' },
  { operation: 'private-canary' },
  { cause: 'SQLITE_PRIVATE' },
  { elapsedMs: Infinity },
  { observedAtMs: -1 },
  { deadlineMs: 201 },
  { exitCode: NaN },
])('rejects invalid metadata %j', (change) => {
  expect(CaptureFailureSchema.safeParse({ ...failure, ...change }).success).toBe(false);
});
it('keeps retained history distinct from this process publication and rejects extra status fields', () => {
  const status = {
    diagnostics: {
      previousFailureState: 'available',
      previousFailure: failure,
      publication: 'idle',
    },
    monitoring: { previousFailureState: 'missing', publication: 'pending' },
  };
  expect(CaptureFailureArtifactsSchema.safeParse(status).success).toBe(true);
  expect(CaptureFailureArtifactsSchema.safeParse({ ...status, path: '/private' }).success).toBe(
    false,
  );
});
