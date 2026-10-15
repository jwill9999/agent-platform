import { spawn } from 'node:child_process';

const MAX_OUTPUT = 2 * 1024 * 1024;
export class GitDeliveryCommandError extends Error {
  constructor(
    readonly reason: 'exit' | 'aborted' | 'output_limit' | 'spawn',
    readonly started: boolean,
  ) {
    super(`Git delivery command ${reason}`);
    this.name = 'GitDeliveryCommandError';
  }
}
export function gitDeliveryEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
    LC_ALL: 'C',
  };
  for (const key of Object.keys(env)) {
    if (
      /^GIT_(?:CONFIG|DIR|COMMON_DIR|WORK_TREE|INDEX|OBJECT|ALTERNATE_OBJECT|CEILING|DISCOVERY|PREFIX|EXTERNAL_DIFF)/.test(
        key,
      )
    )
      delete env[key];
  }
  return env;
}
/** Own a process group so hooks/transport children share the cancellation deadline. Never invokes a shell. */
export async function runGitDeliveryCommand(
  executable: string,
  args: string[],
  cwd: string,
  signal: AbortSignal,
  env: NodeJS.ProcessEnv = gitDeliveryEnvironment(),
): Promise<string> {
  if (signal.aborted) throw new GitDeliveryCommandError('aborted', false);
  return new Promise((resolve, reject) => {
    let started = false;
    let reason: GitDeliveryCommandError['reason'] | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let outputBytes = 0;
    const chunks: Buffer[] = [];
    const child = spawn(executable, args, {
      cwd,
      env,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    function kill(signalName: NodeJS.Signals) {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signalName);
        else child.kill(signalName);
      } catch {
        /* Already reaped. */
      }
    }
    function stop(next: GitDeliveryCommandError['reason']) {
      if (reason) return;
      reason = next;
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 250);
      killTimer.unref();
    }
    const abort = () => stop('aborted');
    signal.addEventListener('abort', abort, { once: true });
    child.on('spawn', () => {
      started = true;
      if (signal.aborted) abort();
    });
    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT) stop('output_limit');
      else chunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT) stop('output_limit');
      // Raw Git/hook output may contain credentials or content: never persist or return it.
    });
    child.on('error', () => {
      reason ??= 'spawn';
    });
    child.on('close', (code) => {
      signal.removeEventListener('abort', abort);
      if (killTimer) clearTimeout(killTimer);
      // Also terminate any descendant which outlived its direct parent.
      kill('SIGKILL');
      if (reason || code !== 0) reject(new GitDeliveryCommandError(reason ?? 'exit', started));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}
