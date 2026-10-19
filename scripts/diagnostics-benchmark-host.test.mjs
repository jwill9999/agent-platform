import process from 'node:process';
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once, getEventListeners } from 'node:events';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { setTimeout, clearTimeout } from 'node:timers';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  statSync,
  rmSync,
  existsSync,
  watch,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { BENCHMARK_ARGS, appendHostSample } from './run-diagnostics-benchmark-host.mjs';
import { hostCoverage } from './run-diagnostics-benchmark-observed.mjs';

const wrapper = fileURLToPath(new URL('./run-diagnostics-benchmark-host.mjs', import.meta.url));
const marker = 'owned-private-fixture-marker';
const shim = `#!${process.execPath}
const fs = require('node:fs');
if (process.env.OWNED_MODE === 'early-exit') process.exit(3);
fs.writeFileSync(process.env.OWNED_EFFECT, JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd(),nodeOptions:process.env.NODE_OPTIONS,marker:process.env.OWNED_MARKER,pid:process.pid,ready:process.env.OWNED_MODE!=='wait-no-ready'})+'\\n');
fs.writeFileSync(process.env.DIAGNOSTICS_BENCHMARK_RESULT, 'owned invalid-JSON raw marker');
if (process.env.OWNED_MODE === 'failure') process.exitCode = 7;
if (process.env.OWNED_MODE === 'SIGTERM' || process.env.OWNED_MODE === 'SIGINT') process.kill(process.pid, process.env.OWNED_MODE);
if (process.env.OWNED_MODE === 'wait' || process.env.OWNED_MODE === 'wait-no-ready') setInterval(()=>{},1000);
`;
function fixture(mode, blocked = false) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'benchmark-host-control-')));
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'pnpm'), shim, { mode: 0o700 });
  const receipt = join(directory, 'host.json');
  if (blocked) writeFileSync(receipt, marker, { mode: 0o600 });
  return {
    directory,
    receipt,
    blocked,
    env: {
      ...process.env,
      PATH: bin,
      NODE_OPTIONS: '--no-warnings',
      OWNED_MODE: mode,
      OWNED_MARKER: marker,
      OWNED_EFFECT: join(directory, 'effect.json'),
      DIAGNOSTICS_BENCHMARK_RESULT: join(directory, 'raw.json'),
      DIAGNOSTICS_BENCHMARK_HOST_RESULT: receipt,
    },
  };
}
function execute(f, env = f.env) {
  const child = spawn(process.execPath, [wrapper], { cwd: f.directory, env, stdio: 'ignore' });
  return { child, exited: once(child, 'exit') };
}
function readReceipt(f) {
  const bytes = readFileSync(f.receipt, 'utf8');
  assert.equal(bytes.includes(marker), false);
  assert.equal(bytes.includes(f.directory), false);
  assert.equal(bytes.includes('NODE_OPTIONS'), false);
  assert.equal(bytes.includes('argv'), false);
  const host = JSON.parse(bytes);
  assert.equal(statSync(f.receipt).mode & 0o777, 0o600);
  assert.equal(host.samples[0].phase, 'before');
  assert.equal(host.samples.at(-1).phase, 'after');
  assert.ok(host.samples.length <= 180);
  assert.equal(host.cadenceMs, 1000);
  for (const time of [host.before, host.childStarted, host.childClosed, host.after]) {
    assert.ok(Number.isFinite(time.wallTimeMs));
    assert.ok(Number.isFinite(time.monotonicMs));
  }
  assert.ok(host.before.monotonicMs <= host.childStarted.monotonicMs);
  assert.ok(host.childStarted.monotonicMs <= host.childClosed.monotonicMs);
  assert.ok(host.childClosed.monotonicMs <= host.after.monotonicMs);
  assert.ok(Object.values(host.overhead).every((value) => Number.isFinite(value) && value >= 0));
  return host;
}

