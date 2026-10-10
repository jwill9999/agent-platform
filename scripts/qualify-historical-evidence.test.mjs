import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { sha256 } from './classify-historical-evidence.mjs';
import { fixture } from './classify-historical-evidence.test.mjs';
import {
  qualifyHistoricalEvidence,
  guardPromptfooAction,
  PROMPTFOO_BUNDLE_SHA256,
  insertPromptfooResponseGuard,
  prepareFullScanRefs,
  validatePromptfooResponse,
  REPOSITORY,
  validateContext,
  validateReview,
  validateTarget,
} from './qualify-historical-evidence.mjs';

export function context(f, event = 'workflow_dispatch') {
  return {
    repository: REPOSITORY,
    pr: 288,
    base: f.base,
    head: f.head,
    controlSource: f.base,
    event,
    ref: event === 'workflow_dispatch' ? 'refs/heads/staging' : 'refs/pull/288/merge',
    workflowSource: event === 'workflow_dispatch' ? f.base : f.merge,
    runId: event === 'workflow_dispatch' ? '100' : '200',
    runAttempt: '1',
  };
}

test('actual 220-file data-only qualification validates every byte and all 139 JSONs', () => {
  const f = fixture();
  try {
    for (const event of ['workflow_dispatch', 'pull_request']) {
      const receipt = qualifyHistoricalEvidence({
        repo: f.root,
        base: f.base,
        head: f.head,
        context: context(f, event),
      });
      assert.equal(receipt.validation.jsonFiles, 139);
      assert.equal(receipt.validation.files, 220);
      assert.equal(receipt.qualification, 'historical-archive-not-promptfoo-analysis');
      assert.equal(receipt.controls['.github/workflows/promptfoo-code-scan.yml'].blob.length, 40);
    }
  } finally {
    f.cleanup();
  }
});

test('wrong event/ref/repository/source and malformed review cannot qualify archive', () => {
  const f = fixture();
  try {
    for (const patch of [
      { repository: 'evil/repository' },
      { event: 'pull_request_target' },
      { ref: 'refs/heads/policy-candidate' },
      { workflowSource: f.head },
      { controlSource: f.head },
      { runId: '1junk' },
      { head: 'a'.repeat(40) },
    ])
      assert.throws(() => validateContext({ ...context(f), ...patch }, f.base, f.head));
    for (const patch of [
      { verdict: 'pending' },
      { allowlistSha256: 'a'.repeat(64) },
      { files: 219 },
      { evidenceSha256: 'wrong' },
      { limits: [] },
    ])
      assert.throws(() => validateReview({ ...f.review, ...patch }, f.review.allowlistSha256));
    assert.throws(() => validateReview(null, f.review.allowlistSha256));
    const pr = {
      state: 'open',
      number: 288,
      base: { ref: 'staging', sha: f.base, repo: { full_name: REPOSITORY } },
      head: { sha: f.head, repo: { full_name: REPOSITORY } },
    };
    validateTarget(pr, f.head, f.base);
    assert.throws(() => validateTarget(pr, f.base, f.base));
    assert.throws(() =>
      validateTarget(
        { ...pr, head: { ...pr.head, repo: { full_name: 'fork/evil' } } },
        f.head,
        f.base,
      ),
    );
    assert.throws(
      () =>
        qualifyHistoricalEvidence({
          repo: f.root,
          base: f.base,
          head: f.base,
          context: { ...context(f), head: f.base },
        }),
      /Not eligible/,
    );
  } finally {
    f.cleanup();
  }
});

test('invalid JSON and high-confidence credential signatures block otherwise exact Git-object archives', () => {
  for (const mutate of [
    (contents, paths) => {
      contents[paths.findIndex((p) => p.endsWith('.json'))] = Buffer.from('{invalid-json');
    },
    (contents, paths) => {
      contents[paths.findIndex((p) => p.endsWith('.txt'))] = Buffer.from(`ghp_${'A'.repeat(36)}\n`);
    },
  ]) {
    const f = fixture(mutate);
    try {
      assert.throws(() =>
        qualifyHistoricalEvidence({
          repo: f.root,
          base: f.base,
          head: f.head,
          context: context(f),
        }),
      );
    } finally {
      f.cleanup();
    }
  }
});

