import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import type { DockerSpecialistLaunch } from './specialistLauncher.js';

const dockerBinary = '/usr/local/bin/docker';
const ownerLabel = 'io.agent-platform.specialist-lifecycle';
const containerIdPattern = /^[a-f0-9]{64}$/u;
const valueOptions = new Set([
  '--cap-drop',
  '--security-opt',
  '--network',
  '--pids-limit',
  '--memory',
  '--cpus',
  '--user',
  '--tmpfs',
  '--env',
  '--volume',
  '--workdir',
]);
const inspectFormat = `{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "${ownerLabel}")}},"status":{{json .State.Status}},"running":{{json .State.Running}},"exitCode":{{json .State.ExitCode}}}`;

export interface SpecialistContainerLifecycleOptions {
  /** Overall create/start deadline, at most 120 seconds. Cleanup has its own budget. */
  timeoutMs: number;
  createTimeoutMs?: number;
  cleanupTimeoutMs?: number;
  /** Combined successful stdout/stderr limit; also caps each subprocess stream. */
  maxOutputBytes?: number;
  signal?: AbortSignal;
}

type ExecutionStatus = 'completed' | 'failed' | 'cancelled' | 'timed_out' | 'output_limit';

export interface SpecialistContainerLifecycleResult {
  status: ExecutionStatus | 'cleanup_unconfirmed';
  executionStatus: ExecutionStatus;
  reason?: 'create_unconfirmed' | 'start_failed' | 'inspect_failed' | 'nonzero_exit';
  cleanupConfirmed: boolean;
  recovery: {
    containerName: string;
    ownershipLabel: string;
    containerId?: string;
  };
  exitCode?: number;
  /** Raw bounded process output, only returned after exit zero and confirmed removal. Not evidence. */
  stdout?: string;
}

interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code?: string | number;
  failure: Exclude<ExecutionStatus, 'completed'>;
}

function boundedInteger(value: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new Error('specialist container lifecycle limit is invalid');
  return value;
}

function optionValue(args: string[], index: number): string {
  const value = args[index];
  if (!value || value.startsWith('-') || value.includes('\0'))
    throw new Error('specialist container launch option is invalid');
  return value;
}

function recordLifecycleOption(seen: Set<string>, option: string): void {
  if (seen.has(option)) throw new Error('specialist container launch option is duplicated');
  seen.add(option);
}

function parseLaunchArguments(args: string[]): { options: string[]; command: string[] } {
  if (args[0] !== 'run') throw new Error('specialist container launch must use run');
  const options: string[] = [];
  const seen = new Set<string>();
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith('-')) {
      optionValue(args, index);
      return { options, command: args.slice(index) };
    }
    if (argument === '--rm') {
      recordLifecycleOption(seen, argument);
      continue;
    }
    if (argument === '--read-only') {
      options.push(argument);
      continue;
    }
    if (valueOptions.has(argument) || argument === '--name') {
      const value = optionValue(args, ++index);
      if (argument === '--name') recordLifecycleOption(seen, argument);
      else options.push(argument, value);
      continue;
    }
    throw new Error('specialist container launch option is unsupported');
  }
  throw new Error('specialist container launch image is missing');
}

function createArguments(launch: DockerSpecialistLaunch, name: string, owner: string): string[] {
  if (launch.dockerBinary !== dockerBinary || Object.keys(launch.environment).length !== 0)
    throw new Error('specialist container lifecycle requires the fixed Docker transport');
  const parsed = parseLaunchArguments(launch.args);
  return [
    'create',
    '--name',
    name,
    '--label',
    `${ownerLabel}=${owner}`,
    ...parsed.options,
    ...parsed.command,
  ];
}

// Fixed production implementation. Tests mock node:child_process, never inject an executor.
function command(
  args: string[],
  timeout: number,
  maxBuffer: number,
  signal?: AbortSignal,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    try {
      execFile(
        dockerBinary,
        args,
        { env: {}, encoding: 'utf8', timeout, maxBuffer, killSignal: 'SIGKILL', signal },
        (error, stdout, stderr) => {
          const overflow =
            error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ||
            Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > maxBuffer;
          let failure: CommandResult['failure'] = 'failed';
          if (signal?.aborted) failure = 'cancelled';
          else if (overflow) failure = 'output_limit';
          else if (error?.killed) failure = 'timed_out';
          resolve({
            ok: error === null && !overflow,
            stdout,
            stderr,
            code: error?.code ?? undefined,
            failure,
          });
        },
      );
    } catch {
      resolve({
        ok: false,
        stdout: '',
        stderr: '',
        failure: signal?.aborted ? 'cancelled' : 'failed',
      });
    }
  });
}

function isAbsent(result: CommandResult, identity: string): boolean {
  return (
    !result.ok &&
    result.code === 1 &&
    [
      `Error response from daemon: No such container: ${identity}`,
      `Error: No such object: ${identity}`,
    ].includes(result.stderr.trim())
  );
}

interface OwnedState {
  id: string;
  status: string;
  running: boolean;
  exitCode: number;
}

function ownedState(
  result: CommandResult,
  name: string,
  owner: string,
  id?: string,
): OwnedState | undefined {
  if (!result.ok) return undefined;
  try {
    const value = JSON.parse(result.stdout) as Record<string, unknown>;
    if (
      typeof value.id !== 'string' ||
      !containerIdPattern.test(value.id) ||
      (id !== undefined && value.id !== id) ||
      value.name !== `/${name}` ||
      value.owner !== owner ||
      typeof value.status !== 'string' ||
      typeof value.running !== 'boolean' ||
      !Number.isSafeInteger(value.exitCode) ||
      (value.exitCode as number) < 0
    )
      return undefined;
    return value as unknown as OwnedState;
  } catch {
    return undefined;
  }
}

