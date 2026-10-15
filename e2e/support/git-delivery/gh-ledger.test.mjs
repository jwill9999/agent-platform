import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import process from 'node:process';

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
