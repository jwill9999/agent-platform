import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  classifyHistoricalEvidence,
  git,
  validateDataRepoPath,
  validateGitArguments,
  POLICY_PATH,
  REVIEW_PATH,
  SELECTION,
  sha256,
  SOURCE,
  validatePolicy,
  WORKFLOW_PATH,
} from './classify-historical-evidence.mjs';
import { CONTROL_PATHS } from './qualify-historical-evidence.mjs';

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export function fixture(transformContents, { omitReview = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'historical-evidence-test-'));
  const run = (...args) =>
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', root, ...args], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_AUTHOR_NAME: 'Archive unit fixture',
        GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
        GIT_COMMITTER_NAME: 'Archive unit fixture',
        GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      },
    }).trim();
  run('init', '-q');
  const paths = JSON.parse(readFileSync(join(sourceRoot, POLICY_PATH), 'utf8')).files.map(
    (file) => file.path,
  );
  const contents = paths.map((path, i) =>
    Buffer.from(
      path.endsWith('.json') ? JSON.stringify({ inertFixture: i }) + '\n' : `inert fixture ${i}\n`,
    ),
  );
  if (transformContents) transformContents(contents, paths);
  const target = paths.findIndex((path) => !path.endsWith('.json'));
  const padding = 3_958_506 - contents.reduce((sum, value) => sum + value.length, 0);
  contents[target] = Buffer.concat([contents[target], Buffer.alloc(padding, 32)]);
  const policy = {
    version: 1,
    sourceRevision: SOURCE,
    selectionManifestSha256: SELECTION,
    count: 220,
    bytes: 3_958_506,
    files: paths.map((path, i) => ({
      path,
      mode: '100644',
      blob: '0'.repeat(40),
      sha256: sha256(contents[i]),
      bytes: contents[i].length,
    })),
  };
  // execFileSync input is provided separately because git arguments are data only.
  for (let i = 0; i < paths.length; i++)
    policy.files[i].blob = execFileSync('git', ['-C', root, 'hash-object', '-w', '--stdin'], {
      input: contents[i],
      encoding: 'utf8',
    }).trim();
  for (const path of CONTROL_PATHS) {
    const output = join(root, path);
    mkdirSync(dirname(output), { recursive: true });
    if (path !== POLICY_PATH && path !== REVIEW_PATH)
      writeFileSync(
        output,
        path === WORKFLOW_PATH ? 'name: trusted fixture\n' : readFileSync(join(sourceRoot, path)),
      );
  }
  const policyBytes = Buffer.from(JSON.stringify(policy, null, 2) + '\n');
  writeFileSync(join(root, POLICY_PATH), policyBytes);
  const review = {
    version: 1,
    verdict: 'approved-inert-retention-with-limits',
    reviewer: 'independent-unit-fixture-not-production-approval',
    sourceRevision: SOURCE,
    selectionManifestSha256: SELECTION,
    allowlistSha256: sha256(policyBytes),
    files: 220,
    bytes: 3_958_506,
    jsonFiles: 139,
    evidenceSha256: 'a'.repeat(64),
    coverage: ['unit', 'fixture', 'only'],
    limits: ['unit', 'not real review', 'not pilot evidence'],
  };
  if (!omitReview) writeFileSync(join(root, REVIEW_PATH), JSON.stringify(review) + '\n');
  writeFileSync(join(root, 'README.md'), 'base\n');
  run('add', '.');
  run('commit', '-qm', 'protected fixture');
  const base = run('rev-parse', 'HEAD');
  for (let i = 0; i < paths.length; i++) {
    const output = join(root, paths[i]);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, contents[i]);
  }
  run('add', '.');
  run('commit', '-qm', 'exact archive fixture');
  const head = run('rev-parse', 'HEAD');
  const merge = run(
    'commit-tree',
    run('rev-parse', `${head}^{tree}`),
    '-p',
    base,
    '-p',
    head,
    '-m',
    'merge fixture',
  );
  return {
    root,
    run,
    policy,
    review,
    base,
    head,
    merge,
    paths,
    contents,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  test('complete 220 Git-object additions classify as archive, including paths beyond API first page', () => {
    const f = fixture();
    try {
      const result = classifyHistoricalEvidence({ repo: f.root, base: f.base, head: f.head });
      assert.equal(result.route, 'archive');
      assert.equal(result.files, 220);
      assert.equal(result.bytes, 3_958_506);
    } finally {
      f.cleanup();
    }
  });
  test('partial, empty, authored bookkeeping, deletions and renamed/mode-changed payloads require full scan', async (t) => {
    const f = fixture();
    try {
      for (const [name, change] of [
        ['empty', () => f.base],
        [
          'partial',
          () => {
            rmSync(join(f.root, f.paths[219]));
            return null;
          },
        ],
        [
          'authored',
          () => {
            writeFileSync(join(f.root, 'session.md'), 'bookkeeping\n');
            return null;
          },
        ],
        [
          'edited',
          () => {
            writeFileSync(join(f.root, f.paths[0]), '{}\n');
            return null;
          },
        ],
        [
          'deletion',
          () => {
            rmSync(join(f.root, 'README.md'));
            return null;
          },
        ],
        [
          'executable',
          () => {
            chmodSync(join(f.root, f.paths[0]), 0o755);
            return null;
          },
        ],
        [
          'symlink',
          () => {
            rmSync(join(f.root, f.paths[0]));
            symlinkSync('/etc/passwd', join(f.root, f.paths[0]));
            return null;
          },
        ],
        [
          'workflow-self-authorization',
          () => {
            writeFileSync(join(f.root, WORKFLOW_PATH), 'name: forged\n');
            return null;
          },
        ],
        [
          'rename',
          () => {
            f.run('mv', f.paths[0], `${f.paths[0]}.renamed`);
            return null;
          },
        ],
      ])
        await t.test(name, () => {
          f.run('reset', '--hard', f.head);
          f.run('clean', '-fd');
          let head = change();
          if (!head) {
            f.run('add', '-A');
            f.run('commit', '-qm', name);
            head = f.run('rev-parse', 'HEAD');
          }
          assert.equal(
            classifyHistoricalEvidence({ repo: f.root, base: f.base, head }).route,
            'full',
          );
        });
    } finally {
      f.cleanup();
    }
  });
  test('malformed policies, duplicate/unsafe paths and identity errors fail closed', () => {
    const f = fixture();
    try {
      for (const mutate of [
        (p) => p.files.push(p.files[0]),
        (p) => (p.files[1] = p.files[0]),
        (p) => (p.files[0].path = 'docs/reviews/../evil.json'),
        (p) => (p.files[0].path += '\n'),
        (p) => (p.files[0].mode = '120000'),
        (p) => (p.files[0].blob = 'invalid'),
        (p) => (p.files[0].sha256 = 'invalid'),
        (p) => p.files[0].bytes++,
        (p) => (p.sourceRevision = 'a'.repeat(40)),
      ]) {
        const p = structuredClone(f.policy);
        mutate(p);
        assert.throws(() => validatePolicy(p));
      }
      assert.throws(() =>
        classifyHistoricalEvidence({ repo: f.root, base: f.base, head: 'a'.repeat(40) }),
      );
      assert.throws(() =>
        classifyHistoricalEvidence({ repo: f.root, base: '--help', head: f.head }),
      );
    } finally {
      f.cleanup();
    }
  });
  test('Git argument contract rejects options, unsafe revisions and repository paths before execution', () => {
    const root = mkdtempSync(join(tmpdir(), 'git-contract-negative-'));
    const hash = 'a'.repeat(40);
    try {
      for (const repo of [
        'relative.git',
        '--upload-pack=evil',
        root + '/../outside',
        '/',
        join(root, 'bad\npath'),
        join(root, 'bad\0path'),
      ])
        assert.throws(() => validateDataRepoPath(repo));
      for (const args of [
        ['config', 'core.hooksPath', join(root, 'evil')],
        ['cat-file', '-t', '--help'],
        ['cat-file', 'blob', hash, '--batch'],
        ['ls-tree', '-z', hash, '--', '../outside'],
        ['ls-tree', '-z', hash, '--', '-command'],
        ['show', `${hash}:../outside`],
        ['show', '--ext-diff', hash],
        ['merge-base', '--is-ancestor', hash, '--help'],
        ['rev-parse', '--git-path', 'hooks'],
        ['update-ref', 'refs/heads/main', hash],
        [
          'diff',
          '--raw',
          '-z',
          '--no-renames',
          '--ext-diff',
          '--no-textconv',
          '--no-abbrev',
          hash,
          hash,
          '--',
        ],
        ['constructor'],
      ]) {
        assert.throws(() => validateGitArguments(args));
        assert.throws(() => git(root, ...args), /Unsupported|Invalid/);
      }
      validateGitArguments(['cat-file', '-t', hash]);
      validateGitArguments(['ls-tree', '-z', hash, '--', 'docs/reviews/evidence.json']);
      const sentinel = join(root, 'untrusted-path-executed');
      writeFileSync(join(root, 'git'), '#!/bin/sh\n/usr/bin/touch ' + sentinel + '\n');
      chmodSync(join(root, 'git'), 0o755);
      const before = process.env.PATH;
      try {
        process.env.PATH = root;
        // The fixed executable runs, reports no repository, and never executes
        // the candidate PATH binary or inherits its search directory.
        assert.throws(() => git(root, 'rev-parse', 'HEAD'));
        assert.equal(existsSync(sentinel), false);
      } finally {
        process.env.PATH = before;
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
