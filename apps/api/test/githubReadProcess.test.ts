import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  acquireGitHubRead,
  type GitHubReadOperation,
} from '../src/infrastructure/projects/githubReadProcess.js';

const groupFixture = fileURLToPath(new URL('./fixtures/github-read-process.mjs', import.meta.url));
const owned: GitHubReadOperation[] = [];
const roots: string[] = [];
function acquire(signal?: AbortSignal): GitHubReadOperation {
  const operation = acquireGitHubRead(signal);
  expect(operation).toBeDefined();
  owned.push(operation!);
  return operation!;
}
function root(): string {
  const path = mkdtempSync(join(tmpdir(), 'github-read-process-'));
  roots.push(path);
  return path;
}
function run(operation: GitHubReadOperation, script: string, args: string[] = []) {
  return operation.run(process.execPath, ['-e', script, ...args], tmpdir());
}
async function ready(path: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (existsSync(path)) return;
    await delay(10);
  }
  throw new Error('Owned fixture did not become ready');
}
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    // An orphan killed in a Linux container can await init's reap; it cannot execute.
    if (process.platform === 'linux') {
      const status = readFileSync(`/proc/${pid}/stat`, 'utf8');
      if (status.slice(status.lastIndexOf(')') + 2).startsWith('Z ')) return false;
    }
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(owned.splice(0).map((operation) => operation.close()));
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('bounded GitHub read subprocesses', () => {
  it('keeps successful empty stdout distinct from failure and preserves literal arguments', async () => {
    const operation = acquire();
    expect(await run(operation, '')).toBe('');
    expect(await run(operation, 'process.exit(2)')).toBeUndefined();
    expect(operation.failureReason).toBe('process_failed');
    const literal = 'quotes\'"; $(touch ignored)\nvalue';
    expect(await run(operation, 'process.stdout.write(process.argv[1])', [literal])).toBe(literal);
    expect(operation.failureReason).toBeUndefined();
  });

  it('reports spawn failure safely and permits a later command', async () => {
    const operation = acquire();
    expect(await operation.run(join(root(), 'missing'), [], tmpdir())).toBeUndefined();
    expect(operation.failureReason).toBe('process_failed');
    expect(await run(operation, 'process.stdout.write("recovered")')).toBe('recovered');
  });

  it('captures buffered output through close, at the exact combined byte bound', async () => {
    const operation = acquire();
    const result = await run(
      operation,
      'process.stderr.write(Buffer.alloc(512 * 1024)); process.stdout.write(Buffer.alloc(512 * 1024, 65));',
    );
    expect(result).toBe('A'.repeat(512 * 1024));
    expect(operation.failureReason).toBeUndefined();
  });

  it('stops combined stdout/stderr overflow and never starts a later command', async () => {
    const operation = acquire();
    const result = await run(
      operation,
      'process.stdout.write(Buffer.alloc(600 * 1024)); process.stderr.write(Buffer.alloc(600 * 1024)); setInterval(() => {}, 1000);',
    );
    expect(result).toBeUndefined();
    expect(operation.failureReason).toBe('output_limit');
    expect(operation.signal.aborted).toBe(true);
    expect(await run(operation, 'process.stdout.write("must not run")')).toBeUndefined();
  });

  it('aborts before spawning and detaches the caller listener on close', async () => {
    const caller = new AbortController();
    caller.abort();
    const operation = acquire(caller.signal);
    expect(await run(operation, 'process.stdout.write("must not run")')).toBeUndefined();
    expect(operation.failureReason).toBe('cancelled');
    const nextCaller = new AbortController();
    const remove = vi.spyOn(nextCaller.signal, 'removeEventListener');
    const next = acquire(nextCaller.signal);
    await next.close();
    await next.close();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(await run(next, 'process.exit(0)')).toBeUndefined();
  });

  it('holds at most four operation slots, releases once and refuses command overlap', async () => {
    const controllers = Array.from({ length: 4 }, () => new AbortController());
    const slots = controllers.map((controller) => acquire(controller.signal));
    expect(acquireGitHubRead()).toBeUndefined();
    const marker = join(root(), 'ready');
    const held = run(
      slots[0]!,
      'require("node:fs").writeFileSync(process.argv[1], "ready"); setInterval(() => {}, 1000)',
      [marker],
    );
    await ready(marker);
    expect(await run(slots[0]!, 'process.stdout.write("overlap")')).toBeUndefined();
    controllers[0]!.abort();
    expect(await held).toBeUndefined();
    await slots[0]!.close();
    await slots[0]!.close();
    const replacement = acquire();
    expect(acquireGitHubRead()).toBeUndefined();
    expect(await run(replacement, 'process.stdout.write("healthy")')).toBe('healthy');
    expect(slots[1]!.signal.aborted).toBe(false);
  });

  it('uses one shared deadline across commands and releases idle capacity on expiry', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const operation = acquire();
    await vi.advanceTimersByTimeAsync(9_000);
    expect(operation.signal.aborted).toBe(false);
    expect(await run(operation, 'process.stdout.write("first")')).toBe('first');
    // No command restarts the deadline: an idle operation expires at exactly 10 seconds.
    await vi.advanceTimersByTimeAsync(999);
    expect(operation.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(operation.failureReason).toBe('timeout');
    expect(await run(operation, 'process.exit(0)')).toBeUndefined();
    const slots = Array.from({ length: 4 }, () => acquire());
    expect(acquireGitHubRead()).toBeUndefined();
    await Promise.all(slots.map((slot) => slot.close()));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('terminates a real stalled child at the total deadline', async () => {
    const operation = acquire();
    const marker = join(root(), 'pid');
    const started = performance.now();
    const result = await run(
      operation,
      'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)',
      [marker],
    );
    const elapsed = performance.now() - started;
    expect(result).toBeUndefined();
    expect(operation.failureReason).toBe('timeout');
    expect(elapsed).toBeGreaterThanOrEqual(9_900);
    expect(elapsed).toBeLessThan(11_000); // 10s + 750ms cleanup + 250ms scheduling tolerance.
    expect(alive(Number(readFileSync(marker, 'utf8')))).toBe(false);
  }, 12_000);

  it('rejects marker path arguments and unknown modes before creating fixture files', async () => {
    const operation = acquire();
    const directory = root();
    const outside = join(root(), 'must-not-exist');
    expect(
      await operation.run(process.execPath, [groupFixture, 'parent', outside], directory),
    ).toBeUndefined();
    expect(operation.failureReason).toBe('process_failed');
    expect(existsSync(outside)).toBe(false);
    expect(existsSync(join(directory, 'parent'))).toBe(false);
    expect(
      await operation.run(process.execPath, [groupFixture, '../outside'], directory),
    ).toBeUndefined();
    expect(existsSync(join(directory, 'parent'))).toBe(false);
    expect(existsSync(join(directory, 'descendant'))).toBe(false);
  });

  it.skipIf(process.platform === 'win32')(
    'kills a TERM-resistant owned descendant with inherited pipes without killing a peer',
    async () => {
      const caller = new AbortController();
      const operation = acquire(caller.signal);
      const peer = acquire();
      const directory = mkdtempSync(join(root(), 'literal-\'"; $()\n-'));
      const descendantPid = join(directory, 'descendant');
      const parentPid = join(directory, 'parent');
      const peerPid = join(directory, 'peer');
      const peerRun = run(
        peer,
        'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)',
        [peerPid],
      );
      const childRun = operation.run(process.execPath, [groupFixture, 'parent'], directory);
      await Promise.all([ready(descendantPid), ready(peerPid)]);
      const start = performance.now();
      caller.abort();
      expect(await childRun).toBeUndefined();
      expect(performance.now() - start).toBeLessThan(1_000);
      expect(operation.failureReason).toBe('cancelled');
      expect(alive(Number(readFileSync(parentPid, 'utf8')))).toBe(false);
      expect(alive(Number(readFileSync(descendantPid, 'utf8')))).toBe(false);
      expect(alive(Number(readFileSync(peerPid, 'utf8')))).toBe(true);
      await peer.close();
      await peerRun;
    },
  );

  it.skipIf(process.platform === 'win32')(
    'cleans descendants when a successful leader exits leaving inherited pipes open',
    async () => {
      const operation = acquire();
      const directory = root();
      const marker = join(directory, 'descendant');
      const result = await operation.run(
        process.execPath,
        [groupFixture, 'exiting-parent'],
        directory,
      );
      expect(result).toBe('done');
      expect(alive(Number(readFileSync(marker, 'utf8')))).toBe(false);
    },
  );
});
