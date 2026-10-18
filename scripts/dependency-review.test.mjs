import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import { readComparison, verifyNegativeControl } from './dependency-review.mjs';
import * as guard from './dependency-review.mjs';

const { Response, AbortSignal, DOMException } = globalThis;

const base = '1'.repeat(40);
const head = '2'.repeat(40);
const options = { repository: 'fixture/repository', base, head, token: 'fixture-only-token' };
const response = (data, headers = {}, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
const warning = (value) => Buffer.from(value).toString('base64');
const expected = [
  {
    name: 'vitest',
    version: '2.1.9',
    scope: 'development',
    ghsa: 'GHSA-5xrq-8626-4rwp',
    severity: 'critical',
  },
  {
    name: 'next',
    version: '15.5.15',
    scope: 'runtime',
    ghsa: 'GHSA-p293-qw3h-jr36',
    severity: 'critical',
  },
];
const changes = expected.map((item) => ({
  change_type: 'added',
  manifest: 'pnpm-lock.yaml',
  ecosystem: 'npm',
  name: item.name,
  version: item.version,
  package_url: `pkg:npm/${item.name}@${item.version}`,
  license: 'MIT',
  source_repository_url: null,
  scope: item.scope,
  vulnerabilities: [
    {
      advisory_ghsa_id: item.ghsa,
      severity: item.severity,
      advisory_summary: 'Synthetic fixture advisory',
      advisory_url: `https://github.com/advisories/${item.ghsa}`,
    },
  ],
}));

test('complete empty comparison is valid and binds immutable refs without exposing token', async () => {
  const result = await readComparison({
    ...options,
    fetchImpl: async (url, init) => {
      assert.equal(url.origin, 'https://api.github.com');
      assert.ok(url.pathname.endsWith(`${base}...${head}`));
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
      assert.equal(init.headers.Authorization, 'Bearer fixture-only-token');
      return response([], { 'x-github-request-id': 'request-1' });
    },
  });
  assert.equal(result.base, base);
  assert.equal(result.head, head);
  assert.equal(result.pages, 1);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.requestIds, ['request-1']);
  assert.ok(!JSON.stringify(result).includes(options.token));
});

