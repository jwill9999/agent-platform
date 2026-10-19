import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  ownCaptureChild,
  captureChildMessage,
  captureChildClose,
  stopCaptureChild,
} from './support/captureFailureChild.js';

it('cancels a pending owned message wait with the actual test-linked abort and confirms close before deletion', async ({
  signal,
  onTestFinished,
}) => {
  const owned = ownCaptureChild(
    spawn(process.execPath, ['-e', "process.send({stage:'ready'});setInterval(()=>{},1000)"], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    }),
  );
  onTestFinished(async () => {
    await stopCaptureChild(owned);
  });
  expect(await captureChildMessage(owned, signal)).toEqual({ stage: 'ready' });
  const controller = new AbortController();
  const pending = captureChildMessage(owned, AbortSignal.any([signal, controller.signal]));
  const rejected = expect(pending).rejects.toThrow('owned_capture_child_aborted');
  controller.abort();
  await rejected;
  expect(owned.child.listenerCount('message')).toBe(0);
  expect(await stopCaptureChild(owned)).toEqual({ code: null, signal: 'SIGTERM' });
});
it('settles early child exit without leaving message or close waits pending', async ({
  signal,
  onTestFinished,
}) => {
  const owned = ownCaptureChild(
    spawn(process.execPath, ['-e', 'process.exit(7)'], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    }),
  );
  onTestFinished(async () => {
    await stopCaptureChild(owned);
  });
  await expect(captureChildMessage(owned, signal)).rejects.toThrow(
    'owned_capture_child_closed_before_message',
  );
  expect(await captureChildClose(owned, signal)).toEqual({ code: 7, signal: null });
  expect(owned.child.listenerCount('message')).toBe(0);
});
it('bounds cleanup of an owned child that refuses TERM and waits for terminal KILL close', async ({
  signal,
  onTestFinished,
}) => {
  const owned = ownCaptureChild(
    spawn(
      process.execPath,
      ['-e', "process.on('SIGTERM',()=>{});process.send({stage:'ready'});setInterval(()=>{},1000)"],
      { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
    ),
  );
  onTestFinished(async () => {
    await stopCaptureChild(owned, 20);
  });
  expect(await captureChildMessage(owned, signal)).toEqual({ stage: 'ready' });
  expect(await stopCaptureChild(owned, 20)).toEqual({ code: null, signal: 'SIGKILL' });
});
it('passes hostile module URL query data to the literal publisher without executing it as JavaScript', async ({
  signal,
  onTestFinished,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'capture-publisher-data-'));
  const cleanup: { child?: ReturnType<typeof ownCaptureChild> } = {};
  onTestFinished(async () => {
    await stopCaptureChild(cleanup.child);
    await rm(root, { recursive: true, force: true });
  });
  const moduleURL = new URL(
    '../dist/infrastructure/diagnostics/captureFailureArtifacts.js',
    import.meta.url,
  );
  moduleURL.search = "';process.send({stage:'injected'});//";
  const id = randomUUID();
  const owned = ownCaptureChild(
    fork(
      fileURLToPath(new URL('./support/captureFailurePublisher.mjs', import.meta.url)),
      [moduleURL.href, root, id, 'false'],
      { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { PATH: process.env.PATH } },
    ),
  );
  cleanup.child = owned;
  expect(await captureChildMessage(owned, signal)).toEqual({ stage: 'stored' });
  expect(await captureChildClose(owned, signal)).toEqual({ code: 0, signal: null });
  expect(
    JSON.parse(await readFile(join(root, '.capture-failures', 'diagnostics.json'), 'utf8'))
      .processInstanceId,
  ).toBe(id);
});
