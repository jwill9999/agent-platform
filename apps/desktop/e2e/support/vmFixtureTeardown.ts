import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export type VmTeardownResult = {
  ok: boolean;
  reason:
    | 'released'
    | 'missing_owned_pid'
    | 'identity_changed'
    | 'stop_failed'
    | 'stop_invalid'
    | 'release_unverified';
  daemonExited: boolean;
  imageReleased: boolean;
};
export type VmTeardownOperations = {
  run: (file: string, args: string[], timeout: number) => string;
  read: (path: string) => string;
  exists: (path: string) => boolean;
  alive: (pid: number) => boolean;
  imageHeld: (path: string) => boolean;
  now: () => number;
  delay: () => Promise<void>;
};

const operations: VmTeardownOperations = {
  run: (file, args, timeout) => execFileSync(file, args, { encoding: 'utf8', timeout }),
  read: (path) => readFileSync(path, 'utf8'),
  exists: existsSync,
  alive: (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
      throw error;
    }
  },
  imageHeld: (path) => {
    try {
      const output = execFileSync('/usr/sbin/lsof', ['-nP', '-t', path], {
        encoding: 'utf8',
        timeout: 1000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (!/^\d+(?:\n\d+)*\n?$/.test(output)) throw new Error('Unrecognized image holder response');
      return true;
    } catch (error) {
      const result = error as { status?: number; stdout?: string; stderr?: string };
      if (result.status === 1 && result.stdout === '' && result.stderr === '') return false;
      throw error;
    }
  },
  now: () => performance.now(),
  delay: () => delay(100),
};

type VmFixtureIdentity = {
  runtimeDir: string;
  helperPath: string;
  projectDir: string;
  started: boolean;
  daemonPid?: number;
};

function stopOwnedDaemon(
  input: VmFixtureIdentity,
  io: VmTeardownOperations,
): VmTeardownResult['reason'] | undefined {
  const pid = input.daemonPid;
  const pidPath = join(input.runtimeDir, 'state', 'daemon.pid');
  if (input.started && (!Number.isSafeInteger(pid) || !pid || pid <= 0)) return 'missing_owned_pid';
  if (!input.started && io.exists(pidPath)) return 'missing_owned_pid';
  if (!pid || !io.alive(pid)) return undefined;
  const expected = `${input.helperPath} daemon --runtime-dir ${input.runtimeDir} --workspace ${input.projectDir}`;
  if (
    io.read(pidPath).trim() !== String(pid) ||
    io.run('/bin/ps', ['-p', String(pid), '-o', 'command='], 1000).trim() !== expected
  )
    return 'identity_changed';
  return invokeNativeStop(input, io);
}

function invokeNativeStop(
  input: VmFixtureIdentity,
  io: VmTeardownOperations,
): VmTeardownResult['reason'] | undefined {
  let stopped: unknown;
  try {
    // Native stop waits 20s before SIGKILL; its caller must survive that escalation.
    stopped = JSON.parse(
      io.run(input.helperPath, ['stop', '--runtime-dir', input.runtimeDir], 25_000),
    );
  } catch {
    return 'stop_failed';
  }
  if (
    !stopped ||
    typeof stopped !== 'object' ||
    (stopped as { ok?: unknown }).ok !== true ||
    (stopped as { state?: unknown }).state !== 'disabled'
  )
    return 'stop_invalid';
  return undefined;
}

export async function releaseOwnedVmFixture(
  input: VmFixtureIdentity,
  io: VmTeardownOperations = operations,
): Promise<VmTeardownResult> {
  let daemonExited = false;
  let imageReleased = false;
  const result = (reason: VmTeardownResult['reason']): VmTeardownResult => ({
    ok: reason === 'released',
    reason,
    daemonExited,
    imageReleased,
  });
  const imagePath = join(input.runtimeDir, 'images', 'base-linux.img');
  try {
    const stopFailure = stopOwnedDaemon(input, io);
    if (stopFailure) return result(stopFailure);
    const pid = input.daemonPid;
    const deadline = io.now() + 3000;
    do {
      daemonExited = !pid || !io.alive(pid);
      imageReleased = !io.exists(imagePath) ? !input.started : !io.imageHeld(imagePath);
      if (daemonExited && imageReleased) return result('released');
      await io.delay();
    } while (io.now() < deadline);
    return result('release_unverified');
  } catch {
    return result('release_unverified');
  }
}

/** Attempt every owned cleanup action; callers report these fixed labels after cleanup. */
export async function attemptFixtureCleanup(
  steps: ReadonlyArray<{ name: string; run: () => void | Promise<void> }>,
): Promise<string[]> {
  const failed: string[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch {
      failed.push(step.name);
    }
  }
  return failed;
}