test('automatic qualification rejects merge-workflow and wrong merge-parent provenance', () => {
  const f = fixture();
  try {
    assert.throws(
      () =>
        qualifyHistoricalEvidence({
          repo: f.root,
          base: f.base,
          head: f.head,
          context: { ...context(f, 'pull_request'), workflowSource: f.head },
        }),
      /merge source/,
    );
  } finally {
    f.cleanup();
  }
});

test('missing independent review does not become a successful archive fallback', () => {
  const f = fixture(undefined, { omitReview: true });
  try {
    assert.throws(
      () =>
        qualifyHistoricalEvidence({
          repo: f.root,
          base: f.base,
          head: f.head,
          context: context(f),
        }),
      /review receipt missing/,
    );
  } finally {
    f.cleanup();
  }
});

test('raw pinned response guard rejects no-analysis and mixed skips before SARIF/comments', () => {
  const noAnalysis = { success: true, comments: [], review: 'No files to scan' };
  // This is the real pinned-action SARIF shape; a one-run array was insufficient.
  const sarif = {
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'Promptfoo Code Scan', rules: [] } },
        results: [],
        properties: { promptfoo: { review: noAnalysis.review } },
      },
    ],
  };
  assert.equal(sarif.runs.length, 1);
  assert.throws(() => validatePromptfooResponse(noAnalysis));
  for (const response of [
    { success: false, comments: [] },
    { success: true, comments: [], skipReason: 'Fork PR scanning not authorized' },
    {
      success: true,
      comments: [{ finding: 'real finding', file: 'src/a.ts', line: 1, severity: 'high' }],
      skipReason: 'partial authorization skip',
    },
    { success: true, comments: [], review: 'Mock scan completed' },
    { success: true, comments: [], review: 'Setup failed' },
    { success: true, comments: [], review: 'Authentication failed' },
  ])
    assert.throws(() => validatePromptfooResponse(response));
  validatePromptfooResponse({ success: true, comments: [], review: 'No vulnerabilities found' });
  validatePromptfooResponse({ success: true, comments: [{ finding: 'Actual issue' }] });

  // Exact function anchors from 148e01f35bc65bd992b9f44679577aa9123be6ab.
  const excerpt = `async function handleScanResponse(scanResponse, inputs, context3) { return {published: true}; }\nfunction createMockScanResponse() { return {success: true}; }`;
  const patched = insertPromptfooResponseGuard(excerpt);
  const exposed = runInNewContext(
    `${patched.bundle};({handleScanResponse,createMockScanResponse})`,
  );
  return (async () => {
    await assert.rejects(() => exposed.handleScanResponse(noAnalysis));
    await assert.rejects(() =>
      exposed.handleScanResponse({
        success: true,
        comments: [{ finding: 'issue' }],
        skipReason: 'skip',
      }),
    );
    assert.equal(
      (await exposed.handleScanResponse({ success: true, comments: [] })).published,
      true,
    );
    assert.throws(() => exposed.createMockScanResponse());
    assert.throws(() => guardPromptfooAction(excerpt), /digest mismatch/);
    assert.throws(() => insertPromptfooResponseGuard('unknown vendor body'), /anchor/);
    assert.throws(() => insertPromptfooResponseGuard(excerpt + excerpt), /anchor/);
    const root = dirname(dirname(fileURLToPath(import.meta.url)));
    const workflow = readFileSync(
      join(root, '.github/workflows/promptfoo-code-scan.yml'),
      'utf8',
    ).replace(/\s/g, '');
    for (const fn of [
      validatePromptfooResponse,
      insertPromptfooResponseGuard,
      guardPromptfooAction,
    ])
      assert.ok(
        workflow.includes(fn.toString().replace(/\s/g, '')),
        'bootstrap workflow guard must match the tested predicate',
      );
  })();
});

