import {
  execFile,
  type ChildProcess,
  type ExecFileOptions,
  type ExecFileException,
} from 'node:child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeSpecialistContainerLifecycle, type DockerSpecialistLaunch } from '../src/index.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFile: vi.fn() };
});

const id = 'a'.repeat(64);
const launch: DockerSpecialistLaunch = {
  dockerBinary: '/usr/local/bin/docker',
  environment: {},
  args: [
    'run',
    '--rm',
    '--name',
    'previous-name',
    '--read-only',
    '--network',
    'none',
    'fixture-image',
    'node',
    '-e',
    'fixture',
  ],
};
interface Call {
  binary: string;
  args: string[];
  options: ExecFileOptions;
}
interface Response {
  stdout?: string;
  stderr?: string;
  error?: Partial<ExecFileException>;
  before?: () => void;
}
let calls: Call[];
let present: boolean;
let respond: (call: Call) => Response;

function state(overrides: Record<string, unknown> = {}): string {
  const create = calls.find((call) => call.args[0] === 'create')!.args;
  return JSON.stringify({
    id,
    name: `/${create[create.indexOf('--name') + 1]}`,
    owner: create[create.indexOf('--label') + 1]!.split('=')[1],
    status: 'exited',
    running: false,
    exitCode: 0,
    ...overrides,
  });
}

function defaultResponse(call: Call): Response {
  if (call.args[0] === 'create') return { stdout: `${id}\n` };
  if (call.args[0] === 'start') return { stdout: 'offline output' };
  if (call.args[1] === 'rm') {
    present = false;
    return { stdout: id };
  }
  return present
    ? { stdout: state() }
    : {
        error: { code: 1 },
        stderr: `Error response from daemon: No such container: ${call.args.at(-1)}`,
      };
}

