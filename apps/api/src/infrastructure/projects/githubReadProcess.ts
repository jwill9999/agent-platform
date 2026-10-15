import { spawn, type ChildProcess } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const DEADLINE_MS = 10_000;
const OUTPUT_BYTES = 1024 * 1024;
const MAX_OPERATIONS = 4;
const TERM_GRACE_MS = 250;
const KILL_GRACE_MS = 500;
let operations = 0;

type FailureReason = 'timeout' | 'output_limit' | 'cancelled' | 'process_failed' | 'closed';

export interface GitHubReadOperation {
  readonly signal: AbortSignal;
  readonly failureReason: FailureReason | undefined;
  run(binary: string, args: readonly string[], cwd: string): Promise<string | undefined>;
  close(): Promise<void>;
}

function groupExists(child: ChildProcess): boolean {
  if (!child.pid) return false;
  try {
    process.kill(process.platform === 'win32' ? child.pid : -child.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function terminate(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  try {
    // Each Unix child leads its own process group. Never signal the API's group.
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    // A child/group that has already exited needs no further action.
  }
}

class ReadOperation implements GitHubReadOperation {
  private readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  failureReason: FailureReason | undefined;
  private readonly deadline = performance.now() + DEADLINE_MS;
  private readonly timer: ReturnType<typeof setTimeout>;
  private active: Promise<string | undefined> | undefined;
  private released = false;
  private closing: Promise<void> | undefined;
  private readonly onCallerAbort = () => this.stop('cancelled');

  constructor(private readonly callerSignal?: AbortSignal) {
    this.timer = setTimeout(() => this.stop('timeout'), DEADLINE_MS);
    callerSignal?.addEventListener('abort', this.onCallerAbort, { once: true });
    if (callerSignal?.aborted) this.stop('cancelled');
  }

  private release(): void {
    if (this.released) return;
    this.released = true;
    clearTimeout(this.timer);
    this.callerSignal?.removeEventListener('abort', this.onCallerAbort);
    operations -= 1;
  }

  private stop(reason: FailureReason): void {
    if (!this.signal.aborted) {
      this.failureReason = reason;
      this.controller.abort();
    }
    if (this.active) void this.active.then(() => this.release());
    else this.release();
  }

  async run(binary: string, args: readonly string[], cwd: string): Promise<string | undefined> {
    if (this.released || this.closing || this.signal.aborted) return undefined;
    if (performance.now() >= this.deadline) {
      this.stop('timeout');
      return undefined;
    }
    // Callers sequence commands; an accidental overlap never starts a second child.
    if (this.active) return undefined;
    this.failureReason = undefined;
    const result = this.execute(binary, args, cwd);
    this.active = result;
    try {
      return await result;
    } finally {
      this.active = undefined;
      if (this.signal.aborted) this.release();
    }
  }

  close(): Promise<void> {
    if (!this.closing) {
      if (this.active) this.stop('closed');
      this.closing = (this.active ?? Promise.resolve()).then(() => this.release());
    }
    return this.closing;
  }

  private execute(
    binary: string,
    args: readonly string[],
    cwd: string,
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      let child: ChildProcess;
      try {
        child = spawn(binary, [...args], {
          cwd,
          shell: false,
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch {
        this.failureReason = 'process_failed';
        resolve(undefined);
        return;
      }
      const stdout: Buffer[] = [];
      let bytes = 0;
      let exitCode: number | null = null;
      let settled = false;
      let cleaning = false;
      let pipesClosed = false;
      let termTimer: ReturnType<typeof setTimeout> | undefined;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let pollTimer: ReturnType<typeof setInterval> | undefined;

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(termTimer);
        clearTimeout(killTimer);
        clearInterval(pollTimer);
        this.signal.removeEventListener('abort', onAbort);
        child.stdout?.destroy();
        child.stderr?.destroy();
        if (exitCode === 0 && !this.signal.aborted) resolve(Buffer.concat(stdout).toString('utf8'));
        else {
          this.failureReason ??= 'process_failed';
          resolve(undefined);
        }
      };
      const cleanup = () => {
        if (cleaning || settled) return;
        cleaning = true;
        terminate(child, 'SIGTERM');
        if (pipesClosed && !groupExists(child)) {
          finish();
          return;
        }
        pollTimer = setInterval(() => {
          if (pipesClosed && !groupExists(child)) finish();
        }, 10);
        termTimer = setTimeout(() => {
          terminate(child, 'SIGKILL');
          // Inherited pipes or unreaped descendants must not hold a slot forever.
          killTimer = setTimeout(finish, KILL_GRACE_MS);
        }, TERM_GRACE_MS);
      };
      const onAbort = () => cleanup();
      const consume = (chunk: Buffer, capture: boolean) => {
        if (settled || this.signal.aborted) return;
        bytes += chunk.length;
        if (bytes > OUTPUT_BYTES) this.stop('output_limit');
        else if (capture) stdout.push(chunk);
      };
      child.stdout?.on('data', (chunk: Buffer) => consume(chunk, true));
      child.stderr?.on('data', (chunk: Buffer) => consume(chunk, false));
      child.once('error', () => {
        this.failureReason ??= 'process_failed';
        cleanup();
      });
      child.once('close', () => {
        pipesClosed = true;
        if (cleaning && !groupExists(child)) finish();
      });
      child.once('exit', (code) => {
        exitCode = code;
        // Also reap descendants when their leader exits without closing its pipes.
        cleanup();
      });
      this.signal.addEventListener('abort', onAbort, { once: true });
      if (this.signal.aborted) cleanup();
    });
  }
}

/** A slot covers the complete read chain, not each individual Git/gh command. */
export function acquireGitHubRead(signal?: AbortSignal): GitHubReadOperation | undefined {
  if (operations >= MAX_OPERATIONS) return undefined;
  operations += 1;
  return new ReadOperation(signal);
}
