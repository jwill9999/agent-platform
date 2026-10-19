import process from 'node:process';
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  lstatSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  projectLedger,
  diagnosticCoverage,
  resourceFailureReason,
  parseNumericLines,
  parseCpuTicks,
  parsePressure,
} from './run-diagnostics-benchmark-observed.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wrapper = join(root, 'scripts/run-diagnostics-benchmark-observed.mjs');
const preload = pathToFileURL(join(root, 'scripts/diagnostics-benchmark-observer.mjs')).href;
const api = join(root, 'apps/api');
const failures = [];
const proofs = [];
function persistProofs(
  destination = process.env.DIAGNOSTICS_OBSERVER_CONTROL_RESULT,
  entries = proofs,
) {
  if (destination) writeFileSync(destination, JSON.stringify({ proofs: entries }, null, 2));
}
after(() => persistProofs());

const metricFields = {
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
const pressureFields = ['some', 'full'].flatMap((kind) =>
  ['avg10', 'avg60', 'avg300', 'total'].map((field) => `${kind}_${field}`),
);
const unavailableFields = [
  'cpuTicks',
  ...Object.keys(metricFields),
  'cpuPressure',
  'memoryPressure',
  'ioPressure',
];
function numbers(input, fields) {
  const result = {};
  for (const field of fields) {
    if (!Object.hasOwn(input, field)) continue;
    if (typeof input[field] !== 'number' || !Number.isFinite(input[field]) || input[field] < 0)
      throw new Error('Invalid numeric control proof');
    result[field] = input[field];
  }
  return result;
}
function status(input) {
  if (input.exitCode !== null && (!Number.isInteger(input.exitCode) || input.exitCode < 0))
    throw new Error('Invalid control exit');
  if (input.signal !== null && typeof input.signal !== 'string')
    throw new Error('Invalid control signal');
  const signal = [null, 'SIGTERM', 'SIGINT', 'SIGKILL'].includes(input.signal)
    ? input.signal
    : 'other';
  return { exitCode: input.exitCode, signal };
}
function readProofFile(path, project) {
  try {
    const info = lstatSync(path);
    if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error('Invalid control file');
    return { availability: 'available', value: project(JSON.parse(readFileSync(path, 'utf8'))) };
  } catch (error) {
    return { availability: error.code === 'ENOENT' ? 'missing' : 'invalid' };
  }
}
function projectRaw(input) {
  const value = numbers(input, ['pid', 'timeOriginMs', 'fixtureThreadId']);
  if (Object.keys(value).length !== 3 || typeof input.receiptBeforeExit !== 'boolean')
    throw new Error('Invalid raw control proof');
  return { ...value, receiptBeforeExit: input.receiptBeforeExit };
}
function projectObservation(input) {
  if (
    !Array.isArray(input.processes) ||
    input.processes.length > 32 ||
    !Array.isArray(input.rawOwners) ||
    input.rawOwners.length > 32
  )
    throw new Error('Invalid observer control proof');
  const flags = {};
  for (const field of [
    'complete',
    'processComplete',
    'diagnosticEligibility',
    'truncated',
    'missing',
  ]) {
    if (typeof input[field] !== 'boolean') throw new Error('Invalid observer control flag');
    flags[field] = input[field];
  }
  if (!['linux-diagnostic', 'non-linux-control-only'].includes(input.diagnosticScope))
    throw new Error('Invalid diagnostic control scope');
  return {
    ...flags,
    diagnosticScope: input.diagnosticScope,
    ...numbers(input, ['errors']),
    child: { ...status(input.child), spawnFailed: input.child.spawnFailed === true },
    processes: input.processes.map(projectLedger),
    rawOwners: input.rawOwners.map((owner) => numbers(owner, ['pid', 'threadId', 'timeOriginMs'])),
  };
}
function projectGaps(input) {
  if (
    !Array.isArray(input.unavailable) ||
    input.unavailable.length > unavailableFields.length ||
    !input.unavailable.every((field) => unavailableFields.includes(field))
  )
    throw new Error('Invalid unavailable control fields');
  const reasons = input.unavailableReasons;
  if (
    !reasons ||
    Object.keys(reasons).length !== input.unavailable.length ||
    !Object.entries(reasons).every(
      ([field, reason]) =>
        input.unavailable.includes(field) &&
        ['absent', 'unreadable', 'invalid', 'other'].includes(reason),
    )
  )
    throw new Error('Invalid unavailable control reasons');
  return { unavailable: input.unavailable, unavailableReasons: reasons };
}
function projectSample(input) {
  if (!['baseline', 'measurement'].includes(input.phase) || typeof input.available !== 'boolean')
    throw new Error('Invalid sample control proof');
  const sample = {
    ...numbers(input, ['atMs', 'errors']),
    phase: input.phase,
    available: input.available,
    ...projectGaps(input),
  };
  if (input.cpuTicks !== undefined) {
    if (
      !Array.isArray(input.cpuTicks) ||
      input.cpuTicks.length !== 10 ||
      !input.cpuTicks.every((value) => Number.isFinite(value) && value >= 0)
    )
      throw new Error('Invalid CPU control proof');
    sample.cpuTicks = input.cpuTicks;
  }
  for (const [field, allowed] of Object.entries(metricFields))
    if (input[field] !== undefined) sample[field] = numbers(input[field], allowed);
  for (const field of ['cpuPressure', 'memoryPressure', 'ioPressure'])
    if (input[field] !== undefined) sample[field] = numbers(input[field], pressureFields);
  return sample;
}
function projectHost(input) {
  if (
    !['linux', 'darwin', 'win32'].includes(input.platform) ||
    typeof input.complete !== 'boolean' ||
    typeof input.coreComplete !== 'boolean' ||
    typeof input.linuxAvailable !== 'boolean' ||
    !['full', 'partial', 'unavailable'].includes(input.coverage) ||
    typeof input.truncated !== 'boolean' ||
    !Array.isArray(input.samples) ||
    input.samples.length > 180
  )
    throw new Error('Invalid host control proof');
  return {
    ...numbers(input, [
      'schemaVersion',
      'pid',
      'timeOriginMs',
      'cadenceMs',
      'baselineMs',
      'errors',
    ]),
    platform: input.platform,
    complete: input.complete,
    coreComplete: input.coreComplete,
    linuxAvailable: input.linuxAvailable,
    coverage: input.coverage,
    truncated: input.truncated,
    samples: input.samples.map(projectSample),
    overhead: {
      ...numbers(input.overhead, [
        'baselineWallMs',
        'samplerWallMs',
        'samplerCpuUserMicros',
        'samplerCpuSystemMicros',
      ]),
      baselineCpu: numbers(input.overhead.baselineCpu, ['user', 'system']),
    },
  };
}
function retainForkProof(
  result,
  directory,
  entries = proofs,
  destination = process.env.DIAGNOSTICS_OBSERVER_CONTROL_RESULT,
) {
  const proof = {
    kind: 'actual-pnpm-default-vitest-fork',
    stage: 'before-success-assertions',
    wrapper: status(result),
    raw: readProofFile(join(directory, 'raw.json'), projectRaw),
    observer: readProofFile(`${result.prefix}-observer.json`, projectObservation),
    host: readProofFile(`${result.prefix}-host.json`, projectHost),
  };
  entries.push(proof);
  persistProofs(destination, entries);
  return proof;
}

async function execute(args, directory, extraEnv = {}) {
  const prefix = join(directory, 'result');
  const child = spawn(process.execPath, [wrapper, '--', ...args], {
    cwd: root,
    env: {
      ...process.env,
      DIAGNOSTICS_BENCHMARK_OBSERVER_PREFIX: prefix,
      DIAGNOSTICS_BENCHMARK_RESULT: join(directory, 'raw.json'),
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => {
      if (output.length < 65536) output += chunk.toString().slice(0, 65536 - output.length);
    });
  const [exitCode, signal] = await once(child, 'exit');
  writeFileSync(join(directory, 'owned-child.log'), output);
  return { exitCode, signal, prefix, output };
}

function fixture() {
  return mkdtempSync(join(tmpdir(), 'diagnostic-observer-control-'));
}

test(
  'real pnpm → default Vitest fork observes owned workers/statfs/raw writer only at fork exit',
  { timeout: 30000 },
  async () => {
    const directory = fixture();
    try {
      const testPath = join(directory, 'observer.test.ts');
      const configPath = join(directory, 'vitest.config.mts');
      writeFileSync(
        configPath,
        `import original from ${JSON.stringify(join(api, 'vitest.config.ts'))};\nexport default {...original,test:{...original.test,include:[${JSON.stringify(testPath)}]}};\n`,
      );
      writeFileSync(
        testPath,
        `
import { it, expect } from ${JSON.stringify(join(api, 'node_modules/vitest/dist/index.js'))};
import { Worker, isMainThread } from 'node:worker_threads';
import { once } from 'node:events';
import { statfs } from 'node:fs/promises';
import { writeFileSync, readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
it('keeps real worker and filesystem semantics', async () => {
  expect(isMainThread).toBe(true);
  const worker = new Worker(\`const {parentPort}=require('node:worker_threads');parentPort.on('message', value=>{parentPort.postMessage({id:value.id,result:null});parentPort.close();});\`, {eval:true});
  const fixtureThreadId = worker.threadId;
  const exited = once(worker, 'exit');
  const reply = once(worker, 'message');
  worker.postMessage({id:7,type:'close'});
  expect((await reply)[0]).toEqual({id:7,result:null});
  expect((await exited)[0]).toBe(0);
  const fs = await statfs(${JSON.stringify(directory)});
  expect(fs.bsize).toBeGreaterThan(0);
  const stopped = new Worker('setInterval(()=>{},1000)', {eval:true});
  const stoppedExit = once(stopped, 'exit');
  const terminationCode = await stopped.terminate();
  expect(Number.isInteger(terminationCode)).toBe(true);
  expect((await stoppedExit)[0]).toBe(terminationCode);
  const currentReceipt=String(process.pid)+'.json';
  expect(readdirSync(process.env.DIAGNOSTICS_OBSERVER_DIRECTORY).includes(currentReceipt)).toBe(false);
  writeFileSync(process.env.DIAGNOSTICS_BENCHMARK_RESULT, JSON.stringify({pid:process.pid,timeOriginMs:performance.timeOrigin,receiptBeforeExit:false,fixtureThreadId}));
});
`,
      );
      const result = await execute(
        [
          'pnpm',
          '--filter',
          '@agent-platform/api',
          'exec',
          'vitest',
          'run',
          '--config',
          configPath,
          '--maxWorkers=1',
          '--no-file-parallelism',
        ],
        directory,
      );
      retainForkProof(result, directory);
      assert.equal(result.signal, null);
      assert.equal(result.exitCode, 0, 'Owned fork control must complete successfully');
      const raw = JSON.parse(readFileSync(join(directory, 'raw.json'), 'utf8'));
      const observed = JSON.parse(readFileSync(`${result.prefix}-observer.json`, 'utf8'));
      const host = JSON.parse(readFileSync(`${result.prefix}-host.json`, 'utf8'));
      assert.equal(observed.processComplete, true);
      assert.equal(observed.diagnosticEligibility, true);
      assert.equal(observed.complete, host.complete);
      if (host.platform === 'linux') {
        assert.equal(host.coreComplete, true);
        assert.equal(observed.diagnosticScope, 'linux-diagnostic');
      } else {
        assert.equal(host.linuxAvailable, false);
        assert.equal(host.coreComplete, false);
        assert.equal(host.complete, false);
        assert.equal(host.coverage, 'unavailable');
        assert.equal(observed.diagnosticScope, 'non-linux-control-only');
      }
      assert.deepEqual(observed.rawOwners, [
        { pid: raw.pid, threadId: 0, timeOriginMs: raw.timeOriginMs },
      ]);
      const owner = observed.processes.find(({ pid }) => pid === raw.pid);
      for (const event of [
        'worker-create',
        'worker-close-request',
        'worker-close-ack',
        'worker-exit',
        'worker-terminate',
        'statfs-start',
        'statfs-settle',
        'benchmark-raw-write',
      ])
        assert.ok(
          owner.events.some((row) => row.event === event),
          `Missing fixed event: ${event}`,
        );
      const created = owner.events.find(
        (event) => event.event === 'worker-create' && event.actualThreadId === raw.fixtureThreadId,
      );
      assert.ok(created, 'The fixture worker must have its own create event');
      for (const kind of ['worker-close-request', 'worker-close-ack', 'worker-exit']) {
        const matching = owner.events.filter(
          (event) =>
            event.event === kind &&
            event.ordinal === created.ordinal &&
            event.actualThreadId === raw.fixtureThreadId,
        );
        assert.equal(matching.length, 1, `Expected one matching fixture event: ${kind}`);
        if (kind === 'worker-close-ack') assert.equal(matching[0].success, true);
        if (kind === 'worker-exit') assert.equal(matching[0].exitCode, 0);
      }
      assert.equal(raw.receiptBeforeExit, false);
      assert.ok(
        owner.events
          .filter(({ event }) => event === 'statfs-settle')
          .every(({ success }) => success),
      );
      assert.equal(host.baselineMs, 5000);
      assert.ok(host.overhead.baselineWallMs >= 5000);
      assert.ok(host.samples.some(({ phase }) => phase === 'baseline'));
      assert.ok(!JSON.stringify(observed).includes(directory));
      assert.ok(!JSON.stringify(host).includes(directory));
    } catch (error) {
      failures.push(directory);
      throw error;
    } finally {
      if (!failures.includes(directory)) rmSync(directory, { recursive: true, force: true });
    }
  },
);

test(
  'statfs observation preserves original promise/result/rejection identity',
  { timeout: 10000 },
  async () => {
    const directory = fixture();
    const ledgers = join(directory, 'ledgers');
    mkdirSync(ledgers, { mode: 0o700 });
    try {
      const script = join(directory, 'identity.mjs');
      writeFileSync(
        script,
        `
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const fs=createRequire(import.meta.url)('node:fs/promises');
let resolve,reject;const first=new Promise(yes=>resolve=yes);const second=new Promise((_yes,no)=>reject=no);
let calls=0;fs.statfs=()=>++calls===1?first:second;
await import(${JSON.stringify(preload)});
const value={bsize:4096};const failure=new Error('owned failure');
assert.equal(fs.statfs('/not-used-by-owned-double'),first);resolve(value);assert.equal(await first,value);
assert.equal(fs.statfs('/not-used-by-owned-double'),second);reject(failure);await assert.rejects(second,error=>error===failure);
`,
      );
      const child = spawn(process.execPath, [script], {
        env: { ...process.env, DIAGNOSTICS_OBSERVER_DIRECTORY: ledgers },
        stdio: 'ignore',
      });
      const [code, signal] = await once(child, 'exit');
      assert.equal(signal, null);
      assert.equal(code, 0);
      const names = readdirSync(ledgers);
      assert.equal(names.length, 1);
      const observed = JSON.parse(readFileSync(join(ledgers, names[0]), 'utf8'));
      assert.equal(observed.errors, 0);
      proofs.push({ kind: 'original-statfs-promise-result-error-identity', passed: true });
      assert.deepEqual(
        observed.events
          .filter(({ event }) => event === 'statfs-settle')
          .map(({ success }) => success),
        [true, false],
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

for (const scenario of [
  { name: 'nonzero child failure', script: 'process.exit(7)', exitCode: 7, signal: null },
  {
    name: 'child interrupt',
    script: "setInterval(()=>{},1000);process.kill(process.pid,'SIGINT')",
    exitCode: null,
    signal: 'SIGINT',
  },
  {
    name: 'child signal',
    script: "setInterval(()=>{},1000);process.kill(process.pid,'SIGTERM')",
    exitCode: null,
    signal: 'SIGTERM',
  },
])
  test(
    `preserves ${scenario.name} without observation success masking`,
    { timeout: 15000 },
    async () => {
      const directory = fixture();
      try {
        const result = await execute([process.execPath, '-e', scenario.script], directory);
        assert.equal(result.exitCode, scenario.exitCode);
        assert.equal(result.signal, scenario.signal);
        const observed = JSON.parse(readFileSync(`${result.prefix}-observer.json`, 'utf8'));
        assert.equal(observed.complete, false);
        assert.equal(observed.child.exitCode, scenario.exitCode);
        assert.equal(observed.child.signal, scenario.signal);
        proofs.push({
          kind: scenario.name,
          childExitCode: observed.child.exitCode,
          actualExitCode: result.exitCode,
          childSignal: observed.child.signal,
          actualSignal: result.signal,
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

for (const registration of ['on', 'once', 'prependOnceListener']) {
  for (const timing of ['existing', 'later']) {
    test(
      `preserves ${timing} ${registration} signal ownership without early flush`,
      { timeout: 10000 },
      async () => {
        const directory = fixture();
        const ledgers = join(directory, 'ledgers');
        mkdirSync(ledgers, { mode: 0o700 });
        try {
          const script = join(directory, 'handled.mjs');
          const register = `process.${registration}('SIGTERM',()=>{handled++;assert.equal(readdirSync(process.env.DIAGNOSTICS_OBSERVER_DIRECTORY).includes(String(process.pid)+'.json'),false);});`;
          writeFileSync(
            script,
            `import assert from 'node:assert/strict';import {readdirSync} from 'node:fs';import {statfs} from 'node:fs/promises';let handled=0;${timing === 'existing' ? register : ''}await import(${JSON.stringify(preload)});${timing === 'later' ? register : ''}process.kill(process.pid,'SIGTERM');await new Promise(setImmediate);assert.equal(handled,1);await statfs(${JSON.stringify(directory)});`,
          );
          const child = spawn(process.execPath, [script], {
            env: { ...process.env, DIAGNOSTICS_OBSERVER_DIRECTORY: ledgers },
            stdio: 'ignore',
          });
          const [code, signal] = await once(child, 'exit');
          assert.equal(code, 0);
          assert.equal(signal, null);
          const names = readdirSync(ledgers);
          assert.equal(names.length, 1);
          const receipt = JSON.parse(readFileSync(join(ledgers, names[0]), 'utf8'));
          assert.equal(receipt.flushReason, 'exit');
          assert.equal(receipt.exitCode, 0);
          proofs.push({
            kind: `${timing}-${registration}-signal-handler`,
            exitCode: code,
            signal,
            flushReason: receipt.flushReason,
            noEarlyFlush: true,
          });
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      },
    );
  }
}

for (const disposition of ['removed', 'consumed'])
  test(
    `never resurrects observer after a foreign handler is ${disposition}`,
    { timeout: 10000 },
    async () => {
      const directory = fixture();
      const ledgers = join(directory, 'ledgers');
      mkdirSync(ledgers, { mode: 0o700 });
      try {
        const script = join(directory, 'foreign-lifetime.mjs');
        const change =
          disposition === 'removed'
            ? "process.on('SIGTERM',handler);process.off('SIGTERM',handler);"
            : "process.once('SIGTERM',handler);process.kill(process.pid,'SIGTERM');await new Promise(setImmediate);assert.equal(handled,1);";
        writeFileSync(
          script,
          `import assert from 'node:assert/strict';import {statfs} from 'node:fs/promises';await import(${JSON.stringify(preload)});let handled=0;const handler=()=>handled++;${change}await statfs(${JSON.stringify(directory)});process.kill(process.pid,'SIGTERM');await new Promise(()=>{});`,
        );
        const child = spawn(process.execPath, [script], {
          env: { ...process.env, DIAGNOSTICS_OBSERVER_DIRECTORY: ledgers },
          stdio: 'ignore',
        });
        const [code, signal] = await once(child, 'exit');
        assert.equal(code, null);
        assert.equal(signal, 'SIGTERM');
        assert.equal(readdirSync(ledgers).length, 0);
        proofs.push({
          kind: `foreign-${disposition}-no-resurrection`,
          exitCode: code,
          signal,
          missingExitLedger: true,
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

test(
  'a missing observation is visible and cannot turn a clean child into qualification',
  { timeout: 15000 },
  async () => {
    const directory = fixture();
    try {
      const result = await execute(
        [
          process.execPath,
          '-e',
          "require('node:fs').rmdirSync(process.env.DIAGNOSTICS_OBSERVER_DIRECTORY)",
        ],
        directory,
      );
      assert.equal(result.exitCode, 1);
      assert.equal(result.signal, null);
      const observed = JSON.parse(readFileSync(`${result.prefix}-observer.json`, 'utf8'));
      assert.equal(observed.child.exitCode, 0);
      assert.equal(observed.complete, false);
      assert.equal(observed.missing, true);
      proofs.push({
        kind: 'missing-observation-blocks-clean-child',
        childExitCode: 0,
        wrapperExitCode: 1,
        missing: true,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);

function validLedger() {
  return {
    schemaVersion: 1,
    pid: 1,
    threadId: 0,
    timeOriginMs: 1,
    startedAtMs: 0,
    exitedAtMs: 1,
    exitCode: 0,
    flushReason: 'exit',
    capabilities: { gc: true, rawWrite: true, statfs: true, worker: true },
    errors: 0,
    truncated: false,
    events: [{ event: 'worker-create', atMs: 0, ordinal: 1, actualThreadId: 1 }],
  };
}

test('exact ledger schemas accept reordered keys without replacing the receipt', () => {
  const reordered = (value) => Object.fromEntries(Object.entries(value).reverse());
  const ledger = reordered(validLedger());
  ledger.capabilities = reordered(ledger.capabilities);
  ledger.events = ledger.events.map(reordered);
  assert.equal(projectLedger(ledger), ledger);
});

for (const scope of ['ledger', 'capabilities', 'event']) {
  for (const mutation of ['joined', 'missing', 'extra']) {
    test(`exact ${scope} schema rejects ${mutation} keys`, () => {
      const ledger = validLedger();
      let target = ledger;
      if (scope === 'event') target = ledger.events[0];
      else if (scope === 'capabilities') target = ledger.capabilities;
      if (mutation === 'extra') target.unexpected = true;
      else if (mutation === 'missing') delete target[Object.keys(target)[0]];
      else {
        const keys = Object.keys(target).toSorted((left, right) => left.localeCompare(right));
        const value = scope === 'capabilities' ? true : 1;
        for (const key of keys) delete target[key];
        target[keys.join(',')] = value;
      }
      assert.throws(() => projectLedger(ledger), /Invalid observer/u);
    });
  }
}

test('resource parsers require complete finite counter sets', () => {
  assert.deepEqual(
    parseNumericLines('MemTotal: 12 kB\nMemAvailable: 3 kB\n', ['MemTotal', 'MemAvailable']),
    { MemTotal: 12, MemAvailable: 3 },
  );
  for (const text of [
    '',
    'MemTotal: 12 kB',
    'MemTotal: 12 kB\nMemAvailable: invalid',
    `MemTotal: 12 kB\nMemAvailable: ${'9'.repeat(400)}`,
  ])
    assert.throws(
      () => parseNumericLines(text, ['MemTotal', 'MemAvailable']),
      /Unavailable resource counters/u,
    );
  assert.deepEqual(
    parseCpuTicks('cpu 1 2 3 4 5 6 7 8 9 10\ncpu0 1 2'),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  for (const text of [
    '',
    'cpu 1 2 3',
    'cpu0 1 2 3 4 5 6 7 8 9 10',
    'cpu 1 2 3 4 5 6 7 8 9 invalid',
  ])
    assert.throws(() => parseCpuTicks(text), /Unavailable CPU counters/u);
});

test('pressure parser requires a complete some row and any present full row', () => {
  const some = 'some avg10=0.00 avg60=0.50 avg300=1.00 total=17';
  const full = 'full avg10=0.00 avg60=0.00 avg300=0.00 total=0';
  assert.deepEqual(parsePressure(some), {
    some_avg10: 0,
    some_avg60: 0.5,
    some_avg300: 1,
    some_total: 17,
  });
  assert.equal(parsePressure(`${some}\n${full}`).full_total, 0);
  for (const text of [
    '',
    full,
    'some avg10=0 avg60=0 avg300=0',
    `${some}\nfull avg10=0`,
    'some avg10=invalid avg60=0 avg300=0 total=1',
  ])
    assert.throws(() => parsePressure(text), /Unavailable pressure counters/u);
});

test('failed first-control assertions retain bounded proof without publishing child output', () => {
  const directory = fixture();
  try {
    const prefix = join(directory, 'result');
    const destination = join(directory, 'proof.json');
    const marker = 'private-control-marker';
    writeFileSync(
      join(directory, 'raw.json'),
      JSON.stringify({
        pid: 7,
        timeOriginMs: 8,
        fixtureThreadId: 9,
        receiptBeforeExit: false,
        secret: marker,
      }),
    );
    writeFileSync(`${prefix}-host.json`, '{invalid');
    const entries = [];
    assert.throws(() => {
      retainForkProof(
        { exitCode: 1, signal: null, prefix, output: marker },
        directory,
        entries,
        destination,
      );
      assert.equal(1, 0, 'Intentional owned control failure');
    }, /Intentional owned control failure/u);
    const saved = JSON.parse(readFileSync(destination, 'utf8'));
    assert.equal(saved.proofs.length, 1);
    assert.deepEqual(saved.proofs[0].wrapper, { exitCode: 1, signal: null });
    assert.equal(saved.proofs[0].stage, 'before-success-assertions');
    assert.equal(saved.proofs[0].raw.availability, 'available');
    assert.equal(saved.proofs[0].observer.availability, 'missing');
    assert.equal(saved.proofs[0].host.availability, 'invalid');
    assert.equal(JSON.stringify(saved).includes(marker), false);
    assert.equal(JSON.stringify(saved).includes(directory), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('failed wrapper proof retains safe child and host diagnostics while excluding untrusted fields', () => {
  const directory = fixture();
  try {
    const prefix = join(directory, 'result');
    const marker = 'private-proof-marker';
    writeFileSync(
      `${prefix}-observer.json`,
      JSON.stringify({
        complete: false,
        processComplete: true,
        diagnosticEligibility: false,
        diagnosticScope: 'linux-diagnostic',
        truncated: false,
        missing: false,
        errors: 0,
        child: { exitCode: 7, signal: null, spawnFailed: false, error: marker },
        processes: [validLedger()],
        rawOwners: [{ pid: 1, threadId: 0, timeOriginMs: 1 }],
        secret: marker,
      }),
    );
    writeFileSync(
      `${prefix}-host.json`,
      JSON.stringify({
        schemaVersion: 1,
        platform: 'linux',
        pid: 2,
        timeOriginMs: 3,
        cadenceMs: 1000,
        baselineMs: 5000,
        complete: false,
        coreComplete: false,
        linuxAvailable: true,
        coverage: 'partial',
        truncated: false,
        errors: 0,
        samples: [
          {
            atMs: 4,
            phase: 'measurement',
            available: true,
            errors: 1,
            unavailable: ['cgroupCpu'],
            unavailableReasons: { cgroupCpu: 'unreadable' },
            secret: marker,
          },
        ],
        overhead: { baselineWallMs: 5001, baselineCpu: { user: 1, system: 2 }, secret: marker },
        secret: marker,
      }),
    );
    const entries = [];
    const proof = retainForkProof({ exitCode: 1, signal: null, prefix }, directory, entries, null);
    assert.equal(proof.raw.availability, 'missing');
    assert.equal(proof.observer.availability, 'available');
    assert.deepEqual(proof.observer.value.child, { exitCode: 7, signal: null, spawnFailed: false });
    assert.equal(proof.host.availability, 'available');
    assert.deepEqual(proof.host.value.samples[0].unavailable, ['cgroupCpu']);
    assert.equal(proof.host.value.samples[0].errors, 1);
    assert.equal(JSON.stringify(proof).includes(marker), false);
    assert.equal(JSON.stringify(proof).includes(directory), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('unexpected wrapper signals retain a fixed safe failure category before assertions', () => {
  const directory = fixture();
  try {
    for (const signal of ['SIGABRT', 'private-untrusted-signal-marker']) {
      const entries = [];
      const proof = retainForkProof(
        { exitCode: null, signal, prefix: join(directory, 'result') },
        directory,
        entries,
        null,
      );
      assert.equal(entries.length, 1);
      assert.deepEqual(proof.wrapper, { exitCode: null, signal: 'other' });
      assert.equal(proof.raw.availability, 'missing');
      assert.equal(proof.observer.availability, 'missing');
      assert.equal(proof.host.availability, 'missing');
      assert.equal(JSON.stringify(proof).includes(signal), false);
      assert.equal(JSON.stringify(proof).includes(directory), false);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function coverageFixture() {
  const ledger = validLedger();
  ledger.events.push(
    { event: 'statfs-start', atMs: 0, ordinal: 1 },
    { event: 'benchmark-raw-write', atMs: 1, success: true },
  );
  const sample = {
    available: true,
    errors: 0,
    unavailable: [],
    unavailableReasons: {},
    cpuTicks: Array(10).fill(1),
  };
  for (const [field, keys] of Object.entries(metricFields))
    sample[field] = Object.fromEntries(keys.map((key) => [key, 1]));
  for (const field of ['cpuPressure', 'memoryPressure', 'ioPressure'])
    sample[field] = Object.fromEntries(pressureFields.map((key) => [key, 0]));
  return {
    observation: { processes: [ledger], errors: 0, missing: false, truncated: false },
    host: { platform: 'linux', errors: 0, truncated: false, samples: [sample] },
  };
}
function missingMetric(host, field, reason) {
  const sample = host.samples[0];
  delete sample[field];
  sample.errors = 1;
  sample.unavailable = [field];
  sample.unavailableReasons = { [field]: reason };
}
test('an auxiliary-only host gap is eligible but explicitly partial and incomplete', () => {
  const { observation, host } = coverageFixture();
  missingMetric(host, 'cgroupMemoryEvents', 'absent');
  const result = diagnosticCoverage(observation, host);
  assert.equal(result.processComplete, true);
  assert.equal(result.host.coreComplete, true);
  assert.equal(result.host.complete, false);
  assert.equal(result.host.coverage, 'partial');
  assert.equal(result.complete, false);
  assert.equal(result.diagnosticEligibility, true);
  assert.equal(result.diagnosticScope, 'linux-diagnostic');
  assert.equal(Object.hasOwn(host.samples[0], 'cgroupMemoryEvents'), false);
  assert.deepEqual(host.samples[0].unavailableReasons, { cgroupMemoryEvents: 'absent' });
});
test('a core host gap cannot qualify the diagnostic', () => {
  const { observation, host } = coverageFixture();
  missingMetric(host, 'cgroupCpu', 'unreadable');
  const result = diagnosticCoverage(observation, host);
  assert.equal(result.processComplete, true);
  assert.equal(result.host.coreComplete, false);
  assert.equal(result.host.complete, false);
  assert.equal(result.diagnosticEligibility, false);
});
test('a malformed process ledger cannot qualify even with full host coverage', () => {
  const { observation, host } = coverageFixture();
  observation.processes[0].capabilities = { 'gc,rawWrite,statfs,worker': true };
  const result = diagnosticCoverage(observation, host);
  assert.equal(result.host.complete, true);
  assert.equal(result.processComplete, false);
  assert.equal(result.complete, false);
  assert.equal(result.diagnosticEligibility, false);
});
test('fully available valid observations are complete and eligible', () => {
  const { observation, host } = coverageFixture();
  const result = diagnosticCoverage(observation, host);
  assert.equal(result.processComplete, true);
  assert.equal(result.host.coreComplete, true);
  assert.equal(result.host.complete, true);
  assert.equal(result.host.coverage, 'full');
  assert.equal(result.complete, true);
  assert.equal(result.diagnosticEligibility, true);
});
test('resource failure reasons expose only fixed categories, never errors or paths', () => {
  const marker = '/private/untrusted-error-marker';
  for (const [code, reason] of [
    ['ENOENT', 'absent'],
    ['EACCES', 'unreadable'],
    ['EPERM', 'unreadable'],
    ['INVALID_OBSERVER_COUNTERS', 'invalid'],
    ['private-code-marker', 'other'],
  ]) {
    const projected = resourceFailureReason(
      Object.assign(new Error(marker), { code, path: marker }),
    );
    assert.equal(projected, reason);
    assert.equal(projected.includes(marker), false);
    assert.equal(projected.includes(code), false);
  }
  assert.equal(resourceFailureReason(new Error(marker)), 'other');
});

test('missing core counters cannot qualify through stale successful gap flags', () => {
  const { observation, host } = coverageFixture();
  delete host.samples[0].memoryKiB;
  const result = diagnosticCoverage(observation, host);
  assert.equal(host.samples[0].errors, 0);
  assert.deepEqual(host.samples[0].unavailable, []);
  assert.equal(result.host.coreComplete, false);
  assert.equal(result.diagnosticEligibility, false);
});
test('empty host samples cannot qualify through stale complete flags', () => {
  const { observation, host } = coverageFixture();
  host.samples = [];
  host.complete = true;
  host.coreComplete = true;
  const result = diagnosticCoverage(observation, host);
  assert.equal(result.host.coreComplete, false);
  assert.equal(result.host.complete, false);
  assert.equal(result.diagnosticEligibility, false);
});
