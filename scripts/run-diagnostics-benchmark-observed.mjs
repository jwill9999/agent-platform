import process from 'node:process';
import { setInterval, clearInterval } from 'node:timers';
import { spawn } from 'node:child_process';
import {
  readFileSync,
  lstatSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preload = pathToFileURL(join(root, 'scripts/diagnostics-benchmark-observer.mjs')).href;
const MAX_HOST_SAMPLES = 180;
const MAX_LEDGER_FILES = 32;
const MAX_LEDGER_BYTES = 1024 * 1024;
const eventFields = {
  'worker-create': ['ordinal', 'actualThreadId'],
  'worker-close-request': ['ordinal', 'actualThreadId'],
  'worker-close-ack': ['ordinal', 'actualThreadId', 'success'],
  'worker-exit': ['ordinal', 'actualThreadId', 'exitCode'],
  'worker-terminate': ['ordinal', 'actualThreadId'],
  'statfs-start': ['ordinal'],
  'statfs-settle': ['ordinal', 'success'],
  gc: ['startTimeMs', 'durationMs', 'kind', 'flags'],
  'benchmark-raw-write': ['success'],
};
const numeric = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

const invalidCounters = (message) =>
  Object.assign(new Error(message), { code: 'INVALID_OBSERVER_COUNTERS' });
export function resourceFailureReason(error) {
  if (error?.code === 'ENOENT') return 'absent';
  if (['EACCES', 'EPERM'].includes(error?.code)) return 'unreadable';
  if (error?.code === 'INVALID_OBSERVER_COUNTERS') return 'invalid';
  return 'other';
}
const counter = (value) => /^\d+$/u.test(value ?? '') && numeric(Number(value));
export function parseNumericLines(text, allowed) {
  const values = {};
  for (const line of text.trim().split('\n')) {
    const [key, value] = line.replace(':', '').trim().split(/\s+/u);
    if (allowed.includes(key) && counter(value)) values[key] = Number(value);
  }
  if (!allowed.every((key) => Object.hasOwn(values, key)))
    throw invalidCounters('Unavailable resource counters');
  return values;
}
export function parseCpuTicks(text) {
  const [name, ...fields] = text.split('\n')[0].trim().split(/\s+/u);
  const values = fields.slice(0, 10);
  if (name !== 'cpu' || values.length !== 10 || !values.every(counter))
    throw invalidCounters('Unavailable CPU counters');
  return values.map(Number);
}
const pressureFields = ['avg10', 'avg60', 'avg300', 'total'];
function parsePressureFields(fields) {
  const values = {};
  for (const field of fields) {
    const [name, value] = field.split('=');
    if (
      pressureFields.includes(name) &&
      /^\d+(?:\.\d+)?$/u.test(value ?? '') &&
      numeric(Number(value))
    )
      values[name] = Number(value);
  }
  if (!pressureFields.every((key) => Object.hasOwn(values, key)))
    throw invalidCounters('Unavailable pressure counters');
  return values;
}
export function parsePressure(text) {
  const values = {};
  for (const line of text.trim().split('\n')) {
    const [kind, ...fields] = line.split(' ');
    if (kind !== 'some' && kind !== 'full') continue;
    for (const [name, value] of Object.entries(parsePressureFields(fields)))
      values[`${kind}_${name}`] = value;
  }
  if (!Object.hasOwn(values, 'some_total')) throw invalidCounters('Unavailable pressure counters');
  return values;
}
function numericLines(path, allowed) {
  return parseNumericLines(readFileSync(path, 'utf8'), allowed);
}
function pressure(path) {
  return parsePressure(readFileSync(path, 'utf8'));
}
export function linuxSample() {
  const sample = {
    available: process.platform === 'linux',
    errors: 0,
    unavailable: [],
    unavailableReasons: {},
  };
  if (!sample.available) return sample;
  const capture = (name, operation) => {
    try {
      sample[name] = operation();
    } catch (error) {
      sample.errors++;
      sample.unavailable.push(name);
      sample.unavailableReasons[name] = resourceFailureReason(error);
    }
  };
  capture('cpuTicks', () => parseCpuTicks(readFileSync('/proc/stat', 'utf8')));
  capture('memoryKiB', () =>
    numericLines('/proc/meminfo', ['MemTotal', 'MemAvailable', 'Cached', 'SwapTotal', 'SwapFree']),
  );
  capture('cgroupCpu', () =>
    numericLines('/sys/fs/cgroup/cpu.stat', [
      'usage_usec',
      'user_usec',
      'system_usec',
      'nr_periods',
      'nr_throttled',
      'throttled_usec',
    ]),
  );
  capture('cgroupMemoryEvents', () =>
    numericLines('/sys/fs/cgroup/memory.events', ['low', 'high', 'max', 'oom', 'oom_kill']),
  );
  for (const name of ['cpu', 'memory', 'io'])
    capture(`${name}Pressure`, () => pressure(`/proc/pressure/${name}`));
  return sample;
}

function hasExactKeys(input, expected) {
  const actual = Object.keys(input);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}
function projectEvent(row) {
  const fields = eventFields[row.event];
  if (
    !Array.isArray(fields) ||
    !hasExactKeys(row, ['event', 'atMs', ...fields]) ||
    !numeric(row.atMs)
  )
    throw new Error('Invalid observer event');
  for (const key of fields) {
    const valid = key === 'success' ? typeof row[key] === 'boolean' : numeric(row[key]);
    if (!valid) throw new Error('Invalid observer event value');
  }
}
function checkCapabilities(capabilities) {
  if (
    !capabilities ||
    !hasExactKeys(capabilities, ['gc', 'rawWrite', 'statfs', 'worker']) ||
    !Object.values(capabilities).every((value) => typeof value === 'boolean')
  )
    throw new Error('Invalid observer capabilities');
}
export function projectLedger(input) {
  const keys = [
    'schemaVersion',
    'pid',
    'threadId',
    'timeOriginMs',
    'startedAtMs',
    'exitedAtMs',
    'exitCode',
    'flushReason',
    'capabilities',
    'errors',
    'truncated',
    'events',
  ];
  if (!input || !hasExactKeys(input, keys) || input.schemaVersion !== 1)
    throw new Error('Invalid observer receipt');
  for (const key of ['pid', 'threadId', 'timeOriginMs', 'startedAtMs', 'exitedAtMs', 'errors'])
    if (!numeric(input[key])) throw new Error('Invalid observer counter');
  const validExitCode =
    input.flushReason === 'exit' ? numeric(input.exitCode) : input.exitCode === null;
  if (!['exit', 'SIGTERM', 'SIGINT'].includes(input.flushReason) || !validExitCode)
    throw new Error('Invalid observer termination');
  checkCapabilities(input.capabilities);
  if (
    typeof input.truncated !== 'boolean' ||
    !Array.isArray(input.events) ||
    input.events.length > 4096
  )
    throw new Error('Invalid observer event count');
  input.events.forEach(projectEvent);
  return input;
}
function collectLedgers(directory) {
  const names = readdirSync(directory).toSorted((left, right) => left.localeCompare(right));
  const observation = {
    processes: [],
    errors: 0,
    truncated: names.length > MAX_LEDGER_FILES,
    missing: false,
  };
  for (const name of names.slice(0, MAX_LEDGER_FILES)) {
    try {
      if (!/^\d+\.json$/u.test(name)) throw new Error('Invalid observer filename');
      const info = lstatSync(join(directory, name));
      if (!info.isFile() || info.size > MAX_LEDGER_BYTES) throw new Error('Invalid observer file');
      const bytes = readFileSync(join(directory, name));
      if (bytes.byteLength > MAX_LEDGER_BYTES) throw new Error('Oversized observer receipt');
      observation.processes.push(projectLedger(JSON.parse(bytes.toString('utf8'))));
    } catch {
      observation.errors++;
    }
  }
  observation.missing = observation.processes.length === 0;
  return observation;
}

const resourceFields = {
  memoryKiB: ['MemTotal', 'MemAvailable', 'Cached', 'SwapTotal', 'SwapFree'],
  cgroupCpu: [
    'usage_usec',
    'user_usec',
    'system_usec',
    'nr_periods',
    'nr_throttled',
    'throttled_usec',
  ],
  cgroupMemoryEvents: ['low', 'high', 'max', 'oom', 'oom_kill'],
};
const coreFields = [
  'cpuTicks',
  'memoryKiB',
  'cgroupCpu',
  'cpuPressure',
  'memoryPressure',
  'ioPressure',
];
const failureReasons = new Set(['absent', 'unreadable', 'invalid', 'other']);
function counterSet(input, fields) {
  return !!input && fields.every((field) => numeric(input[field]));
}
function pressureSet(input) {
  if (
    !counterSet(
      input,
      pressureFields.map((field) => `some_${field}`),
    )
  )
    return false;
  return (
    !Object.keys(input).some((field) => field.startsWith('full_')) ||
    counterSet(
      input,
      pressureFields.map((field) => `full_${field}`),
    )
  );
}
function coreCounters(sample) {
  return (
    Array.isArray(sample.cpuTicks) &&
    sample.cpuTicks.length === 10 &&
    sample.cpuTicks.every(numeric) &&
    counterSet(sample.memoryKiB, resourceFields.memoryKiB) &&
    counterSet(sample.cgroupCpu, resourceFields.cgroupCpu) &&
    ['cpuPressure', 'memoryPressure', 'ioPressure'].every((field) => pressureSet(sample[field]))
  );
}
function validGaps(sample) {
  const fields = new Set([...coreFields, 'cgroupMemoryEvents']);
  return (
    Array.isArray(sample.unavailable) &&
    sample.errors === sample.unavailable.length &&
    new Set(sample.unavailable).size === sample.unavailable.length &&
    sample.unavailable.every((field) => fields.has(field)) &&
    !!sample.unavailableReasons &&
    hasExactKeys(sample.unavailableReasons, sample.unavailable) &&
    Object.values(sample.unavailableReasons).every((reason) => failureReasons.has(reason))
  );
}
export function hostCoverage(host) {
  const reliable =
    host.errors === 0 &&
    host.truncated === false &&
    Array.isArray(host.samples) &&
    host.samples.length > 0 &&
    host.samples.every(validGaps);
  const linuxAvailable =
    host.platform === 'linux' &&
    reliable &&
    host.samples.every((sample) => sample.available === true);
  const coreComplete =
    linuxAvailable &&
    host.samples.every(
      (sample) =>
        coreCounters(sample) &&
        sample.unavailable.every((field) => field === 'cgroupMemoryEvents') &&
        (counterSet(sample.cgroupMemoryEvents, resourceFields.cgroupMemoryEvents) ||
          sample.unavailable.includes('cgroupMemoryEvents')),
    );
  const complete =
    coreComplete &&
    host.samples.every(
      (sample) =>
        sample.errors === 0 &&
        counterSet(sample.cgroupMemoryEvents, resourceFields.cgroupMemoryEvents),
    );
  let coverage = 'unavailable';
  if (linuxAvailable) coverage = complete ? 'full' : 'partial';
  return { reliable, linuxAvailable, coreComplete, complete, coverage };
}
function processCoverage(observation) {
  try {
    if (!Array.isArray(observation.processes) || observation.processes.length > MAX_LEDGER_FILES)
      throw new Error('Invalid observer processes');
    const processes = observation.processes.map(projectLedger);
    const owners = processes.filter((entry) =>
      entry.events.some((row) => row.event === 'benchmark-raw-write' && row.success),
    );
    const owner = owners[0];
    const complete =
      observation.errors === 0 &&
      observation.missing === false &&
      observation.truncated === false &&
      processes.every(
        (entry) =>
          entry.errors === 0 &&
          !entry.truncated &&
          Object.values(entry.capabilities).every(Boolean),
      ) &&
      owners.length === 1 &&
      ['worker-create', 'statfs-start'].every((kind) =>
        owner.events.some(({ event }) => event === kind),
      );
    return {
      complete,
      rawOwners: owners.map(({ pid, threadId, timeOriginMs }) => ({ pid, threadId, timeOriginMs })),
    };
  } catch {
    return { complete: false, rawOwners: [] };
  }
}
export function diagnosticCoverage(observation, host) {
  const process = processCoverage(observation);
  const resources = hostCoverage(host);
  const localControl =
    host.platform !== 'linux' &&
    resources.reliable &&
    host.samples.every((sample) => sample.available === false && sample.errors === 0);
  return {
    processComplete: process.complete,
    rawOwners: process.rawOwners,
    host: resources,
    complete: process.complete && resources.complete,
    diagnosticEligibility: process.complete && (resources.coreComplete || localControl),
    diagnosticScope: host.platform === 'linux' ? 'linux-diagnostic' : 'non-linux-control-only',
  };
}

export async function runObservedCommand({ command, args, cwd = root, prefix, env = process.env }) {
  mkdirSync(dirname(prefix), { recursive: true });
  const directory = mkdtempSync(join(dirname(prefix), 'diagnostic-observer-'));
  const host = {
    schemaVersion: 1,
    platform: process.platform,
    pid: process.pid,
    timeOriginMs: performance.timeOrigin,
    cadenceMs: 1000,
    baselineMs: 5000,
    samples: [],
    errors: 0,
    truncated: false,
    overhead: {},
  };
  let phase = 'baseline';
  let samplerWallMs = 0;
  let samplerCpuUserMicros = 0;
  let samplerCpuSystemMicros = 0;
  const sample = () => {
    if (host.samples.length === MAX_HOST_SAMPLES) {
      host.truncated = true;
      return;
    }
    const started = performance.now();
    const cpu = process.cpuUsage();
    try {
      host.samples.push({ atMs: started, phase, ...linuxSample() });
    } catch {
      host.errors++;
    }
    const used = process.cpuUsage(cpu);
    samplerWallMs += performance.now() - started;
    samplerCpuUserMicros += used.user;
    samplerCpuSystemMicros += used.system;
  };
  const baselineCpu = process.cpuUsage();
  const baselineStarted = performance.now();
  sample();
  const timer = setInterval(sample, 1000);
  await delay(5000);
  host.overhead.baselineWallMs = performance.now() - baselineStarted;
  host.overhead.baselineCpu = process.cpuUsage(baselineCpu);
  phase = 'measurement';
  const child = spawn(command, args, {
    cwd,
    detached: process.platform !== 'win32',
    stdio: 'inherit',
    env: {
      ...env,
      DIAGNOSTICS_OBSERVER_DIRECTORY: directory,
      NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --import=${preload}`.trim(),
    },
  });
  const forward = (signal) => {
    try {
      process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal);
    } catch {
      host.errors++;
    }
  };
  const onTerm = () => forward('SIGTERM');
  const onInt = () => forward('SIGINT');
  process.on('SIGTERM', onTerm);
  process.on('SIGINT', onInt);
  let result;
  try {
    result = await new Promise((accept) => {
      child.once('error', () => accept({ exitCode: 1, signal: null, spawnFailed: true }));
      child.once('close', (exitCode, signal) => accept({ exitCode, signal, spawnFailed: false }));
    });
  } finally {
    clearInterval(timer);
    process.off('SIGTERM', onTerm);
    process.off('SIGINT', onInt);
  }
  host.overhead.samplerWallMs = samplerWallMs;
  host.overhead.samplerCpuUserMicros = samplerCpuUserMicros;
  host.overhead.samplerCpuSystemMicros = samplerCpuSystemMicros;
  let observation;
  try {
    observation = collectLedgers(directory);
  } catch {
    observation = { processes: [], errors: 1, missing: true, truncated: false };
  }
  const coverage = diagnosticCoverage(observation, host);
  observation.processComplete = coverage.processComplete;
  observation.rawOwners = coverage.rawOwners;
  observation.complete = coverage.complete;
  observation.diagnosticEligibility = coverage.diagnosticEligibility;
  observation.diagnosticScope = coverage.diagnosticScope;
  host.linuxAvailable = coverage.host.linuxAvailable;
  host.coreComplete = coverage.host.coreComplete;
  host.complete = coverage.host.complete;
  host.coverage = coverage.host.coverage;
  observation.limitations = [
    'Scoped to the fixed pnpm/Vitest command and active child processes; a bare self-signalling eval with no live handle can exit before a JavaScript signal callback.',
    'Foreign signal handlers permanently disable this observer for that signal; SIGKILL cannot flush. Missing raw-writer observations never qualify.',
    'Root cgroup memory-event counters are auxiliary and may be unavailable; eligible partial host coverage is never complete coverage.',
    'Non-Linux control-only eligibility does not qualify Linux resource coverage.',
    'GC delivery is asynchronous and can be incomplete; recorded sampling overhead is never subtracted from benchmark durations.',
  ];
  observation.child = result;
  let publicationComplete = true;
  try {
    writeFileSync(`${prefix}-observer.json`, JSON.stringify(observation, null, 2), { mode: 0o600 });
    writeFileSync(`${prefix}-host.json`, JSON.stringify(host, null, 2), { mode: 0o600 });
  } catch {
    publicationComplete = false;
  }
  try {
    rmSync(directory, { recursive: true, force: true });
  } catch {
    publicationComplete = false;
  }
  return {
    ...result,
    observationComplete: observation.complete && publicationComplete,
    diagnosticEligibility: observation.diagnosticEligibility && publicationComplete,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const separator = process.argv.indexOf('--');
  const command = separator === -1 ? 'pnpm' : process.argv[separator + 1];
  const args =
    separator === -1
      ? [
          '--filter',
          '@agent-platform/api',
          'exec',
          'vitest',
          'run',
          'test/diagnostics.performance.test.ts',
          '--maxWorkers=1',
          '--no-file-parallelism',
        ]
      : process.argv.slice(separator + 2);
  const prefix = process.env.DIAGNOSTICS_BENCHMARK_OBSERVER_PREFIX;
  if (!prefix || !command) throw new Error('Observed benchmark output or command missing');
  try {
    const result = await runObservedCommand({ command, args, prefix });
    if (result.signal) process.kill(process.pid, result.signal);
    else process.exitCode = result.exitCode || (result.diagnosticEligibility ? 0 : 1);
  } catch {
    process.stderr.write('Observed benchmark evidence unavailable.\n');
    process.exitCode = 1;
  }
}
