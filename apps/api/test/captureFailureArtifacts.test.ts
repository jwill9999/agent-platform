import { randomUUID } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
  open,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fork, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { CaptureFailure, CaptureStoreKind } from '@agent-platform/contracts';
import { afterEach, expect, it, vi } from 'vitest';
import {
  createCaptureFailureRecorder,
  type CaptureFailureRecorder,
} from '../src/infrastructure/diagnostics/captureFailureArtifacts.js';

import {
  ownCaptureChild,
  captureChildMessage,
  captureChildClose,
  stopCaptureChild,
  type OwnedCaptureChild,
} from './support/captureFailureChild.js';

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'capture-artifact-'));
  directories.push(path);
  return path;
}
function failure(store: CaptureStoreKind, processInstanceId = randomUUID()): CaptureFailure {
  return {
    schemaVersion: 1,
    processInstanceId,
    store,
    operation: 'startup',
    cause: 'worker_error',
    observedAtMs: 1000,
    elapsedMs: 25,
    deadlineMs: null,
  };
}
async function settled(recorder: CaptureFailureRecorder, kind: CaptureStoreKind) {
  const deadline = Date.now() + 2000;
  while (recorder.status()[kind].publication === 'pending' && Date.now() < deadline) await delay(5);
  expect(recorder.status()[kind].publication).not.toBe('pending');
}
async function retained(root: string, record: CaptureFailure) {
  const path = join(root, '.capture-failures');
  await mkdir(path, { mode: 0o700 });
  await writeFile(join(path, `${record.store}.json`), JSON.stringify(record), { mode: 0o600 });
  return path;
}
it('publishes exactly two private bounded artifacts and caches history separately on normal recorder restart', async () => {
  const root = await directory();
  const id = randomUUID();
  const recorder = createCaptureFailureRecorder({ appDataPath: root, processInstanceId: id });
  await recorder.ready;
  expect(recorder.status().diagnostics).toEqual({
    previousFailureState: 'missing',
    publication: 'idle',
  });
  for (const kind of ['diagnostics', 'monitoring'] as const)
    recorder.observe(kind, failure(kind, id));
  await Promise.all(
    (['diagnostics', 'monitoring'] as const).map((kind) => settled(recorder, kind)),
  );
  const artifactDirectory = join(root, '.capture-failures');
  expect((await readdir(artifactDirectory)).sort()).toEqual([
    'diagnostics.json',
    'monitoring.json',
  ]);
  for (const name of await readdir(artifactDirectory)) {
    const metadata = await stat(join(artifactDirectory, name));
    expect(metadata.size).toBeLessThanOrEqual(2048);
    if (process.platform !== 'win32') expect(metadata.mode & 0o777).toBe(0o600);
  }
  if (process.platform !== 'win32')
    expect((await stat(artifactDirectory)).mode & 0o777).toBe(0o700);
  const restarted = createCaptureFailureRecorder({
    appDataPath: root,
    processInstanceId: randomUUID(),
  });
  await restarted.ready;
  expect(restarted.status().diagnostics).toMatchObject({
    previousFailureState: 'available',
    previousFailure: failure('diagnostics', id),
    publication: 'idle',
  });
  const cached = restarted.status();
  await rm(artifactDirectory, { recursive: true });
  expect(restarted.status()).toEqual(cached);
  cached.diagnostics.previousFailure!.cause = 'unknown';
  expect(restarted.status().diagnostics.previousFailure?.cause).toBe('worker_error');
});
it('accepts only the first failure per store and refuses a changed first failure from the same process', async () => {
  const root = await directory();
  const record = failure('diagnostics');
  const recorder = createCaptureFailureRecorder({
    appDataPath: root,
    processInstanceId: record.processInstanceId,
  });
  await recorder.ready;
  recorder.observe('diagnostics', record);
  recorder.observe('diagnostics', { ...record, cause: 'timeout' });
  await settled(recorder, 'diagnostics');
  const path = join(root, '.capture-failures', 'diagnostics.json');
  const original = await readFile(path, 'utf8');
  expect(JSON.parse(original)).toEqual(record);
  const duplicate = createCaptureFailureRecorder({
    appDataPath: root,
    processInstanceId: record.processInstanceId,
  });
  await duplicate.ready;
  duplicate.observe('diagnostics', { ...record, cause: 'worker_exit' });
  await settled(duplicate, 'diagnostics');
  expect(duplicate.status().diagnostics.publication).toBe('unavailable');
  expect(await readFile(path, 'utf8')).toBe(original);
  const next = failure('diagnostics');
  const restarted = createCaptureFailureRecorder({
    appDataPath: root,
    processInstanceId: next.processInstanceId,
  });
  await restarted.ready;
  restarted.observe('diagnostics', next);
  await settled(restarted, 'diagnostics');
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(next);
});
it.each(['malformed', 'oversized', 'extra-field', 'wrong-store'] as const)(
  'rejects historical %s content without exposing its contents',
  async (kind) => {
    const root = await directory();
    const record = failure('diagnostics');
    const path = await retained(root, record);
    const value =
      kind === 'malformed'
        ? '{private-canary'
        : kind === 'oversized'
          ? 'private-canary'.repeat(300)
          : JSON.stringify({
              ...record,
              ...(kind === 'extra-field' ? { path: 'private-canary' } : { store: 'monitoring' }),
            });
    await writeFile(join(path, 'diagnostics.json'), value, { mode: 0o600 });
    const recorder = createCaptureFailureRecorder({
      appDataPath: root,
      processInstanceId: randomUUID(),
    });
    await recorder.ready;
    expect(recorder.status().diagnostics.previousFailureState).toBe('invalid');
    expect(JSON.stringify(recorder.status())).not.toContain('private-canary');
    expect(recorder.status().monitoring.previousFailureState).toBe('missing');
  },
);
it.each(['claim', 'tmp', 'target-symlink', 'directory-symlink'] as const)(
  'preserves previous data and foreign files for %s publication interference',
  async (kind) => {
    const root = await directory();
    const previous = failure('diagnostics');
    let path = await retained(root, previous);
    const target = join(path, 'diagnostics.json');
    const original = await readFile(target, 'utf8');
    const outside = join(root, 'foreign');
    await writeFile(outside, 'foreign-private-canary', { mode: 0o600 });
    if (kind === 'claim' || kind === 'tmp')
      await writeFile(join(path, `diagnostics.${kind}`), 'foreign-owned', { mode: 0o600 });
    if (kind === 'target-symlink') {
      await rm(target);
      await symlink(outside, target);
    }
    if (kind === 'directory-symlink') {
      await rm(path, { recursive: true });
      const foreignDirectory = join(root, 'foreign-directory');
      await mkdir(foreignDirectory, { mode: 0o700 });
      await symlink(foreignDirectory, path);
      path = foreignDirectory;
    }
    const record = failure('diagnostics');
    const recorder = createCaptureFailureRecorder({
      appDataPath: root,
      processInstanceId: record.processInstanceId,
    });
    await recorder.ready;
    recorder.observe('diagnostics', record);
    await settled(recorder, 'diagnostics');
    expect(recorder.status().diagnostics.publication).toBe('unavailable');
    expect(await readFile(outside, 'utf8')).toBe('foreign-private-canary');
    expect(JSON.stringify(recorder.status())).not.toContain(root);
    if (kind === 'claim' || kind === 'tmp') {
      expect(await readFile(target, 'utf8')).toBe(original);
      expect(await readFile(join(path, `diagnostics.${kind}`), 'utf8')).toBe('foreign-owned');
    }
    if (kind === 'directory-symlink') expect(await readdir(path)).toHaveLength(0);
  },
);
it.each([
  undefined,
  { extra: 'private-canary' },
  { ...failure('diagnostics'), processInstanceId: 'invalid-private' },
])('fails closed for unrepresentable or invalid input %#', async (input) => {
  const root = await directory();
  const recorder = createCaptureFailureRecorder({
    appDataPath: root,
    processInstanceId: randomUUID(),
  });
  await recorder.ready;
  recorder.observe('diagnostics', input as CaptureFailure | undefined);
  await settled(recorder, 'diagnostics');
  expect(recorder.status().diagnostics.publication).toBe('unavailable');
  expect(await readdir(join(root, '.capture-failures'))).toHaveLength(0);
  expect(JSON.stringify(recorder.status())).not.toContain('private');
});
it.each(['write', 'close'] as const)(
  'preserves the previous artifact when the owned temporary file %s fails, and closes the descriptor',
  async (phase) => {
    const root = await directory();
    const previous = failure('diagnostics');
    const path = await retained(root, previous);
    const record = failure('diagnostics');
    const recorder = createCaptureFailureRecorder({
      appDataPath: root,
      processInstanceId: record.processInstanceId,
    });
    await recorder.ready;
    const handle = await open(join(root, 'prototype'), 'w', 0o600);
    const prototype = Object.getPrototypeOf(handle) as typeof handle;
    await handle.close();
    const originalWrite = prototype.writeFile;
    const temporaryHandles: Array<typeof handle> = [];
    let failed = false;
    vi.spyOn(prototype, 'writeFile').mockImplementation(function (
      this: typeof handle,
      data,
      options,
    ) {
      if (typeof data === 'string' && data.startsWith('{')) {
        temporaryHandles.push(this);
        if (phase === 'write') {
          failed = true;
          return Promise.reject(new Error('private-write-failure'));
        }
        const originalClose = this.close;
        this.close = () => {
          if (!failed) {
            failed = true;
            return Promise.reject(new Error('private-close-failure'));
          }
          return originalClose.call(this);
        };
      }
      return originalWrite.call(this, data, options);
    });
    recorder.observe('diagnostics', record);
    await settled(recorder, 'diagnostics');
    vi.restoreAllMocks();
    expect(failed).toBe(true);
    expect(recorder.status().diagnostics.publication).toBe('unavailable');
    expect(JSON.parse(await readFile(join(path, 'diagnostics.json'), 'utf8'))).toEqual(previous);
    expect((await readdir(path)).sort()).toEqual(['diagnostics.json']);
    expect(temporaryHandles).toHaveLength(1);
    await expect(temporaryHandles[0]!.stat()).rejects.toMatchObject({ code: 'EBADF' });
  },
);

