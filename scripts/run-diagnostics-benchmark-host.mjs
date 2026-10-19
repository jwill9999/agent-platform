import process from 'node:process';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { setInterval, clearInterval } from 'node:timers';
import { linuxSample, hostCoverage } from './run-diagnostics-benchmark-observed.mjs';

export const BENCHMARK_ARGS = Object.freeze([
  '--filter',
  '@agent-platform/api',
  'exec',
  'vitest',
  'run',
  'test/diagnostics.performance.test.ts',
  '--maxWorkers=1',
  '--no-file-parallelism',
]);
const MAX_SAMPLES = 180;
const clock = () => ({ wallTimeMs: Date.now(), monotonicMs: performance.now() });
const safeSignal = (signal) =>
  [null, 'SIGTERM', 'SIGINT', 'SIGKILL'].includes(signal) ? signal : 'other';

export function appendHostSample(host, sample) {
  if (host.samples.length >= MAX_SAMPLES) {
    host.truncated = true;
    return;
  }
  host.samples.push(sample);
}
function takeSample(host, phase) {
  if (host.samples.length >= MAX_SAMPLES) {
    host.truncated = true;
    return;
  }
  const started = performance.now();
  const cpu = process.cpuUsage();
  try {
    appendHostSample(host, { atMs: started, phase, ...linuxSample() });
  } catch {
    host.errors++;
  }
  const elapsed = process.cpuUsage(cpu);
  host.overhead.samplerWallMs += performance.now() - started;
  host.overhead.samplerCpuUserMicros += elapsed.user;
  host.overhead.samplerCpuSystemMicros += elapsed.system;
}
function observeChild(command, args, options) {
  const child = spawn(command, args, options);
  let interruptedBy = null;
  const forward = (signal) => {
    interruptedBy ??= signal;
    try {
      process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
    } catch {
      // Preserve the child's eventual status; no signal or process error text is published.
    }
  };
  const onTerm = () => forward('SIGTERM');
  const onInt = () => forward('SIGINT');
  process.on('SIGTERM', onTerm);
  process.on('SIGINT', onInt);
  return new Promise((accept) => {
    let spawnFailed = false;
    child.once('error', () => {
      spawnFailed = true;
    });
    child.once('close', (exitCode, signal) => {
      process.off('SIGTERM', onTerm);
      process.off('SIGINT', onInt);
      accept({ exitCode: spawnFailed ? 1 : exitCode, signal, spawnFailed, interruptedBy });
    });
  });
}

export async function runHostCommand({
  command = 'pnpm',
  args = BENCHMARK_ARGS,
  cwd = process.cwd(),
  env = process.env,
  receiptPath,
}) {
  const host = {
    schemaVersion: 1,
    platform: process.platform,
    pid: process.pid,
    timeOriginMs: performance.timeOrigin,
    cadenceMs: 1000,
    samples: [],
    errors: 0,
    truncated: false,
    overhead: { samplerWallMs: 0, samplerCpuUserMicros: 0, samplerCpuSystemMicros: 0 },
    before: clock(),
  };
  takeSample(host, 'before');
  host.childStarted = clock();
  const timer = setInterval(() => takeSample(host, 'during'), 1000);
  let result;
  try {
    result = await observeChild(command, args, {
      cwd,
      env,
      detached: process.platform !== 'win32',
      stdio: 'inherit',
    });
  } finally {
    clearInterval(timer);
  }
  host.childClosed = clock();
  takeSample(host, 'after');
  host.after = clock();
  const coverage = hostCoverage(host);
  host.linuxAvailable = coverage.linuxAvailable;
  host.coreComplete = coverage.coreComplete;
  host.complete = coverage.complete;
  host.coverage = coverage.coverage;
  host.child = {
    exitCode: result.exitCode,
    signal: safeSignal(result.signal),
    spawnFailed: result.spawnFailed,
  };
  host.interruptedBy = safeSignal(result.interruptedBy);
  host.isolationQualified =
    result.exitCode === 0 &&
    result.signal === null &&
    result.interruptedBy === null &&
    !result.spawnFailed &&
    coverage.coreComplete;
  host.limitations = [
    'Global numeric host counters support coarse phase context, not per-request causality.',
    'Auxiliary memory-event gaps remain partial; missing core Linux counters cannot qualify.',
    'Non-Linux execution does not qualify Linux host coverage.',
    'Sampler overhead is recorded without subtraction; no benchmark output is read or adjusted.',
    'Hard kill or failed publication leaves missing evidence and cannot qualify.',
  ];
  let publicationComplete = true;
  try {
    writeFileSync(receiptPath, JSON.stringify(host, null, 2), { flag: 'wx', mode: 0o600 });
  } catch {
    publicationComplete = false;
  }
  return { ...result, isolationQualified: host.isolationQualified && publicationComplete };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2 || !process.env.DIAGNOSTICS_BENCHMARK_HOST_RESULT)
      throw new Error('Host evidence destination required');
    const result = await runHostCommand({
      receiptPath: process.env.DIAGNOSTICS_BENCHMARK_HOST_RESULT,
    });
    const signal = result.interruptedBy ?? result.signal;
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = result.exitCode || (result.isolationQualified ? 0 : 1);
  } catch {
    process.stderr.write('Benchmark host evidence unavailable.\n');
    process.exitCode = 1;
  }
}