beforeEach(() => {
  calls = [];
  present = true;
  respond = defaultResponse;
  vi.mocked(execFile).mockImplementation(((
    binary: string,
    args: string[],
    options: ExecFileOptions,
    callback: (error: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    const call = { binary, args, options };
    calls.push(call);
    const response = respond(call);
    queueMicrotask(() => {
      response.before?.();
      callback(
        response.error === undefined
          ? null
          : Object.assign(new Error('synthetic sensitive subprocess details'), response.error),
        response.stdout ?? '',
        response.stderr ?? '',
      );
    });
    return {} as ChildProcess;
  }) as typeof execFile);
});

describe('executeSpecialistContainerLifecycle', () => {
  it('creates with generated ownership, pins the acknowledged ID, observes exit and confirms removal', async () => {
    const result = await executeSpecialistContainerLifecycle(launch, { timeoutMs: 1000 });
    expect(result).toMatchObject({
      status: 'completed',
      executionStatus: 'completed',
      cleanupConfirmed: true,
      exitCode: 0,
      stdout: 'offline output',
      recovery: { containerId: id },
    });
    expect(result.recovery.containerName).toMatch(/^workflow-lifecycle-[a-f0-9-]{36}$/u);
    expect(result.recovery.ownershipLabel).toBe(
      `io.agent-platform.specialist-lifecycle=${result.recovery.containerName.slice('workflow-lifecycle-'.length)}`,
    );
    expect(calls.map((call) => call.args[0])).toEqual([
      'create',
      'start',
      'container',
      'container',
      'container',
    ]);
    expect(calls[0]!.args).not.toContain('--rm');
    expect(calls[0]!.args).not.toContain('previous-name');
    expect(calls[1]!.args).toEqual(['start', '--attach', id]);
    expect(calls[3]!.args).toEqual(['container', 'rm', '--force', id]);
    for (const call of calls) {
      expect(call.binary).toBe('/usr/local/bin/docker');
      expect(call.options.env).toEqual({});
      expect(call.options.timeout).toBeGreaterThan(0);
      expect(call.options.maxBuffer).toBeGreaterThan(0);
      expect(call.options.killSignal).toBe('SIGKILL');
    }
    expect(launch.args[1]).toBe('--rm');
  });

  it('does not strip lifecycle-looking arguments from the image command', async () => {
    const commandLaunch = { ...launch, args: [...launch.args, '--rm', '--name', 'command-value'] };
    await executeSpecialistContainerLifecycle(commandLaunch, { timeoutMs: 1000 });
    expect(calls[0]!.args.slice(-3)).toEqual(['--rm', '--name', 'command-value']);
  });

  it.each([
    '--rm=true',
    '--name=other',
    '--label',
    '--restart',
    '--detach',
    '-d',
    '--cidfile',
    '--unknown',
  ])('rejects conflicting option %s before dispatch', async (option) => {
    await expect(
      executeSpecialistContainerLifecycle(
        { ...launch, args: ['run', option, 'value', 'image'] },
        { timeoutMs: 1000 },
      ),
    ).rejects.toThrow('option');
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['run', '--name'],
    ['run', '--name', '--rm', 'image'],
    ['run', '--rm', '--rm', 'image'],
    ['run', '--name', 'first', '--name', 'second', 'image'],
    ['run', '--network'],
    ['run'],
    ['start', 'image'],
  ])('rejects malformed launch %#', async (...args) => {
    await expect(
      executeSpecialistContainerLifecycle({ ...launch, args }, { timeoutMs: 1000 }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('rejects caller transport/environment and invalid bounds', async () => {
    await expect(
      executeSpecialistContainerLifecycle(
        { ...launch, dockerBinary: '/untrusted/docker' },
        { timeoutMs: 1000 },
      ),
    ).rejects.toThrow('fixed');
    await expect(
      executeSpecialistContainerLifecycle(
        { ...launch, environment: { SECRET: 'fixture' } },
        { timeoutMs: 1000 },
      ),
    ).rejects.toThrow('fixed');
    for (const timeoutMs of [0, -1, NaN, Infinity, 120001])
      await expect(executeSpecialistContainerLifecycle(launch, { timeoutMs })).rejects.toThrow(
        'limit',
      );
    expect(calls).toHaveLength(0);
  });

  it.each(['rejected', 'timed_out', 'invalid_id', 'extra_output'])(
    'never starts after %s create; cleans only verified owned recovery ID',
    async (fault) => {
      respond = (call) =>
        call.args[0] === 'create'
          ? fault === 'invalid_id'
            ? { stdout: 'short-id' }
            : fault === 'extra_output'
              ? { stdout: `${id}\nextra` }
              : {
                  error: fault === 'timed_out' ? { killed: true } : { code: 1 },
                  stderr: 'synthetic sensitive details',
                }
          : defaultResponse(call);
      const result = await executeSpecialistContainerLifecycle(launch, { timeoutMs: 1000 });
      expect(result).toMatchObject({
        status: 'cleanup_unconfirmed',
        cleanupConfirmed: false,
        reason: 'create_unconfirmed',
        recovery: { containerId: id },
      });
      expect(calls.some((call) => call.args[0] === 'start')).toBe(false);
      expect(calls[1]!.args.at(-1)).toBe(result.recovery.containerName);
      expect(calls[2]!.args).toEqual(['container', 'rm', '--force', id]);
      expect(JSON.stringify(result)).not.toContain('sensitive');
      expect(result.stdout).toBeUndefined();
    },
  );

  it.each(['foreign-label', 'foreign-name', 'invalid-id', 'absent', 'inspect-failed'])(
    'never deletes an unowned/uncertain ambiguous create: %s',
    async (fault) => {
      respond = (call) => {
        if (call.args[0] === 'create') return { error: { killed: true } };
        if (fault === 'absent')
          return {
            error: { code: 1 },
            stderr: `Error response from daemon: No such container: ${call.args.at(-1)}`,
          };
        if (fault === 'inspect-failed') return { error: { code: 1 }, stderr: 'daemon unavailable' };
        return {
          stdout: state(
            fault === 'foreign-label'
              ? { owner: 'foreign' }
              : fault === 'foreign-name'
                ? { name: '/foreign' }
                : { id: 'invalid' },
          ),
        };
      };
      const result = await executeSpecialistContainerLifecycle(launch, { timeoutMs: 1000 });
      expect(result.status).toBe('cleanup_unconfirmed');
      expect(calls).toHaveLength(2);
      expect(calls.some((call) => call.args[1] === 'rm' || call.args[0] === 'start')).toBe(false);
    },
  );

  it.each(['failed', 'timed_out', 'output_limit'])('cleans up after %s start', async (fault) => {
    respond = (call) =>
      call.args[0] === 'start'
        ? {
            error:
              fault === 'failed'
                ? { code: 1 }
                : fault === 'timed_out'
                  ? { killed: true }
                  : { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' },
          }
        : defaultResponse(call);
    const result = await executeSpecialistContainerLifecycle(launch, { timeoutMs: 1000 });
    expect(result).toMatchObject({ status: fault, cleanupConfirmed: true, reason: 'start_failed' });
    expect(result.stdout).toBeUndefined();
    expect(present).toBe(false);
  });

  it('bounds combined output even when individual streams are below their cap', async () => {
    respond = (call) =>
      call.args[0] === 'start'
        ? { stdout: 'x'.repeat(60), stderr: 'y'.repeat(60) }
        : defaultResponse(call);
    const result = await executeSpecialistContainerLifecycle(launch, {
      timeoutMs: 1000,
      maxOutputBytes: 100,
    });
    expect(result.status).toBe('output_limit');
    expect(result.cleanupConfirmed).toBe(true);
  });

  it.each([
    { exitCode: 2 },
    { running: true },
    { status: 'created' },
    { owner: 'foreign' },
    { id: 'b'.repeat(64) },
  ])('requires owned daemon-confirmed zero exit: %j', async (override) => {
    respond = (call) =>
      call.args[1] === 'inspect' && present ? { stdout: state(override) } : defaultResponse(call);
    const result = await executeSpecialistContainerLifecycle(launch, { timeoutMs: 1000 });
    expect(result.status).toBe('failed');
    expect(result.cleanupConfirmed).toBe(true);
    expect(result.stdout).toBeUndefined();
  });

  it.each(['remove_failed', 'inspect_failed', 'still_present', 'wrong_absence_identity'])(
    'does not report success on uncertain cleanup: %s',
    async (fault) => {
      let removing = false;
      respond = (call) => {
        if (call.args[1] === 'rm') {
          removing = true;
          return fault === 'remove_failed' ? { error: { code: 1 } } : defaultResponse(call);
        }
        if (call.args[1] === 'inspect' && removing) {
          if (fault === 'inspect_failed')
            return { error: { code: 1 }, stderr: 'daemon unavailable' };
          if (fault === 'wrong_absence_identity')
            return {
              error: { code: 1 },
              stderr: 'Error response from daemon: No such container: foreign',
            };
          return { stdout: state() };
        }
        return defaultResponse(call);
      };
      const result = await executeSpecialistContainerLifecycle(launch, { timeoutMs: 1000 });
      expect(result.status).toBe('cleanup_unconfirmed');
      expect(result.cleanupConfirmed).toBe(false);
      expect(result.stdout).toBeUndefined();
    },
  );

  it('does not create when already aborted', async () => {
    const signal = AbortSignal.abort();
    const result = await executeSpecialistContainerLifecycle(launch, { timeoutMs: 1000, signal });
    expect(result.status).toBe('cancelled');
    expect(calls).toHaveLength(0);
  });

  it('serializes cancellation during acknowledged create so no late start is dispatched', async () => {
    const controller = new AbortController();
    respond = (call) => ({
      ...defaultResponse(call),
      before: call.args[0] === 'create' ? () => controller.abort() : undefined,
    });
    const result = await executeSpecialistContainerLifecycle(launch, {
      timeoutMs: 1000,
      signal: controller.signal,
    });
    expect(result.status).toBe('cancelled');
    expect(result.cleanupConfirmed).toBe(true);
    expect(calls.some((call) => call.args[0] === 'start')).toBe(false);
  });

  it('never starts after the overall deadline expires during creation', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(100);
    respond = (call) => ({
      ...defaultResponse(call),
      before: call.args[0] === 'create' ? () => now.mockReturnValue(1200) : undefined,
    });
    try {
      const result = await executeSpecialistContainerLifecycle(launch, { timeoutMs: 1000 });
      expect(result.status).toBe('timed_out');
      expect(result.cleanupConfirmed).toBe(true);
      expect(calls.some((call) => call.args[0] === 'start')).toBe(false);
    } finally {
      now.mockRestore();
    }
  });

  it('cleans up cancellation during start using an independent cleanup budget without the aborted signal', async () => {
    const controller = new AbortController();
    respond = (call) =>
      call.args[0] === 'start'
        ? { error: { code: 'ABORT_ERR' }, before: () => controller.abort() }
        : defaultResponse(call);
    const result = await executeSpecialistContainerLifecycle(launch, {
      timeoutMs: 1000,
      signal: controller.signal,
    });
    expect(result.status).toBe('cancelled');
    expect(result.cleanupConfirmed).toBe(true);
    expect(calls.find((call) => call.args[1] === 'rm')!.options.signal).toBeUndefined();
  });
});