it('retains a completed publisher across a real process restart and preserves its file after interrupted replacement', async ({
  signal,
  onTestFinished,
}) => {
  // This process fixture is deliberately outside automatic directory cleanup: uncertain close retains it.
  const root = await mkdtemp(join(tmpdir(), 'capture-publisher-process-'));
  const children: OwnedCaptureChild[] = [];
  onTestFinished(async () => {
    const results = await Promise.allSettled(children.map((child) => stopCaptureChild(child)));
    const errors = results.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : [],
    );
    if (errors.length)
      throw new AggregateError(errors, 'Owned publisher close unconfirmed; fixture retained');
    await rm(root, { recursive: true, force: true });
  });
  const compiled = new URL(
    '../dist/infrastructure/diagnostics/captureFailureArtifacts.js',
    import.meta.url,
  ).href;
  const childFile = fileURLToPath(
    new URL('./support/captureFailurePublisher.mjs', import.meta.url),
  );
  const run = (id: string, blocked: boolean | 'hold') => {
    const child = ownCaptureChild(
      fork(childFile, [compiled, root, id, String(blocked)], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: { PATH: process.env.PATH },
      }),
    );
    children.push(child);
    return child;
  };
  const firstId = randomUUID();
  const first = run(firstId, false);
  expect(await captureChildMessage(first, signal)).toEqual({ stage: 'stored' });
  expect(await captureChildClose(first, signal)).toEqual({ code: 0, signal: null });
  const target = join(root, '.capture-failures', 'diagnostics.json');
  const heldId = randomUUID();
  const held = run(heldId, 'hold');
  expect(await captureChildMessage(held, signal)).toEqual({ stage: 'temporary' });
  const claim = join(root, '.capture-failures', 'diagnostics.claim');
  const token = await readFile(claim, 'utf8');
  const contender = run(randomUUID(), false);
  expect(await captureChildMessage(contender, signal)).toEqual({ stage: 'unavailable' });
  expect(await captureChildClose(contender, signal)).toEqual({ code: 0, signal: null });
  expect(await readFile(claim, 'utf8')).toBe(token);
  expect(JSON.parse(await readFile(target, 'utf8')).processInstanceId).toBe(firstId);
  const stored = captureChildMessage(held, signal);
  held.child.send({ release: true });
  expect(await stored).toEqual({ stage: 'stored' });
  expect(await captureChildClose(held, signal)).toEqual({ code: 0, signal: null });
  const original = await readFile(target, 'utf8');
  expect(JSON.parse(original).processInstanceId).toBe(heldId);
  const second = run(randomUUID(), true);
  expect(await captureChildMessage(second, signal)).toEqual({ stage: 'temporary' });
  expect(await stopCaptureChild(second)).toEqual({ code: null, signal: 'SIGTERM' });
  expect(await readFile(target, 'utf8')).toBe(original);
  const restarted = createCaptureFailureRecorder({
    appDataPath: root,
    processInstanceId: randomUUID(),
  });
  await restarted.ready;
  expect(restarted.status().diagnostics).toMatchObject({
    previousFailureState: 'available',
    previousFailure: { processInstanceId: heldId },
    publication: 'idle',
  });
  const next = failure('diagnostics');
  const blocked = createCaptureFailureRecorder({
    appDataPath: root,
    processInstanceId: next.processInstanceId,
  });
  await blocked.ready;
  blocked.observe('diagnostics', next);
  await settled(blocked, 'diagnostics');
  expect(blocked.status().diagnostics.publication).toBe('unavailable');
  expect(await readFile(target, 'utf8')).toBe(original);
  expect((await readdir(join(root, '.capture-failures'))).sort()).toEqual([
    'diagnostics.claim',
    'diagnostics.json',
    'diagnostics.tmp',
  ]);
}, 10000);

it.skipIf(process.platform === 'win32')(
  'rejects a real foreign FIFO without blocking artifact reads or deleting it',
  async () => {
    const root = await directory();
    const path = join(root, '.capture-failures');
    await mkdir(path, { mode: 0o700 });
    const fifo = join(path, 'diagnostics.json');
    expect(spawnSync('/usr/bin/mkfifo', ['-m', '600', fifo]).status).toBe(0);
    const record = failure('diagnostics');
    const recorder = createCaptureFailureRecorder({
      appDataPath: root,
      processInstanceId: record.processInstanceId,
    });
    await recorder.ready;
    expect(recorder.status().diagnostics.previousFailureState).toBe('unavailable');
    recorder.observe('diagnostics', record);
    await settled(recorder, 'diagnostics');
    expect(recorder.status().diagnostics.publication).toBe('unavailable');
    expect((await stat(fifo)).isFIFO()).toBe(true);
    expect(await readdir(path)).toEqual(['diagnostics.json']);
  },
);