test('detached data checkout with only origin/staging gets exact local base for vendor CLI', () => {
  const root = mkdtempSync(join(tmpdir(), 'detached-full-scan-'));
  const run = (...args) =>
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', root, ...args], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_AUTHOR_NAME: 'scan-fixture',
        GIT_AUTHOR_EMAIL: 'scan@example.invalid',
        GIT_COMMITTER_NAME: 'scan-fixture',
        GIT_COMMITTER_EMAIL: 'scan@example.invalid',
      },
    }).trim();
  try {
    run('init', '-q');
    writeFileSync(join(root, 'sample.ts'), 'export const value = 1;\n');
    run('add', '.');
    run('commit', '-qm', 'base');
    const base = run('rev-parse', 'HEAD');
    run('update-ref', 'refs/remotes/origin/staging', base);
    writeFileSync(join(root, 'sample.ts'), 'export const value = 2;\n');
    run('add', '.');
    run('commit', '-qm', 'small authored code');
    const head = run('rev-parse', 'HEAD');
    run('checkout', '--detach', '-q', head);
    assert.throws(() => run('rev-parse', '--verify', 'staging'));
    prepareFullScanRefs(root, base, head);
    assert.equal(run('rev-parse', 'staging'), base);
    assert.equal(run('rev-parse', 'HEAD'), head);
    assert.match(run('diff', 'staging...HEAD', '--', 'sample.ts'), /export const value = 2/);
    assert.throws(() => prepareFullScanRefs(root, base, base), /head/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('workflow reads pinned-size vendor Git blob above default buffer without truncation', () => {
  const root = mkdtempSync(join(tmpdir(), 'large-vendor-git-read-'));
  // CI uses deterministic equal-sized inert data. The connected qualification
  // supplies the exact independently hash-checked pinned vendor bundle as data.
  const actualFixture = process.env.PROMPTFOO_PINNED_BUNDLE_FIXTURE;
  const bytes = actualFixture ? readFileSync(actualFixture) : Buffer.alloc(1_856_068, 32);
  assert.equal(bytes.length, 1_856_068);
  if (actualFixture) assert.equal(sha256(bytes), PROMPTFOO_BUNDLE_SHA256);
  const env = {
    PATH: process.env.PATH,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'large-vendor-fixture',
    GIT_AUTHOR_EMAIL: 'vendor@example.invalid',
    GIT_COMMITTER_NAME: 'large-vendor-fixture',
    GIT_COMMITTER_EMAIL: 'vendor@example.invalid',
  };
  const run = (...args) =>
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', root, ...args], { env });
  try {
    run('init', '-q');
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist/index.js'), bytes);
    run('add', '.');
    run('commit', '-qm', 'nonexecuted vendor blob data');
    assert.throws(
      () => execFileSync('git', ['-C', root, 'show', 'HEAD:dist/index.js']),
      (error) => error.code === 'ENOBUFS',
    );
    const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
    const workflow = readFileSync(
      join(sourceRoot, '.github/workflows/promptfoo-code-scan.yml'),
      'utf8',
    );
    const expression = /^\s*const committed = (execFileSync\([^\n]+\));$/m.exec(workflow)?.[1];
    assert.ok(expression, 'Execute the actual production workflow Git read expression');
    const committed = runInNewContext(expression, {
      execFileSync,
      process: { env: { ACTION_ROOT: root } },
    });
    assert.ok(Buffer.isBuffer(committed));
    assert.ok(committed.equals(bytes));
    if (actualFixture)
      assert.equal(
        guardPromptfooAction(committed.toString('utf8')).originalSha256,
        PROMPTFOO_BUNDLE_SHA256,
      );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
