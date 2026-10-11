import { spawn } from 'node:child_process';

/** Settlement of trusted POSIX operator commands, including ordinary forked descendants.
 * This is process lifecycle containment, not a sandbox against a hostile setsid() child.
 */
export function executeCoordinatorProcess(input: {
  executable: string;
  args: readonly string[];
  cwd?: string;
  env: NodeJS.ProcessEnv;
  timeout: number;
  maxBuffer: number;
  signal: AbortSignal;
  stdin?: string;
}): Promise<{ stdout: string; stderr: string }> {
  if (process.platform === 'win32')
    return Promise.reject(new Error('coordinator_process_host_unsupported'));
  if (input.signal.aborted) return Promise.reject(new Error('coordinator_service_stopped'));
  return new Promise((resolve, reject) => {
    const child = spawn(input.executable, [...input.args], {
      cwd: input.cwd,
      env: input.env,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [],
      stderr: Buffer[] = [];
    let bytes = 0;
    let failure: Error | undefined;
    const killGroup = () => {
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
            failure ??= new Error('coordinator_process_settlement_failed');
        }
      }
    };
    const stop = () => {
      failure ??= new Error('coordinator_service_unavailable');
      killGroup();
    };
    const timer = setTimeout(stop, input.timeout);
    input.signal.addEventListener('abort', stop, { once: true });
    const collect = (chunks: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > input.maxBuffer) stop();
      else chunks.push(chunk);
    };
    child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk));
    child.on('error', () => {
      failure ??= new Error('coordinator_service_unavailable');
    });
    child.on('exit', killGroup);
    child.on('close', (code) => {
      clearTimeout(timer);
      input.signal.removeEventListener('abort', stop);
      if (failure || code !== 0) reject(failure ?? new Error('coordinator_service_unavailable'));
      else
        resolve({
          stdout: Buffer.concat(stdout).toString(),
          stderr: Buffer.concat(stderr).toString(),
        });
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(input.stdin);
    if (input.signal.aborted) stop();
  });
}