test(
  'the real host-only CLI preserves fixed argv, cwd and environment without reading benchmark output',
  { timeout: 5000 },
  async () => {
    const f = fixture('success');
    try {
      const { exited } = execute(f);
      const [code, signal] = await exited;
      const effect = JSON.parse(readFileSync(f.env.OWNED_EFFECT, 'utf8'));
      assert.equal(Object.isFrozen(BENCHMARK_ARGS), true);
      assert.deepEqual(effect.argv, BENCHMARK_ARGS);
      assert.equal(effect.cwd, f.directory);
      assert.equal(effect.nodeOptions, '--no-warnings');
      assert.equal(effect.marker === marker, true);
      assert.equal(
        readFileSync(f.env.DIAGNOSTICS_BENCHMARK_RESULT, 'utf8'),
        'owned invalid-JSON raw marker',
      );
      const host = readReceipt(f);
      assert.deepEqual(host.child, { exitCode: 0, signal: null, spawnFailed: false });
      assert.equal(host.interruptedBy, null);
      assert.equal(signal, null);
      assert.equal(code, host.isolationQualified ? 0 : 1);
      if (process.platform !== 'linux') {
        assert.equal(host.isolationQualified, false);
        assert.equal(host.coreComplete, false);
        assert.equal(host.linuxAvailable, false);
        assert.equal(host.coverage, 'unavailable');
      }
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

for (const blocked of [false, true]) {
  test(
    `child failure remains exit7 with publication blocked=${blocked}`,
    { timeout: 5000 },
    async () => {
      const f = fixture('failure', blocked);
      try {
        const { exited } = execute(f);
        assert.deepEqual(await exited, [7, null]);
        if (blocked) assert.equal(readFileSync(f.receipt, 'utf8') === marker, true);
        else
          assert.deepEqual(readReceipt(f).child, { exitCode: 7, signal: null, spawnFailed: false });
      } finally {
        rmSync(f.directory, { recursive: true, force: true });
      }
    },
  );
}
for (const signal of ['SIGTERM', 'SIGINT']) {
  for (const blocked of [false, true]) {
    test(
      `child ${signal} identity survives publication blocked=${blocked}`,
      { timeout: 5000 },
      async () => {
        const f = fixture(signal, blocked);
        try {
          const { exited } = execute(f);
          assert.deepEqual(await exited, [null, signal]);
          if (blocked) assert.equal(readFileSync(f.receipt, 'utf8') === marker, true);
          else
            assert.deepEqual(readReceipt(f).child, { exitCode: null, signal, spawnFailed: false });
        } finally {
          rmSync(f.directory, { recursive: true, force: true });
        }
      },
    );
  }
}
test(
  'a successful child cannot pass through exclusive receipt publication failure',
  { timeout: 5000 },
  async () => {
    const f = fixture('success', true);
    try {
      const { exited } = execute(f);
      assert.deepEqual(await exited, [1, null]);
      assert.equal(readFileSync(f.receipt, 'utf8') === marker, true);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
test('spawn failure is retained as failure without raw errors', { timeout: 5000 }, async () => {
  const f = fixture('success');
  try {
    const empty = join(f.directory, 'empty');
    mkdirSync(empty);
    const { exited } = execute(f, { ...f.env, PATH: empty });
    assert.deepEqual(await exited, [1, null]);
    const host = readReceipt(f);
    assert.deepEqual(host.child, { exitCode: 1, signal: null, spawnFailed: true });
    assert.equal(host.isolationQualified, false);
    assert.equal(existsSync(f.env.OWNED_EFFECT), false);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});
test(
  'missing receipt destination fails before launching any benchmark child',
  { timeout: 5000 },
  async () => {
    const f = fixture('success');
    try {
      const env = { ...f.env };
      delete env.DIAGNOSTICS_BENCHMARK_HOST_RESULT;
      const { exited } = execute(f, env);
      assert.deepEqual(await exited, [1, null]);
      assert.equal(existsSync(f.env.OWNED_EFFECT), false);
    } finally {
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
test('the actual sampler append path is bounded at180 and reports truncation', () => {
  const host = { samples: [], truncated: false };
  for (let index = 0; index < 181; index++) appendHostSample(host, { atMs: index });
  assert.equal(host.samples.length, 180);
  assert.equal(host.truncated, true);
  assert.equal(host.samples.at(-1).atMs, 179);
});

function coreHost() {
  const numbers = (fields) => Object.fromEntries(fields.map((field) => [field, 1]));
  return {
    platform: 'linux',
    errors: 0,
    truncated: false,
    samples: [
      {
        available: true,
        errors: 1,
        unavailable: ['cgroupMemoryEvents'],
        unavailableReasons: { cgroupMemoryEvents: 'absent' },
        cpuTicks: Array(10).fill(1),
        memoryKiB: numbers(['MemTotal', 'MemAvailable', 'Cached', 'SwapTotal', 'SwapFree']),
        cgroupCpu: numbers([
          'usage_usec',
          'user_usec',
          'system_usec',
          'nr_periods',
          'nr_throttled',
          'throttled_usec',
        ]),
        cpuPressure: numbers(['some_avg10', 'some_avg60', 'some_avg300', 'some_total']),
        memoryPressure: numbers(['some_avg10', 'some_avg60', 'some_avg300', 'some_total']),
        ioPressure: numbers(['some_avg10', 'some_avg60', 'some_avg300', 'some_total']),
      },
    ],
  };
}
test('auxiliary gaps remain partial while missing or stale core data cannot qualify', () => {
  const host = coreHost();
  const covered = hostCoverage(host);
  assert.equal(covered.coreComplete, true);
  assert.equal(covered.complete, false);
  assert.equal(covered.coverage, 'partial');
  delete host.samples[0].memoryKiB;
  host.samples[0].errors = 0;
  host.samples[0].unavailable = [];
  host.samples[0].unavailableReasons = {};
  assert.equal(hostCoverage(host).coreComplete, false);
  host.samples[0].memoryKiB = { MemTotal: marker };
  assert.equal(hostCoverage(host).coreComplete, false);
  host.samples = [];
  assert.equal(hostCoverage(host).coreComplete, false);
});
function ownedReadiness(f, running, signal) {
  const state = { pid: undefined };
  let watcher;
  let abort;
  let owner;
  let rejectOwner;
  const owned = new Promise((accept, reject) => {
    owner = accept;
    rejectOwner = reject;
  });
  const ready = new Promise((accept, reject) => {
    const check = () => {
      try {
        if (!existsSync(f.env.OWNED_EFFECT)) return;
        const text = readFileSync(f.env.OWNED_EFFECT, 'utf8');
        if (!text.endsWith('\n')) return;
        const value = JSON.parse(text);
        if (
          !Number.isSafeInteger(value.pid) ||
          value.pid <= 0 ||
          value.cwd !== f.directory ||
          value.marker !== marker ||
          JSON.stringify(value.argv) !== JSON.stringify(BENCHMARK_ARGS)
        )
          throw new Error('Invalid owned readiness');
        state.pid = value.pid;
        owner(value.pid);
        if (value.ready === true) accept();
      } catch {
        const failure = new Error('Owned readiness unavailable');
        reject(failure);
        rejectOwner(failure);
      }
    };
    abort = () => {
      const failure = new Error('Owned readiness aborted');
      reject(failure);
      rejectOwner(failure);
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    try {
      watcher = watch(f.directory, check);
      watcher.once('error', () => {
        const failure = new Error('Owned readiness watcher failed');
        reject(failure);
        rejectOwner(failure);
      });
    } catch {
      const failure = new Error('Owned readiness setup failed');
      reject(failure);
      rejectOwner(failure);
      return;
    }
    check();
  });
  const stopped = running.exited.then(() => {
    throw new Error('Owned wrapper exited before readiness');
  });
  const ownerReady = Promise.race([owned, stopped]);
  void ownerReady.catch(() => undefined);
  return {
    state,
    owned: ownerReady,
    ready: Promise.race([ready, stopped]),
    close() {
      watcher?.close();
      signal.removeEventListener('abort', abort);
    },
  };
}
function groupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    if (error.code === 'EPERM') return true;
    const category = [
      'EPERM',
      'ERR_OUT_OF_RANGE',
      'ERR_INVALID_ARG_TYPE',
      'ERR_UNKNOWN_SIGNAL',
    ].includes(error.code)
      ? error.code
      : 'other';
    throw new Error(`Owned group state unavailable: ${category}`);
  }
}
async function groupExited(pid, deadline = performance.now() + 1000) {
  if (!groupExists(pid)) return;
  if (performance.now() >= deadline) throw new Error('Owned group did not exit');
  await delay(10);
  return groupExited(pid, deadline);
}
async function boundedExit(running) {
  let timer;
  try {
    return await Promise.race([
      running.exited,
      new Promise((_accept, reject) => {
        timer = setTimeout(() => reject(new Error('Owned wrapper did not exit')), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function releaseOwned(f, running, readiness) {
  readiness.close();
  const pid = readiness.state.pid;
  if (pid !== undefined) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch (error) {
      if (!['ESRCH', 'EPERM'].includes(error.code)) throw new Error('Owned group cleanup failed');
    }
  }
  if (running.child.exitCode === null && running.child.signalCode === null)
    running.child.kill(pid === undefined ? 'SIGTERM' : 'SIGKILL');
  await boundedExit(running);
  if (pid !== undefined) await groupExited(pid);
  rmSync(f.directory, { recursive: true, force: true });
}
test(
  'wrapper cancellation forwards to the owned child and preserves its OS signal',
  { timeout: 5000 },
  async (context) => {
    const f = fixture('wait');
    const running = execute(f);
    const readiness = ownedReadiness(f, running, context.signal);
    try {
      await readiness.ready;
      running.child.kill('SIGTERM');
      assert.deepEqual(await running.exited, [null, 'SIGTERM']);
      const host = readReceipt(f);
      assert.equal(host.interruptedBy, 'SIGTERM');
      assert.equal(host.isolationQualified, false);
      assert.equal(host.child.signal, 'SIGTERM');
    } finally {
      await releaseOwned(f, running, readiness);
    }
  },
);
test(
  'early wrapper exit rejects readiness and releases its watcher before fixture removal',
  { timeout: 5000 },
  async (context) => {
    const f = fixture('early-exit');
    const running = execute(f);
    const readiness = ownedReadiness(f, running, context.signal);
    try {
      await assert.rejects(readiness.ready, /Owned wrapper exited before readiness/u);
      assert.deepEqual(await running.exited, [3, null]);
    } finally {
      await releaseOwned(f, running, readiness);
    }
    assert.equal(existsSync(f.directory), false);
  },
);
test(
  'a readiness abort releases the known detached shim even after its wrapper is killed',
  { timeout: 5000 },
  async (context) => {
    const f = fixture('wait-no-ready');
    const running = execute(f);
    const controller = new globalThis.AbortController();
    const readiness = ownedReadiness(
      f,
      running,
      globalThis.AbortSignal.any([context.signal, controller.signal]),
    );
    let pid;
    try {
      const rejected = assert.rejects(readiness.ready, /Owned readiness aborted/u);
      void rejected.catch(() => undefined);
      pid = await readiness.owned;
      controller.abort();
      await rejected;
      running.child.kill('SIGKILL');
      assert.deepEqual(await running.exited, [null, 'SIGKILL']);
      assert.equal(groupExists(pid), true);
    } finally {
      await releaseOwned(f, running, readiness);
    }
    assert.equal(groupExists(pid), false);
    assert.equal(existsSync(f.directory), false);
  },
);

test(
  'synchronous watcher setup failure rejects both waits and releases abort ownership',
  { timeout: 5000 },
  async (context) => {
    const f = fixture('success');
    const priorListeners = getEventListeners(context.signal, 'abort').length;
    const running = { exited: new Promise(() => {}) };
    const readiness = ownedReadiness(
      { ...f, directory: join(f.directory, 'missing-owned-directory') },
      running,
      context.signal,
    );
    try {
      await Promise.all([
        assert.rejects(readiness.ready, /Owned readiness setup failed/u),
        assert.rejects(readiness.owned, /Owned readiness setup failed/u),
      ]);
      assert.doesNotThrow(() => readiness.close());
      assert.equal(getEventListeners(context.signal, 'abort').length, priorListeners);
      assert.equal(existsSync(f.env.OWNED_EFFECT), false);
    } finally {
      readiness.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