test('every page is collected and checked for warnings', async () => {
  let calls = 0;
  const result = await readComparison({
    ...options,
    fetchImpl: async (url) => {
      calls++;
      return calls === 1
        ? response([changes[0]], {
            link: `<${url.origin}${url.pathname}?per_page=100&page=2>; rel="next"`,
          })
        : response([changes[1]]);
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.changes, changes);
});

for (const value of ['snapshot not ready', '[]']) {
  test(`snapshot warning is not a clean analysis: ${value}`, async () => {
    await assert.rejects(
      readComparison({
        ...options,
        fetchImpl: async () =>
          response([], { 'x-github-dependency-graph-snapshot-warnings': warning(value) }),
      }),
      /snapshot warning/,
    );
  });
}

test('a warning on a later page blocks partial results', async () => {
  let calls = 0;
  await assert.rejects(
    readComparison({
      ...options,
      fetchImpl: async (url) =>
        ++calls === 1
          ? response(changes, {
              link: `<${url.origin}${url.pathname}?per_page=100&page=2>; rel="next"`,
            })
          : response([], { 'x-github-dependency-graph-snapshot-warnings': warning('incomplete') }),
    }),
    /snapshot warning/,
  );
});

test('empty/whitespace warnings contain no warning; malformed encoding is rejected', async () => {
  for (const value of ['', ' ', warning(' \n')]) {
    await readComparison({
      ...options,
      fetchImpl: async () => response([], { 'x-github-dependency-graph-snapshot-warnings': value }),
    });
  }
  await assert.rejects(
    readComparison({
      ...options,
      fetchImpl: async () =>
        response([], { 'x-github-dependency-graph-snapshot-warnings': '!invalid' }),
    }),
    /malformed snapshot warning/,
  );
});

for (const status of [401, 403, 429, 500]) {
  test(`HTTP ${status} cannot qualify as an empty scan`, async () => {
    await assert.rejects(
      readComparison({ ...options, fetchImpl: async () => response([], {}, status) }),
      new RegExp(`HTTP ${status}`),
    );
  });
}

test('invalid data and transport failures do not qualify', async () => {
  for (const data of [null, {}, [null], ['invalid'], [[]]]) {
    await assert.rejects(
      readComparison({ ...options, fetchImpl: async () => response(data) }),
      /invalid comparison data/,
    );
  }
  await assert.rejects(
    readComparison({ ...options, fetchImpl: async () => new Response('not JSON') }),
    /invalid JSON/,
  );
  await assert.rejects(
    readComparison({
      ...options,
      fetchImpl: async () => {
        throw new DOMException('Fixture timeout', 'TimeoutError');
      },
    }),
    /Fixture timeout/,
  );
});

test('pagination cannot forward credentials, change revisions, or repeat a page', async () => {
  for (const next of [
    'https://attacker.invalid/stolen?page=2&per_page=100',
    'https://api.github.com/other?page=2&per_page=100',
    `https://api.github.com/repos/fixture/repository/dependency-graph/compare/${base}...${head}?page=1&per_page=100`,
  ]) {
    let calls = 0;
    await assert.rejects(
      readComparison({
        ...options,
        fetchImpl: async () => {
          calls++;
          return response([], { link: `<${next}>; rel="next"` });
        },
      }),
      /unexpected pagination target/,
    );
    assert.equal(calls, 1);
  }
});

test('mutable refs and malformed repository are rejected before network access', async () => {
  for (const input of [
    { base: 'staging' },
    { head: head + '\n' },
    { repository: '../other/repo' },
  ]) {
    await assert.rejects(
      readComparison({
        ...options,
        ...input,
        fetchImpl: async () => {
          assert.fail('Unexpected network access');
        },
      }),
      /Dependency review incomplete/,
    );
  }
});

test('negative control requires exact vendor and complete raw data, including dev scope', () => {
  const valid = {
    outcome: 'failure',
    vendorChanges: JSON.stringify(changes),
    comparison: { changes },
    expected,
  };
  verifyNegativeControl(valid);
  for (const input of [
    { outcome: 'success' },
    { vendorChanges: '' },
    { vendorChanges: '{}' },
    { vendorChanges: '[]' },
    { comparison: { changes: [] } },
    { expected: [] },
    { vendorChanges: JSON.stringify(changes.slice(1)) },
    { expected: [{ ...expected[0], scope: 'runtime' }] },
    { expected: [{ ...expected[0], ghsa: 'GHSA-not-the-advisory' }] },
    { expected: [{ ...expected[0], severity: 'high' }] },
  ]) {
    assert.throws(
      () => verifyNegativeControl({ ...valid, ...input }),
      /Dependency review incomplete/,
    );
  }
});

test('truncated, noncanonical and invalid UTF-8 warning encodings fail closed', async () => {
  for (const value of ['A', 'AA', '=', '====', 'AA=', 'AB==', '/w==']) {
    await assert.rejects(
      readComparison({
        ...options,
        fetchImpl: async () =>
          response([], { 'x-github-dependency-graph-snapshot-warnings': value }),
      }),
      /malformed snapshot warning/,
    );
  }
});

test('valid unquoted relation and a comma inside a quoted title preserve pagination', async () => {
  let calls = 0;
  const result = await readComparison({
    ...options,
    fetchImpl: async (url) =>
      ++calls === 1
        ? response([changes[0]], {
            link: `<${url.origin}${url.pathname}?per_page=100&page=2>; title="page, two"; rel=next`,
          })
        : response([changes[1]]),
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.changes, changes);
});

test('malformed, ambiguous or conflicting pagination never qualifies a partial inventory', async () => {
  const path = `${'https://api.github.com'}/repos/${options.repository}/dependency-graph/compare/${base}...${head}`;
  for (const link of [
    'not a link',
    `<${path}?page=2&per_page=100>; rel=next; rel=last`,
    `<${path}?page=2&per_page=100>; rel=next, <${path}?page=2&per_page=100>; rel="next"`,
    `<${path}?page=2&page=3&per_page=100>; rel="next"`,
    `<${path}?page=2&per_page=100&per_page=100>; rel="next"`,
    `<${path}?page=2&per_page=100>; rel="next`,
    `<${path}?page=2&per_page=100>; rel=""`,
    `<${path}?page=2&per_page=100>; rel=next,`,
    `<${path}?page=3&per_page=100>; rel=last`,
  ]) {
    let calls = 0;
    await assert.rejects(
      readComparison({
        ...options,
        fetchImpl: async () => {
          calls++;
          return response([], { link });
        },
      }),
      /Dependency review incomplete/,
    );
    assert.equal(calls, 1);
  }
});

test('vendor inventory equality binds all parsed changes, defaults and duplicate counts', () => {
  const valid = {
    outcome: 'success',
    vendorChanges: JSON.stringify(changes),
    comparison: { changes },
  };
  guard.verifyVendorInventory(valid);
  guard.verifyVendorInventory({ ...valid, vendorChanges: JSON.stringify([...changes].reverse()) });
  guard.verifyVendorInventory({
    outcome: 'success',
    vendorChanges: '[]',
    comparison: { changes: [] },
  });
  const raw = {
    ...changes[0],
    extra_api_field: 'not part of the pinned vendor schema',
    vulnerabilities: [{ ...changes[0].vulnerabilities[0], severity: undefined }],
  };
  const normalized = {
    ...changes[0],
    vulnerabilities: [{ ...changes[0].vulnerabilities[0], severity: 'low' }],
  };
  guard.verifyVendorInventory({
    ...valid,
    comparison: { changes: [raw] },
    vendorChanges: JSON.stringify([normalized]),
  });
  const noAdvisories = { ...changes[0], vulnerabilities: undefined };
  guard.verifyVendorInventory({
    ...valid,
    comparison: { changes: [noAdvisories] },
    vendorChanges: JSON.stringify([{ ...noAdvisories, vulnerabilities: [] }]),
  });
  for (const input of [
    { outcome: 'failure' },
    { outcome: 'skipped' },
    { vendorChanges: '' },
    { vendorChanges: '{}' },
    { vendorChanges: '[]' },
    { vendorChanges: JSON.stringify(changes.slice(1)) },
    { vendorChanges: JSON.stringify([...changes, changes[0]]) },
    { vendorChanges: JSON.stringify([{ ...changes[0], manifest: 'other-lockfile' }, changes[1]]) },
    { vendorChanges: JSON.stringify([{ ...changes[0], scope: 'runtime' }, changes[1]]) },
    { vendorChanges: JSON.stringify([{ ...changes[0], scope: undefined }, changes[1]]) },
    {
      vendorChanges: JSON.stringify([
        {
          ...changes[0],
          vulnerabilities: [{ ...changes[0].vulnerabilities[0], severity: 'high' }],
        },
        changes[1],
      ]),
    },
    {
      vendorChanges: JSON.stringify([
        {
          ...changes[0],
          vulnerabilities: [
            { ...changes[0].vulnerabilities[0], advisory_ghsa_id: 'GHSA-different' },
          ],
        },
        changes[1],
      ]),
    },
    {
      vendorChanges: JSON.stringify([
        {
          ...changes[0],
          vulnerabilities: [
            { ...changes[0].vulnerabilities[0], advisory_summary: 'changed metadata' },
          ],
        },
        changes[1],
      ]),
    },
    { vendorChanges: JSON.stringify([{ ...changes[0], name: 12 }, changes[1]]) },
    { comparison: { changes: [{ ...changes[0], license: 12 }, changes[1]] } },
  ])
    assert.throws(
      () => guard.verifyVendorInventory({ ...valid, ...input }),
      /Dependency review incomplete/,
    );
  assert.throws(
    () =>
      guard.verifyVendorInventory({
        outcome: 'success',
        vendorChanges: JSON.stringify([normalized]),
        comparison: { changes: [{ ...raw, scope: undefined }] },
      }),
    /inventory mismatch/,
  );
  guard.verifyVendorInventory({ ...valid, outcome: 'failure', expectedOutcome: 'failure' });
});
