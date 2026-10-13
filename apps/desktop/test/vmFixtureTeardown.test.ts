import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import {
  attemptFixtureCleanup,
  releaseOwnedVmFixture,
  type VmTeardownOperations,
} from '../e2e/support/vmFixtureTeardown.js';

const input = {
  runtimeDir: '/fixture/vm',
  helperPath: '/fixture/macos-vm-runner',
  projectDir: '/fixture/project',
  started: true,
  daemonPid: 123,
};
function fixture(overrides: Partial<VmTeardownOperations> = {}) {
  let clock = 0;
  let live = true;
  const calls: string[] = [];
  const io: VmTeardownOperations = {
    run: (file, args, timeout) => {
      calls.push(file);
      if (file === '/bin/ps')
        return '/fixture/macos-vm-runner daemon --runtime-dir /fixture/vm --workspace /fixture/project';
      expect(args).toEqual(['stop', '--runtime-dir', '/fixture/vm']);
      expect(timeout).toBe(25_000);
      live = false;
      return '{"ok":true,"state":"disabled"}';
    },
    read: () => '123\n',
    exists: () => true,
    alive: () => live,
    imageHeld: () => false,
    now: () => clock,
    delay: async () => {
      clock += 100;
    },
    ...overrides,
  };
  return { io, calls };
}

it('survives native20s escalation and requires both daemon exit and released image', async () => {
  const { io, calls } = fixture();
  expect(await releaseOwnedVmFixture(input, io)).toEqual({
    ok: true,
    reason: 'released',
    daemonExited: true,
    imageReleased: true,
  });
  expect(calls).toEqual(['/bin/ps', '/fixture/macos-vm-runner']);
});

it('rejects helper success when daemon remains alive', async () => {
  const { io } = fixture({ alive: () => true });
  expect(await releaseOwnedVmFixture(input, io)).toMatchObject({
    ok: false,
    reason: 'release_unverified',
    daemonExited: false,
  });
});

it('waits for a virtualization image holder that outlives its daemon', async () => {
  let observations = 0;
  const { io } = fixture({ imageHeld: () => ++observations < 3 });
  expect((await releaseOwnedVmFixture(input, io)).ok).toBe(true);
  expect(observations).toBe(3);
});

it('retains a runtime whose exact image is still held or whose lsof result is inconclusive', async () => {
  for (const imageHeld of [
    () => true,
    () => {
      throw new Error('lsof unavailable');
    },
  ]) {
    const { io } = fixture({ imageHeld });
    expect(await releaseOwnedVmFixture(input, io)).toMatchObject({
      ok: false,
      reason: 'release_unverified',
      imageReleased: false,
    });
  }
});

it('never invokes stop without valid owned identity', async () => {
  for (const modified of [
    { ...input, daemonPid: undefined },
    { ...input, daemonPid: NaN },
    { ...input, daemonPid: -1 },
  ]) {
    const { io, calls } = fixture();
    expect((await releaseOwnedVmFixture(modified, io)).reason).toBe('missing_owned_pid');
    expect(calls).toEqual([]);
  }
  const { io, calls } = fixture({ read: () => '999' });
  expect((await releaseOwnedVmFixture(input, io)).reason).toBe('identity_changed');
  expect(calls).toEqual([]);
});

it('refuses a reused PID belonging to another command', async () => {
  const { io } = fixture({ run: () => '/other/program' });
  expect((await releaseOwnedVmFixture(input, io)).reason).toBe('identity_changed');
});

it('fails closed for malformed, failed and missing stop evidence', async () => {
  for (const response of [
    'invalid',
    '{}',
    '{"ok":false,"state":"disabled"}',
    '{"ok":true,"state":"ready"}',
  ]) {
    const { io } = fixture();
    const run = io.run;
    io.run = (file, args, timeout) => (file === '/bin/ps' ? run(file, args, timeout) : response);
    expect((await releaseOwnedVmFixture(input, io)).ok).toBe(false);
  }
  const { io } = fixture();
  const run = io.run;
  io.run = (file, args, timeout) => {
    if (file === '/bin/ps') return run(file, args, timeout);
    throw new Error('stop timeout');
  };
  expect((await releaseOwnedVmFixture(input, io)).reason).toBe('stop_failed');
});

it('only accepts missing image and PID when the fixture never attempted to start a VM', async () => {
  const { io } = fixture({ exists: () => false });
  expect(
    (await releaseOwnedVmFixture({ ...input, started: false, daemonPid: undefined }, io)).ok,
  ).toBe(true);
  expect((await releaseOwnedVmFixture(input, io)).ok).toBe(false);
});

it('checks actual stubborn child exit rather than trusting a stop acknowledgement', async () => {
  const child = spawn(
    process.execPath,
    ['-e', "process.on('SIGTERM',()=>{}); console.log('ready'); setInterval(()=>{},1000)"],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );
  await once(child.stdout!, 'data');
  const { io } = fixture({
    read: () => String(child.pid),
    alive: () => child.exitCode === null && child.signalCode === null,
    run: (file) =>
      file === '/bin/ps'
        ? '/fixture/macos-vm-runner daemon --runtime-dir /fixture/vm --workspace /fixture/project'
        : '{"ok":true,"state":"disabled"}',
  });
  try {
    child.kill('SIGTERM');
    expect((await releaseOwnedVmFixture({ ...input, daemonPid: child.pid }, io)).ok).toBe(false);
    const exited = once(child, 'exit');
    child.kill('SIGKILL');
    await exited;
    expect((await releaseOwnedVmFixture({ ...input, daemonPid: child.pid }, io)).ok).toBe(true);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});

it.each(['electron', 'provider'])(
  'continues VM and timer cleanup after %s rejects',
  async (failure) => {
    const reached: string[] = [];
    const failed = await attemptFixtureCleanup(
      ['electron', 'provider', 'vm', 'heartbeat'].map((name) => ({
        name,
        run: async () => {
          reached.push(name);
          if (name === failure) throw new Error('private failure content');
        },
      })),
    );
    expect(reached).toEqual(['electron', 'provider', 'vm', 'heartbeat']);
    expect(failed).toEqual([failure]);
    expect(JSON.stringify(failed)).not.toContain('private failure content');
  },
);