async function removeAndConfirm(id: string, deadline: number): Promise<boolean> {
  if (Date.now() >= deadline) return false;
  await command(['container', 'rm', '--force', id], Math.max(1, deadline - Date.now()), 4096);
  if (Date.now() >= deadline) return false;
  const inspection = await command(
    ['container', 'inspect', '--format', inspectFormat, id],
    Math.max(1, deadline - Date.now()),
    4096,
  );
  return isAbsent(inspection, id);
}

async function recoverAmbiguousCreate(
  name: string,
  owner: string,
  cleanupMs: number,
): Promise<string | undefined> {
  const deadline = Date.now() + cleanupMs;
  const inspection = await command(
    ['container', 'inspect', '--format', inspectFormat, name],
    cleanupMs,
    4096,
  );
  const state = ownedState(inspection, name, owner);
  if (state !== undefined) await removeAndConfirm(state.id, deadline);
  // Even absent now, a timed-out create may still be processed later by the daemon.
  return state?.id;
}

type ExecutionObservation = Pick<
  SpecialistContainerLifecycleResult,
  'executionStatus' | 'reason' | 'exitCode' | 'stdout'
>;

function interruption(
  deadline: number,
  signal?: AbortSignal,
): 'cancelled' | 'timed_out' | undefined {
  if (signal?.aborted) return 'cancelled';
  if (Date.now() >= deadline) return 'timed_out';
  return undefined;
}

async function runAcknowledgedContainer(
  id: string,
  name: string,
  owner: string,
  deadline: number,
  outputLimit: number,
  signal?: AbortSignal,
): Promise<ExecutionObservation> {
  const beforeStart = interruption(deadline, signal);
  if (beforeStart !== undefined) return { executionStatus: beforeStart };
  // No await between this abort/deadline guard and start dispatch: cancellation cannot queue a late start.
  const started = await command(
    ['start', '--attach', id],
    Math.max(1, deadline - Date.now()),
    outputLimit,
    signal,
  );
  if (!started.ok) return { executionStatus: started.failure, reason: 'start_failed' };
  const afterStart = interruption(deadline, signal);
  if (afterStart !== undefined) return { executionStatus: afterStart };
  const inspection = await command(
    ['container', 'inspect', '--format', inspectFormat, id],
    Math.max(1, deadline - Date.now()),
    4096,
    signal,
  );
  const afterInspect = interruption(deadline, signal);
  if (afterInspect !== undefined) return { executionStatus: afterInspect };
  const state = ownedState(inspection, name, owner, id);
  if (state === undefined || state.running || state.status !== 'exited')
    return { executionStatus: 'failed', reason: 'inspect_failed' };
  if (state.exitCode !== 0)
    return { executionStatus: 'failed', reason: 'nonzero_exit', exitCode: state.exitCode };
  return { executionStatus: 'completed', exitCode: state.exitCode, stdout: started.stdout };
}

/**
 * Owns one Docker create/start/remove lifecycle only. No caller file deletion, credentials,
 * evidence acceptance, or isolation conformance. Retain caller material on cleanup_unconfirmed.
 * Host death and a daemon processing an ambiguous create later require external recovery using
 * the returned name and ownership label. Never launch another container from an uncertain create.
 */
export async function executeSpecialistContainerLifecycle(
  launch: DockerSpecialistLaunch,
  options: SpecialistContainerLifecycleOptions,
): Promise<SpecialistContainerLifecycleResult> {
  const timeoutMs = boundedInteger(options.timeoutMs, 120_000);
  const createMs = boundedInteger(options.createTimeoutMs ?? 15_000, 60_000);
  const cleanupMs = boundedInteger(options.cleanupTimeoutMs ?? 10_000, 60_000);
  const outputLimit = boundedInteger(options.maxOutputBytes ?? 1024 * 1024, 4 * 1024 * 1024);
  const owner = randomUUID();
  const name = `workflow-lifecycle-${owner}`;
  const args = createArguments(launch, name, owner);
  const recovery: SpecialistContainerLifecycleResult['recovery'] = {
    containerName: name,
    ownershipLabel: `${ownerLabel}=${owner}`,
  };
  const deadline = Date.now() + timeoutMs;
  if (options.signal?.aborted)
    return { status: 'cancelled', executionStatus: 'cancelled', cleanupConfirmed: true, recovery };
  const created = await command(args, Math.min(createMs, timeoutMs), 4096, options.signal);
  const id = created.stdout.trim();
  if (!created.ok || !containerIdPattern.test(id)) {
    recovery.containerId = await recoverAmbiguousCreate(name, owner, cleanupMs);
    return {
      status: 'cleanup_unconfirmed',
      executionStatus: created.ok ? 'failed' : created.failure,
      reason: 'create_unconfirmed',
      cleanupConfirmed: false,
      recovery,
    };
  }
  recovery.containerId = id;
  const observation = await runAcknowledgedContainer(
    id,
    name,
    owner,
    deadline,
    outputLimit,
    options.signal,
  );
  let executionStatus = observation.executionStatus;
  const cleanupConfirmed = await removeAndConfirm(id, Date.now() + cleanupMs);
  if (options.signal?.aborted && executionStatus === 'completed') executionStatus = 'cancelled';
  return {
    status: cleanupConfirmed ? executionStatus : 'cleanup_unconfirmed',
    executionStatus,
    reason: observation.reason,
    cleanupConfirmed,
    recovery,
    exitCode: observation.exitCode,
    stdout: cleanupConfirmed && executionStatus === 'completed' ? observation.stdout : undefined,
  };
}
