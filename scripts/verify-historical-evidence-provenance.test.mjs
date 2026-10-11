import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { fixture } from './classify-historical-evidence.test.mjs';
import { qualifyHistoricalEvidence, REPOSITORY } from './qualify-historical-evidence.mjs';
import {
  decodeReceiptZip,
  loadProtectedHelpers,
  revalidateFinalProof,
  verifyHistoricalEvidenceProvenance,
} from './verify-historical-evidence-provenance.mjs';

function context(f, event = 'workflow_dispatch') {
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

test('receipt ZIP is decoded as bounded single regular JSON data, never extracted or executed', () => {
  const zip = (name, mode = 0o100644, body = '{"fixture":true}', extra = false) =>
    execFileSync(
      'python3',
      [
        '-I',
        '-c',
        "import io,json,sys,zipfile\nv=json.loads(sys.stdin.read())\nb=io.BytesIO()\nz=zipfile.ZipFile(b,'w',compression=zipfile.ZIP_DEFLATED)\ne=zipfile.ZipInfo(v['name']);e.external_attr=v['mode']<<16;z.writestr(e,v['body'])\nif v['extra']:z.writestr('other.json','{}')\nz.close();sys.stdout.buffer.write(b.getvalue())",
      ],
      { input: JSON.stringify({ name, mode, body, extra }) },
    );
  assert.deepEqual(decodeReceiptZip(zip('archive-qualification.json')), { fixture: true });
  assert.throws(() => decodeReceiptZip(zip('../archive-qualification.json')));
  assert.throws(() => decodeReceiptZip(zip('archive-qualification.json', 0o120777, '/etc/passwd')));
  assert.throws(() => decodeReceiptZip(zip('archive-qualification.json', 0o100644, '{}', true)));
  assert.throws(() =>
    decodeReceiptZip(zip('archive-qualification.json', 0o100644, ' '.repeat(65537))),
  );
  assert.throws(() => decodeReceiptZip(zip('archive-qualification.json', 0o100644, 'not-json')));
});

test('trusted merge proof independently recomputes automatic and protected-dispatch receipts', async () => {
  const f = fixture();
  try {
    const input = {
      repo: f.root,
      localRoot: f.root,
      protectedTip: f.base,
      adoptionCommit: f.base,
      pr: {
        state: 'open',
        number: 288,
        base: { ref: 'staging', sha: f.base, repo: { full_name: REPOSITORY } },
        head: { sha: f.head, repo: { full_name: REPOSITORY } },
      },
      automaticRun: {
        id: 200,
        run_attempt: 1,
        event: 'pull_request',
        status: 'completed',
        conclusion: 'success',
        repository: { full_name: REPOSITORY },
        head_repository: { full_name: REPOSITORY },
        path: '.github/workflows/promptfoo-code-scan.yml',
        head_sha: f.head,
        pull_requests: [{ number: 288 }],
      },
      automaticJobs: [
        { run_id: 200, name: 'security-scan', status: 'completed', conclusion: 'success' },
      ],
      dispatchRun: {
        id: 100,
        run_attempt: 1,
        event: 'workflow_dispatch',
        status: 'completed',
        conclusion: 'success',
        repository: { full_name: REPOSITORY },
        head_repository: { full_name: REPOSITORY },
        path: '.github/workflows/promptfoo-code-scan.yml',
        head_sha: f.base,
        head_branch: 'staging',
      },
      dispatchJobs: [
        { run_id: 100, name: 'archive-provenance', status: 'completed', conclusion: 'success' },
      ],
      automaticReceipt: qualifyHistoricalEvidence({
        repo: f.root,
        base: f.base,
        head: f.head,
        context: context(f, 'pull_request'),
      }),
      dispatchReceipt: qualifyHistoricalEvidence({
        repo: f.root,
        base: f.base,
        head: f.head,
        context: context(f),
      }),
    };
    assert.equal((await verifyHistoricalEvidenceProvenance(input)).verified, true);
    for (const mutate of [
      (x) => (x.dispatchRun.event = 'pull_request'),
      (x) => (x.dispatchRun.head_branch = 'candidate'),
      (x) => (x.dispatchRun.head_sha = f.head),
      (x) => (x.automaticRun.head_sha = f.base),
      (x) => (x.automaticRun.repository.full_name = 'evil/repo'),
      (x) => (x.automaticRun.pull_requests = []),
      (x) => (x.automaticJobs[0].conclusion = 'skipped'),
      (x) => (x.dispatchJobs[0].run_id = 200),
      (x) => (x.dispatchReceipt.head = f.base),
      (x) => (x.dispatchReceipt = null),
      (x) => (x.dispatchReceipt.validation.jsonFiles = 0),
      (x) =>
        (x.dispatchReceipt.controls['.github/workflows/promptfoo-code-scan.yml'].blob = 'a'.repeat(
          40,
        )),
      (x) => (x.dispatchReceipt.runAttempt = '2'),
      (x) => (x.automaticReceipt.workflowSource = f.head),
    ]) {
      const forged = structuredClone(input);
      mutate(forged);
      await assert.rejects(() => verifyHistoricalEvidenceProvenance(forged));
    }
    const read = async (path) =>
      path.startsWith('pulls/')
        ? structuredClone(input.pr)
        : path === 'git/ref/heads/staging'
          ? { object: { sha: f.base } }
          : structuredClone(path.endsWith('/200') ? input.automaticRun : input.dispatchRun);
    const enumerate = async (path, key) =>
      key === 'workflow_runs'
        ? [structuredClone(input.automaticRun)]
        : structuredClone(path.includes('/200/') ? input.automaticJobs : input.dispatchJobs);
    await revalidateFinalProof({ ...input, read, enumerate });
    // These snapshots represent reruns started AFTER initial metadata/artifact
    // retrieval, including the later final-fence network reads.
    for (const mutate of [
      (r) => {
        r.run_attempt++;
        r.status = 'queued';
        r.conclusion = null;
      },
      (r) => {
        r.status = 'in_progress';
        r.conclusion = null;
      },
      (r) => {
        r.conclusion = 'failure';
      },
      (r) => {
        r.head_sha = r.head_sha === f.base ? f.head : f.base;
      },
    ]) {
      for (const id of [200, 100]) {
        let reads = 0;
        await assert.rejects(() =>
          revalidateFinalProof({
            ...input,
            enumerate,
            read: async (path) => {
              const result = await read(path);
              if (path === `actions/runs/${id}` && ++reads === 2) mutate(result);
              return result;
            },
          }),
        );
      }
    }
    await assert.rejects(() =>
      revalidateFinalProof({
        ...input,
        read,
        enumerate: async (path, key) =>
          key === 'workflow_runs' ? [{ ...input.automaticRun, id: 201 }] : enumerate(path, key),
      }),
    );
    await assert.rejects(() =>
      revalidateFinalProof({
        ...input,
        read,
        enumerate: async (path, key) =>
          key === 'workflow_runs'
            ? [{ ...input.automaticRun, run_attempt: 2 }]
            : enumerate(path, key),
      }),
    );
  } finally {
    f.cleanup();
  }
});

test('builtin bootstrap rejects adjacent substituted helpers before any code executes', async () => {
  const f = fixture();
  try {
    const sentinel = join(f.root, 'executed-helper');
    const path = join(f.root, 'scripts/classify-historical-evidence.mjs');
    const original = readFileSync(path);
    writeFileSync(
      path,
      `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(sentinel)},'token '+process.env.GH_TOKEN);throw new Error('executed helper');`,
    );
    // Import the copied verifier and also enter its CLI. Neither may import
    // adjacent helpers before the protected-object bootstrap has validated them.
    const moduleUrl = pathToFileURL(
      join(f.root, 'scripts/verify-historical-evidence-provenance.mjs'),
    ).href;
    const imported = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(moduleUrl)})`],
      { encoding: 'utf8', env: { ...process.env, GH_TOKEN: 'sensitive-unit-sentinel' } },
    );
    assert.equal(imported.status, 0, imported.stderr);
    const entered = spawnSync(
      process.execPath,
      [join(f.root, 'scripts/verify-historical-evidence-provenance.mjs')],
      { encoding: 'utf8', env: { ...process.env, GH_TOKEN: 'sensitive-unit-sentinel' } },
    );
    assert.equal(entered.status, 1);
    assert.match(entered.stderr, /Usage:/);
    await assert.rejects(
      () => loadProtectedHelpers({ repo: f.root, protectedTip: f.base, localRoot: f.root }),
      /Local control differs/,
    );
    assert.equal(existsSync(sentinel), false);
    writeFileSync(path, original);
    // Qualifier is a separate transitive dependency and must be checked too.
    const qualifier = join(f.root, 'scripts/qualify-historical-evidence.mjs');
    writeFileSync(
      qualifier,
      `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(sentinel)},'executed');`,
    );
    await assert.rejects(
      () => loadProtectedHelpers({ repo: f.root, protectedTip: f.base, localRoot: f.root }),
      /Local control differs/,
    );
    assert.equal(existsSync(sentinel), false);
  } finally {
    f.cleanup();
  }
});
