import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, writeFile, unlink, readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { watch } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';

import { createGhLedgerFixture } from './gh-ledger.mjs';

const execute = promisify(execFile);
const shared = ['--repo', 'fixture/project', '--head', 'task/example', '--base', 'staging'];
const fields = 'number,url,headRefName,baseRefName,title,body,isDraft';
const create = ['pr', 'create', ...shared, '--title', 'Example', '--body', 'Reviewed content'];
const list = ['pr', 'list', ...shared, '--state', 'open', '--json', fields];

function invoke(fixture, args, extraEnv = fixture.env) {
  return execute(fixture.executable, args, {
    env: { PATH: dirname(process.execPath), ...extraEnv },
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}

async function own(context, options) {
  const fixture = await createGhLedgerFixture(options);
  context.after(() => fixture.close());
  return fixture;
}

test('auth status is explicit and unknown commands fail without ledger effects', async (context) => {
  const fixture = await own(context);
  assert.match((await invoke(fixture, ['auth', 'status'])).stdout, /ready/);
  await assert.rejects(invoke(fixture, ['auth', 'status', '--unexpected']), { code: 2 });
  await assert.rejects(invoke(fixture, ['api', '/user']), { code: 2 });
  await fixture.setFailureModes({ authFailure: true });
  await assert.rejects(invoke(fixture, ['auth', 'status']), { code: 1 });
  const ledger = await fixture.readLedger();
  assert.equal(ledger.calls.length, 2);
  assert.deepEqual(ledger.pullRequests, []);
});

test('creates a PR with exact arguments and matches both head and base', async (context) => {
  const fixture = await own(context);
  const title = 'Quoted "title" $(no shell)';
  const body = 'First line\n`literal content`';
  const args = ['pr', 'create', ...shared, '--title', title, '--body', body, '--draft'];
  assert.equal(
    (await invoke(fixture, args)).stdout.trim(),
    'https://github.com/fixture/project/pull/1',
  );
  const rows = JSON.parse((await invoke(fixture, list)).stdout);
  assert.deepEqual(rows, [
    {
      number: 1,
      url: 'https://github.com/fixture/project/pull/1',
      headRefName: 'task/example',
      baseRefName: 'staging',
      title,
      body,
      isDraft: true,
    },
  ]);
  const otherBase = list.map((arg) => (arg === 'staging' ? 'main' : arg));
  const otherHead = list.map((arg) => (arg === 'task/example' ? 'task/elsewhere' : arg));
  assert.deepEqual(JSON.parse((await invoke(fixture, otherBase)).stdout), []);
  assert.deepEqual(JSON.parse((await invoke(fixture, otherHead)).stdout), []);
  assert.deepEqual((await fixture.readLedger()).calls[0].args, args);
});

test('lost creation response preserves effect and lookup can reconcile without a second creation', async (context) => {
  const fixture = await own(context, { loseCreateResponseOnce: true });
  await assert.rejects(invoke(fixture, create), { code: 1 });
  assert.equal((await fixture.readLedger()).pullRequests.length, 1);
  assert.equal(JSON.parse((await invoke(fixture, list)).stdout).length, 1);
  await assert.rejects(invoke(fixture, create), { code: 1 });
  const ledger = await fixture.readLedger();
  assert.equal(ledger.pullRequests.length, 1);
  assert.equal(ledger.calls.filter((call) => call.args[1] === 'create').length, 2);
});

test('enrichment failure is separate from successful creation', async (context) => {
  const fixture = await own(context, { enrichmentFailure: true });
  assert.deepEqual(JSON.parse((await invoke(fixture, list)).stdout), []);
  assert.match((await invoke(fixture, create)).stdout, /pull\/1/);
  await assert.rejects(invoke(fixture, list), { code: 1 });
  const ledger = await fixture.readLedger();
  assert.equal(ledger.pullRequests.length, 1);
  assert.deepEqual(
    ledger.calls.map((call) => [call.args[1], call.outcome]),
    [
      ['list', 'success'],
      ['create', 'success'],
      ['list', 'error'],
    ],
  );
  await fixture.setFailureModes({ enrichmentFailure: false });
  assert.equal(JSON.parse((await invoke(fixture, list)).stdout).length, 1);
});

test('accepts the full 65536-character PR body and rejects larger input before effects', async (context) => {
  const fixture = await own(context);
  const body = 'x'.repeat(65536);
  await assert.rejects(invoke(fixture, [...create.slice(0, -1), `${body}x`]), { code: 2 });
  assert.deepEqual((await fixture.readLedger()).pullRequests, []);
  await invoke(fixture, [...create.slice(0, -1), body]);
  assert.equal((await fixture.readLedger()).pullRequests[0].body, body);
});

test('rejects missing, duplicate, unsupported options and another repository before effects', async (context) => {
  const fixture = await own(context);
  for (const args of [
    create.slice(0, -2),
    [...create, '--draft', '--draft'],
    [...create, '--web'],
    create.map((arg) => (arg === 'fixture/project' ? 'another/repo' : arg)),
    list.map((arg) => (arg === fields ? 'number' : arg)),
  ]) {
    await assert.rejects(invoke(fixture, args), { code: 2 });
  }
  assert.deepEqual((await fixture.readLedger()).pullRequests, []);
  assert.deepEqual((await fixture.readLedger()).calls, []);
});

test('requires explicit fixture state and never inherits real gh authentication', async (context) => {
  const fixture = await own(context);
  await assert.rejects(invoke(fixture, create, { GH_TOKEN: 'fixture-sentinel-not-real' }), {
    code: 2,
  });
  assert.deepEqual((await fixture.readLedger()).calls, []);
});

test('isolates concurrent fixture lifetimes and removes only owned state', async (context) => {
  const first = await own(context);
  const second = await own(context);
  await Promise.all([invoke(first, create), invoke(second, create)]);
  assert.notEqual(first.directory, second.directory);
  assert.equal((await first.readLedger()).pullRequests.length, 1);
  assert.equal((await second.readLedger()).pullRequests.length, 1);
  await first.close();
  await assert.rejects(access(first.directory), { code: 'ENOENT' });
  assert.equal((await second.readLedger()).pullRequests.length, 1);
});

test('busy state rejects execution, reconfiguration and premature cleanup', async (context) => {
  const fixture = await own(context);
  const lock = join(fixture.directory, 'active.lock');
  await writeFile(lock, '', { flag: 'wx' });
  try {
    await assert.rejects(invoke(fixture, create), { code: 2 });
    await assert.rejects(fixture.close(), /Await owned child/);
    await assert.rejects(fixture.setFailureModes({ authFailure: true }), /Await owned child/);
    assert.deepEqual((await fixture.readLedger()).pullRequests, []);
  } finally {
    await unlink(lock);
  }
});

test('rejects unrecognised failure configuration', async () => {
  await assert.rejects(
    createGhLedgerFixture({ repository: '../outside' }),
    /Invalid fixture repository/,
  );
  await assert.rejects(createGhLedgerFixture({ arbitrary: true }), /Invalid failure mode/);
  await assert.rejects(createGhLedgerFixture({ authFailure: 'yes' }), /Invalid failure mode/);
});

const panelFields =
  'number,title,state,url,headRefName,baseRefName,author,isDraft,reviewDecision,mergeable,createdAt,updatedAt,statusCheckRollup';
const panelList = [
  'pr',
  'list',
  '--repo',
  'fixture/project',
  '--state',
  'open',
  '--limit',
  '30',
  '--json',
  panelFields,
];
const panelChecks = [
  'pr',
  'view',
  '--repo',
  'fixture/project',
  '--json',
  'number,url,statusCheckRollup',
];
const commitChecks = [
  'api',
  `repos/fixture/project/commits/${'a'.repeat(40)}/check-runs`,
  '--jq',
  '.check_runs',
];

test('supports exact panel discovery and empty checks without invented PRs or successes', async (context) => {
  const fixture = await own(context);
  assert.match((await invoke(fixture, ['--version'])).stdout, /owned fixture/);
  assert.match(
    (await invoke(fixture, ['auth', 'status', '--hostname', 'github.com'])).stdout,
    /ready/,
  );
  assert.deepEqual(
    JSON.parse(
      (await invoke(fixture, ['repo', 'view', 'fixture/project', '--json', 'url'])).stdout,
    ),
    { url: 'https://github.com/fixture/project' },
  );
  assert.deepEqual(JSON.parse((await invoke(fixture, panelList)).stdout), []);
  await assert.rejects(invoke(fixture, panelChecks), { code: 1 });
  assert.deepEqual(JSON.parse((await invoke(fixture, commitChecks)).stdout), []);
  assert.deepEqual((await fixture.readLedger()).pullRequests, []);
  await fixture.setFailureModes({ authFailure: true });
  await assert.rejects(invoke(fixture, ['auth', 'status', '--hostname', 'github.com']), {
    code: 1,
  });
});

test('panel PRs come from created ledger effects and checks follow explicitly selected branch', async (context) => {
  const fixture = await own(context, { currentBranch: 'task/example' });
  await invoke(fixture, [...create, '--draft']);
  const rows = JSON.parse((await invoke(fixture, panelList)).stdout);
  assert.deepEqual(rows, [
    {
      number: 1,
      url: 'https://github.com/fixture/project/pull/1',
      title: 'Example',
      headRefName: 'task/example',
      baseRefName: 'staging',
      isDraft: true,
      state: 'OPEN',
      statusCheckRollup: [],
    },
  ]);
  assert.deepEqual(JSON.parse((await invoke(fixture, panelChecks)).stdout), {
    number: 1,
    url: rows[0].url,
    statusCheckRollup: [],
  });
  assert.equal(JSON.parse((await invoke(fixture, list)).stdout)[0].body, 'Reviewed content');
  await fixture.setCurrentBranch('task/elsewhere');
  await assert.rejects(invoke(fixture, panelChecks), { code: 1 });
  await fixture.setCurrentBranch(undefined);
  await assert.rejects(invoke(fixture, panelChecks), { code: 1 });
  await fixture.setCurrentBranch('task/example');
  await fixture.setFailureModes({ enrichmentFailure: true });
  await assert.rejects(invoke(fixture, panelList), { code: 1 });
  await assert.rejects(invoke(fixture, panelChecks), { code: 1 });
  assert.equal((await fixture.readLedger()).pullRequests.length, 1);
});

test('panel reads reject unsupported mutations, foreign targets and altered queries before ledger writes', async (context) => {
  const fixture = await own(context);
  for (const args of [
    ['--version', '--extra'],
    ['auth', 'status', '--hostname', 'elsewhere.invalid'],
    ['repo', 'view', 'another/repo', '--json', 'url'],
    ['repo', 'create', 'fixture/project'],
    ['pr', 'merge', '1'],
    [...panelChecks, '--repo', 'fixture/project'],
    panelChecks.map((arg) => (arg === 'fixture/project' ? 'another/repo' : arg)),
    panelList.map((arg) => (arg === '30' ? '100' : arg)),
    panelList.map((arg) => (arg === panelFields ? 'number' : arg)),
    panelList.map((arg) => (arg === 'open' ? 'all' : arg)),
    commitChecks.map((arg) => (arg === '.check_runs' ? '.' : arg)),
    commitChecks.map((arg) =>
      arg.includes('/commits/')
        ? 'repos/another/repo/commits/' + 'a'.repeat(40) + '/check-runs'
        : arg,
    ),
    ['api', 'repos/fixture/project/commits/HEAD/check-runs', '--jq', '.check_runs'],
    [...commitChecks, '--method', 'POST'],
  ])
    await assert.rejects(invoke(fixture, args), { code: 2 });
  assert.deepEqual((await fixture.readLedger()).calls, []);
  assert.deepEqual((await fixture.readLedger()).pullRequests, []);
});

test('current branch configuration is explicit, validated and cannot change during an invocation', async (context) => {
  await assert.rejects(
    createGhLedgerFixture({ currentBranch: 1 }),
    /Invalid fixture current branch/,
  );
  const fixture = await own(context);
  await assert.rejects(fixture.setCurrentBranch('bad\nbranch'), /Invalid fixture current branch/);
  const lock = join(fixture.directory, 'active.lock');
  await writeFile(lock, '', { flag: 'wx' });
  try {
    await assert.rejects(fixture.setCurrentBranch('task/example'), /Await owned child/);
  } finally {
    await unlink(lock);
  }
});

test('qualified asynchronous PR reads use the explicit captured branch rather than fixture current branch', async (context) => {
  const fixture = await own(context, { currentBranch: 'task/elsewhere' });
  await invoke(fixture, create);
  const explicit = [...panelChecks, '--', 'task/example'];
  assert.deepEqual(JSON.parse((await invoke(fixture, explicit)).stdout), {
    number: 1,
    url: 'https://github.com/fixture/project/pull/1',
    statusCheckRollup: [],
  });
  await assert.rejects(invoke(fixture, [...panelChecks, '--', 'task/missing']), { code: 1 });
  const rows = JSON.parse((await invoke(fixture, panelList)).stdout);
  assert.deepEqual(rows[0].statusCheckRollup, []);
  assert.equal(rows[0].reviewDecision, undefined);
  assert.equal(rows[0].mergeable, undefined);
  assert.equal((await fixture.readLedger()).pullRequests.length, 1);
  assert.deepEqual((await fixture.readLedger()).calls[1].args, explicit);
});

test('explicit-branch PR reads reject altered argv before ledger effects', async (context) => {
  const fixture = await own(context);
  for (const args of [
    [...panelChecks, '--'],
    [...panelChecks, '--', ''],
    [...panelChecks, '--', 'task/example', '--web'],
    [...panelChecks, 'task/example'],
    [...panelChecks, '--', 'bad\nbranch'],
    [
      ...panelChecks.map((arg) => (arg === 'fixture/project' ? 'another/repo' : arg)),
      '--',
      'task/example',
    ],
    [
      'pr',
      'view',
      'task/example',
      '--repo',
      'fixture/project',
      '--json',
      'number,url,statusCheckRollup',
    ],
  ])
    await assert.rejects(invoke(fixture, args), { code: 2 });
  assert.deepEqual((await fixture.readLedger()).calls, []);
  assert.deepEqual((await fixture.readLedger()).pullRequests, []);
});

async function waitForClaims(fixture, count) {
  await new Promise((resolve, reject) => {
    const watcher = watch(fixture.directory, () => inspect());
    const timer = setTimeout(
      () => finish(new Error('Owned children did not claim the fixture')),
      2500,
    );
    let done = false;
    function finish(error) {
      if (done) return;
      done = true;
      watcher.close();
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    }
    function inspect() {
      readdir(fixture.directory).then((names) => {
        if (names.filter((name) => /^claim\.[0-9a-f-]{36}$/.test(name)).length === count) finish();
      }, finish);
    }
    inspect();
  });
}

test('concurrent panel and check invocations serialize once each with a complete atomic ledger', async (context) => {
  const fixture = await own(context);
  const lock = join(fixture.directory, 'active.lock');
  await writeFile(lock, 'test-owned-lock', { flag: 'wx' });
  const pending = [panelList, commitChecks, panelList, commitChecks].map((args) =>
    invoke(fixture, args),
  );
  const settled = Promise.allSettled(pending);
  try {
    await waitForClaims(fixture, 4);
    assert.equal((await fixture.readEvidence()).activeClaims, 4);
    await assert.rejects(fixture.setFailureModes({ authFailure: true }), /Await owned child/);
    await assert.rejects(fixture.close(), /Await owned child/);
    await unlink(lock);
    for (const result of await settled) {
      assert.equal(result.status, 'fulfilled');
      assert.deepEqual(JSON.parse(result.value.stdout), []);
    }
    const ledger = await fixture.readLedger();
    assert.equal(ledger.calls.length, 4);
    assert.equal(ledger.calls.filter((call) => call.outcome === 'success').length, 4);
    assert.deepEqual(ledger.pullRequests, []);
    const evidence = await fixture.readEvidence();
    assert.equal(evidence.activeClaims, 0);
    assert.equal(evidence.errors, 0);
    assert.equal(evidence.records.length, 4);
    assert.ok(
      evidence.records.every(
        (record) => record.outcome === 'success' && record.stage === 'complete',
      ),
    );
  } finally {
    await unlink(lock).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await settled;
  }
});

test('a queued claim alone blocks reconfiguration and cleanup until its child exits', async (context) => {
  const fixture = await own(context);
  const lock = join(fixture.directory, 'active.lock');
  await writeFile(lock, 'test-owned-lock', { flag: 'wx' });
  const pending = invoke(fixture, panelList);
  pending.catch(() => {}); // Observe setup-failure rejection; the original promise is still awaited.
  try {
    await waitForClaims(fixture, 1);
    assert.equal(pending.child.kill('SIGSTOP'), true);
    await unlink(lock);
    await assert.rejects(fixture.setCurrentBranch('task/changed'), /Await owned child/);
    await assert.rejects(fixture.close(), /Await owned child/);
    assert.equal((await fixture.readEvidence()).activeClaims, 1);
    assert.equal(pending.child.kill('SIGCONT'), true);
    assert.deepEqual(JSON.parse((await pending).stdout), []);
    await waitForClaims(fixture, 0);
  } finally {
    pending.child.kill('SIGCONT');
    await unlink(lock).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    await pending.catch(() => {});
  }
});

test('held locks reach the bounded deadline without releasing foreign ownership or claiming effects', async (context) => {
  const fixture = await own(context);
  const lock = join(fixture.directory, 'active.lock');
  await writeFile(lock, 'test-owned-lock', { flag: 'wx' });
  try {
    await assert.rejects(invoke(fixture, create), { code: 2 });
    assert.equal(await readFile(lock, 'utf8'), 'test-owned-lock');
    assert.deepEqual((await fixture.readLedger()).calls, []);
    const evidence = await fixture.readEvidence();
    assert.equal(evidence.activeClaims, 0);
    assert.equal(evidence.records.length, 1);
    assert.equal(evidence.records[0].outcome, 'lock_timeout');
    assert.equal(evidence.records[0].stage, 'waiting');
    assert.ok(evidence.records[0].waitMs >= 1000);
  } finally {
    await unlink(lock);
  }
});

test('concurrent duplicate creates preserve one effect and report the real second command rejection', async (context) => {
  const fixture = await own(context);
  const results = await Promise.allSettled([invoke(fixture, create), invoke(fixture, create)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason.code, 1);
  const ledger = await fixture.readLedger();
  assert.equal(ledger.pullRequests.length, 1);
  assert.equal(ledger.calls.length, 2);
  const evidence = await fixture.readEvidence();
  assert.deepEqual(evidence.records.map((record) => record.outcome).sort(), [
    'command_error',
    'success',
  ]);
});

test('dispatch filesystem failures retain safe stage receipts without raw errors or leaked claims', async (context) => {
  const fixture = await own(context);
  const ledger = join(fixture.directory, 'ledger.json');
  await unlink(ledger);
  await mkdir(ledger);
  try {
    await assert.rejects(invoke(fixture, panelList), { code: 2 });
    const evidence = await fixture.readEvidence();
    assert.equal(evidence.activeClaims, 0);
    assert.equal(evidence.records[0].stage, 'ledger_read');
    assert.equal(evidence.records[0].outcome, 'fixture_error');
    await assert.rejects(access(join(fixture.directory, 'active.lock')), { code: 'ENOENT' });
    assert.equal(JSON.stringify(evidence).includes(fixture.directory), false);
  } finally {
    await rm(ledger, { recursive: true });
  }
});

test('evidence reads allowlist fields, bound record count and expose malformed receipts honestly', async (context) => {
  const fixture = await own(context);
  const safe = {
    version: 1,
    kind: 'panel-list',
    stage: 'complete',
    outcome: 'success',
    startedAtMs: 1,
    waitMs: 0,
    lockBudgetMs: 1000,
    private: 'must-not-export',
  };
  await writeFile(join(fixture.directory, `receipt.${randomUUID()}.json`), JSON.stringify(safe));
  let evidence = await fixture.readEvidence();
  assert.equal(JSON.stringify(evidence).includes('must-not-export'), false);
  await writeFile(join(fixture.directory, `receipt.${randomUUID()}.json`), 'not JSON');
  await writeFile(join(fixture.directory, `receipt.${randomUUID()}.json`), 'x'.repeat(2049));
  evidence = await fixture.readEvidence();
  assert.equal(evidence.errors, 2);
  await Promise.all(
    Array.from({ length: 513 }, () =>
      writeFile(join(fixture.directory, `receipt.${randomUUID()}.json`), JSON.stringify(safe)),
    ),
  );
  evidence = await fixture.readEvidence();
  assert.equal(evidence.truncated, true);
  assert.ok(evidence.records.length <= 512);
});

test('the active claim protects final receipt persistence before parent cleanup is allowed', async (context) => {
  const fixture = await own(context);
  const release = join(fixture.directory, 'receipt-release');
  const preload = join(fixture.directory, 'receipt-barrier.cjs');
  await writeFile(
    preload,
    `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const { performance } = require('node:perf_hooks');
const rename = fs.renameSync;
fs.renameSync = (from, to) => {
  if (/receipt\\.[0-9a-f-]{36}\\.json$/.test(to) && JSON.parse(fs.readFileSync(from, 'utf8')).outcome !== 'running') {
    process.send('final-receipt-waiting');
    const deadline = performance.now() + 2500;
    while (!fs.existsSync(process.env.RECEIPT_RELEASE)) {
      if (performance.now() >= deadline) throw new Error('Owned receipt barrier expired');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
    process.disconnect();
  }
  return rename(from, to);
};
syncBuiltinESMExports();
`,
  );
  const child = spawn(process.execPath, ['--require', preload, fixture.executable, ...panelList], {
    env: { PATH: dirname(process.execPath), ...fixture.env, RECEIPT_RELEASE: release },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    timeout: 5000,
  });
  const exited = once(child, 'exit');
  exited.catch(() => {});
  try {
    const [message] = await Promise.race([
      once(child, 'message'),
      exited.then(() => {
        throw new Error('Owned child exited before receipt barrier');
      }),
    ]);
    assert.equal(message, 'final-receipt-waiting');
    assert.equal((await fixture.readEvidence()).activeClaims, 1);
    await assert.rejects(fixture.close(), /Await owned child/);
    await assert.rejects(fixture.setFailureModes({ authFailure: true }), /Await owned child/);
    await writeFile(release, 'release');
    const [code] = await exited;
    assert.equal(code, 0);
    const evidence = await fixture.readEvidence();
    assert.equal(evidence.activeClaims, 0);
    assert.equal(evidence.records.length, 1);
    assert.equal(evidence.records[0].outcome, 'success');
    assert.equal(evidence.records[0].stage, 'complete');
    await fixture.close();
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      await writeFile(release, 'release');
      child.kill('SIGTERM');
    }
    await exited;
  }
});

async function snapshotFixtureFiles(fixture) {
  const names = (await readdir(fixture.directory)).sort();
  return {
    names,
    contents: await Promise.all(names.map((name) => readFile(join(fixture.directory, name)))),
  };
}

async function assertUnchangedFixtureFiles(fixture, before) {
  const after = await snapshotFixtureFiles(fixture);
  assert.deepEqual(after.names, before.names);
  assert.ok(after.contents.every((contents, index) => contents.equals(before.contents[index])));
  assert.deepEqual((await fixture.readLedger()).calls, []);
  const evidence = await fixture.readEvidence();
  assert.equal(evidence.activeClaims, 0);
  assert.equal(evidence.records.length, 0);
  assert.equal(evidence.errors, 0);
}

test('invalid configuration fails before claims without any ledger, receipt or file effect', async (context) => {
  const fixture = await own(context);
  await writeFile(join(fixture.directory, 'config.json'), 'not valid fixture JSON');
  const before = await snapshotFixtureFiles(fixture);
  await assert.rejects(invoke(fixture, panelList), { code: 2 });
  await assertUnchangedFixtureFiles(fixture, before);
});

test('invalid arguments fail before claims even while another owner holds the lock', async (context) => {
  const fixture = await own(context);
  const lock = join(fixture.directory, 'active.lock');
  await writeFile(lock, 'test-owned-lock', { flag: 'wx' });
  try {
    const before = await snapshotFixtureFiles(fixture);
    await assert.rejects(invoke(fixture, [...panelList, '--unexpected']), { code: 2 });
    await assertUnchangedFixtureFiles(fixture, before);
  } finally {
    await unlink(lock);
  }
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`queued ${signal} cancels before dispatch, cleans only its claim and preserves foreign ownership`, async (context) => {
    const fixture = await own(context);
    const lock = join(fixture.directory, 'active.lock');
    await writeFile(lock, 'test-owned-lock', { flag: 'wx' });
    const pending = invoke(fixture, create);
    pending.catch(() => {});
    try {
      await waitForClaims(fixture, 1);
      assert.equal(pending.child.kill(signal), true);
      await assert.rejects(pending, { code: 2, signal: null });
      assert.equal(await readFile(lock, 'utf8'), 'test-owned-lock');
      const ledger = await fixture.readLedger();
      assert.deepEqual(ledger.calls, []);
      assert.deepEqual(ledger.pullRequests, []);
      const evidence = await fixture.readEvidence();
      assert.equal(evidence.activeClaims, 0);
      assert.equal(evidence.errors, 0);
      assert.equal(evidence.records.length, 1);
      assert.equal(evidence.records[0].stage, 'waiting');
      assert.equal(evidence.records[0].outcome, 'cancelled');
    } finally {
      await pending.catch(() => {});
      await unlink(lock);
    }
  });
}
