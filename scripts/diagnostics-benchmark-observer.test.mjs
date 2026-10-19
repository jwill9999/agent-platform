import process from 'node:process';
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wrapper = join(root, 'scripts/run-diagnostics-benchmark-observed.mjs');
const preload = pathToFileURL(join(root, 'scripts/diagnostics-benchmark-observer.mjs')).href;
const api = join(root, 'apps/api');
const failures = [];
const proofs = [];
after(() => {
  if (process.env.DIAGNOSTICS_OBSERVER_CONTROL_RESULT)
    writeFileSync(
      process.env.DIAGNOSTICS_OBSERVER_CONTROL_RESULT,
      JSON.stringify({ proofs }, null, 2),
    );
});

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
  writeFileSync(process.env.DIAGNOSTICS_BENCHMARK_RESULT, JSON.stringify({pid:process.pid,timeOriginMs:performance.timeOrigin,receiptBeforeExit:false}));
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
      assert.equal(result.signal, null);
      assert.equal(result.exitCode, 0, 'Owned fork control must complete successfully');
      const raw = JSON.parse(readFileSync(join(directory, 'raw.json'), 'utf8'));
      const observed = JSON.parse(readFileSync(`${result.prefix}-observer.json`, 'utf8'));
      assert.equal(observed.complete, true);
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
      assert.equal(raw.receiptBeforeExit, false);
      proofs.push({
        kind: 'actual-pnpm-default-vitest-fork',
        pid: raw.pid,
        timeOriginMs: raw.timeOriginMs,
        events: owner.events.map(({ event }) => event),
        observer: observed,
        flushReason: owner.flushReason,
        noLedgerBeforeExit: true,
        exitCode: result.exitCode,
      });
      assert.ok(
        owner.events
          .filter(({ event }) => event === 'statfs-settle')
          .every(({ success }) => success),
      );
      const host = JSON.parse(readFileSync(`${result.prefix}-host.json`, 'utf8'));
      assert.equal(host.baselineMs, 5000);
      assert.ok(host.overhead.baselineWallMs >= 5000);
      assert.ok(host.samples.some(({ phase }) => phase === 'baseline'));
      assert.ok(!JSON.stringify(observed).includes(directory));
      assert.ok(!JSON.stringify(host).includes(directory));
      proofs[0].host = host;
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
