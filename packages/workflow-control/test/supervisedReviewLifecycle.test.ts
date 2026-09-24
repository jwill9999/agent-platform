import { execFile, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
import { executeSupervisedReview, prepareSupervisedReview } from '../src/supervisedReview.js';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
const roots: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function prepared() {
  const root = await mkdtemp(join(tmpdir(), 'review-lifecycle-'));
  roots.push(root);
  await writeFile(join(root, 'plan.md'), 'evidence');
  await writeFile(join(root, 'auth.json'), '{}');
  const result = await prepareSupervisedReview({
    sourceRoot: root,
    evidencePaths: ['plan.md'],
    image: `sha256:${'0'.repeat(64)}`,
    modelAuthFile: join(root, 'auth.json'),
    egressNetwork: 'model-only',
    question: 'Review',
  });
  roots.push(dirname(result.snapshot.root));
  return result;
}
function reply(error: Error | null, stdout = '') {
  return ((...args: unknown[]) => {
    const callback = args.at(-1) as (
      error: Error | null,
      result: { stdout: string; stderr: string },
    ) => void;
    queueMicrotask(() => callback(error, { stdout, stderr: '' }));
    return new EventEmitter() as ChildProcess;
  }) as typeof execFile;
}
it('does not start or remove evidence when creation is unacknowledged', async () => {
  const review = await prepared();
  vi.mocked(execFile).mockImplementationOnce(reply(new Error('create timeout')));
  await expect(
    executeSupervisedReview(review, { timeoutMs: 1000, maxOutputBytes: 4096 }),
  ).rejects.toMatchObject({
    recovery: {
      executionId: review.executionId,
      stagingRoot: dirname(review.snapshot.root),
      settlement: 'creation-unacknowledged',
    },
  });
  expect(execFile).toHaveBeenCalledTimes(1);
  expect((await stat(review.snapshot.root)).isDirectory()).toBe(true);
});
it('stops the acknowledged container before removing evidence after start failure', async () => {
  const review = await prepared();
  const id = '1'.repeat(64);
  vi.mocked(execFile)
    .mockImplementationOnce(reply(null, id + '\n'))
    .mockImplementationOnce(reply(new Error('start timeout')))
    .mockImplementationOnce(reply(null));
  await expect(
    executeSupervisedReview(review, { timeoutMs: 1000, maxOutputBytes: 4096 }),
  ).rejects.toThrow('start timeout');
  expect(vi.mocked(execFile).mock.calls[1]?.[1]).toEqual(['start', '--attach', id]);
  expect(vi.mocked(execFile).mock.calls[2]?.[1]).toEqual(['rm', '--force', id]);
  await expect(stat(review.snapshot.root)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('retains staging and rejects success when removal is not confirmed', async () => {
  const review = await prepared();
  vi.mocked(execFile)
    .mockImplementationOnce(reply(null, '1'.repeat(64)))
    .mockImplementationOnce(
      reply(
        null,
        '{"type":"item.completed","item":{"type":"agent_message","text":"Review complete"}}\n{"type":"turn.completed"}\n',
      ),
    )
    .mockImplementationOnce(reply(new Error('daemon unavailable')));
  await expect(
    executeSupervisedReview(review, { timeoutMs: 1000, maxOutputBytes: 4096 }),
  ).rejects.toMatchObject({ recovery: { settlement: 'removal-unconfirmed' } });
  expect((await stat(review.snapshot.root)).isDirectory()).toBe(true);
});
it('removes the container and staging when model output is malformed', async () => {
  const review = await prepared();
  vi.mocked(execFile)
    .mockImplementationOnce(reply(null, '1'.repeat(64)))
    .mockImplementationOnce(reply(null, 'not json'))
    .mockImplementationOnce(reply(null));
  await expect(
    executeSupervisedReview(review, { timeoutMs: 1000, maxOutputBytes: 4096 }),
  ).rejects.toThrow();
  expect(vi.mocked(execFile).mock.calls[2]?.[1]).toEqual(['rm', '--force', '1'.repeat(64)]);
  await expect(stat(review.snapshot.root)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('rejects empty or incomplete review events even when the process exits successfully', async () => {
  const review = await prepared();
  vi.mocked(execFile)
    .mockImplementationOnce(reply(null, '1'.repeat(64)))
    .mockImplementationOnce(reply(null, '{"type":"turn.completed"}\n'))
    .mockImplementationOnce(reply(null));
  await expect(
    executeSupervisedReview(review, { timeoutMs: 1000, maxOutputBytes: 4096 }),
  ).rejects.toThrow('completed turn with review text');
  await expect(stat(review.snapshot.root)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('returns completed review only after successful container and staging cleanup', async () => {
  const review = await prepared();
  vi.mocked(execFile)
    .mockImplementationOnce(reply(null, '1'.repeat(64)))
    .mockImplementationOnce(
      reply(
        null,
        '{"type":"item.completed","item":{"type":"agent_message","text":"Review complete"}}\n{"type":"turn.completed"}\n',
      ),
    )
    .mockImplementationOnce(reply(null));
  const result = await executeSupervisedReview(review, { timeoutMs: 1000, maxOutputBytes: 4096 });
  expect(result.events).toHaveLength(2);
  expect(vi.mocked(execFile).mock.calls[0]?.[1]).not.toContain('--rm');
  await expect(stat(review.snapshot.root)).rejects.toMatchObject({ code: 'ENOENT' });
});
