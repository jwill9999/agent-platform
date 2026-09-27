import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  renameSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  unlinkSync,
  linkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  importImplementationOutput,
  initializeImplementationImports,
} from '../src/implementationImport.js';
import { implementationOutputSchema } from '../src/implementationOutput.js';

const digest = (value: string | Uint8Array) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
const marker = digest('fixture');
const gitBinary = process.env.WORKFLOW_GIT_BINARY ?? '/usr/bin/git';
let root: string;
let db: Database.Database;
let base: string;
function git(...args: string[]) {
  return execFileSync(gitBinary, args, {
    cwd: root,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@localhost',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@localhost',
    },
  })
    .toString()
    .trim();
}
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'implementation-import-test-')));
  git('init', '--quiet', '-b', 'task/task');
  writeFileSync(join(root, 'source.txt'), 'before');
  git('add', 'source.txt');
  git('commit', '--quiet', '-m', 'fixture');
  base = git('rev-parse', 'HEAD');
  db = new Database(join(root, '.git/import.sqlite'));
  db.exec('CREATE TABLE scheduler_executions(id TEXT PRIMARY KEY)');
  db.exec("INSERT INTO scheduler_executions VALUES('worker')");
  initializeImplementationImports(db);
});
afterEach(() => {
  db?.close();
  rmSync(root, { recursive: true, force: true });
});
function output() {
  return implementationOutputSchema.parse({
    kind: 'implementation_output',
    version: 1,
    executionId: 'worker',
    attempt: 1,
    baselineDigest: marker,
    outputTreeDigest: marker,
    input: {
      kind: 'specialist_input',
      binding: {
        executionDigest: digest(JSON.stringify('worker')),
        ownerDigest: marker,
        callbackId: marker,
        headSha: base,
        runVersion: 1,
        phaseLeaseEpoch: 1,
        workspaceLeaseEpoch: 1,
        runLeaseEpoch: 1,
        taskLeaseEpoch: 1,
      },
      task: {
        runId: 'run',
        taskId: 'task',
        contractVersion: 1,
        policyDigest: marker,
        assignedRole: 'implementation_worker',
        objective: 'Change source',
        acceptanceCriteria: ['changed'],
        allowedPaths: ['source.txt'],
        allowedOperations: ['workspace.read', 'workspace.patch', 'artifact.write'],
        retryBudget: {
          implementationAttempts: 2,
          findingAttempts: 2,
          infrastructureAttempts: 2,
          waitDeadlineSeconds: 300,
        },
        evidence: [],
      },
    },
    files: [
      {
        path: 'source.txt',
        beforeDigest: digest('before'),
        afterDigest: digest('after'),
        content: 'after',
      },
    ],
    terminal: {
      status: 'passed',
      summary: 'Changed',
      changedFiles: ['source.txt'],
      acceptanceCriteria: { passed: ['changed'], failed: [] },
      evidence: [],
      findings: [],
      remainingRisks: [],
      recommendedTransition: 'continue',
    },
  });
}
function run(
  options: {
    fault?: (boundary: string) => void;
    assertAuthority?: () => void;
    value?: unknown;
  } = {},
) {
  const artifact = Buffer.from(JSON.stringify(options.value ?? output()));
  return importImplementationOutput({
    database: db,
    sourceRoot: root,
    gitBinary,
    artifact,
    artifactDigest: digest(artifact),
    authority: { owner: 'fixture' },
    assertAuthority: options.assertAuthority ?? (() => undefined),
    fault: options.fault,
  });
}
describe('journaled implementation import repository adapter (unit authority fixture)', () => {
  it.each(['destination', 'ancestor'])(
    'rejects a concurrent %s symlink replacement without modifying its outside target',
    (kind) => {
      const outside = realpathSync(mkdtempSync(join(tmpdir(), 'import-outside-')));
      writeFileSync(join(outside, 'source.txt'), 'before');
      const value = output();
      if (kind === 'ancestor') {
        mkdirSync(join(root, 'nested'));
        renameSync(join(root, 'source.txt'), join(root, 'nested/source.txt'));
        git('add', '-A');
        git('commit', '--quiet', '-m', 'nested');
        base = git('rev-parse', 'HEAD');
        value.input.binding.headSha = base;
        value.files[0]!.path = 'nested/source.txt';
        value.input.task.allowedPaths = ['nested'];
        value.terminal.changedFiles = ['nested/source.txt'];
      }
      try {
        expect(() =>
          run({
            value,
            fault: (boundary) => {
              if (boundary !== 'before_file_apply') return;
              if (kind === 'destination') {
                unlinkSync(join(root, 'source.txt'));
                symlinkSync(join(outside, 'source.txt'), join(root, 'source.txt'));
              } else {
                renameSync(join(root, 'nested'), join(root, '.git/original-nested'));
                symlinkSync(outside, join(root, 'nested'));
              }
            },
          }),
        ).toThrow('anchored');
        expect(readFileSync(join(outside, 'source.txt'), 'utf8')).toBe('before');
        expect(git('rev-parse', 'HEAD')).toBe(base);
        expect(db.prepare('SELECT status FROM implementation_imports').get()).toEqual({
          status: 'prepared',
        });
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    },
  );
  it('imports verified bytes, advances the exact base and replays without another commit', () => {
    const receipt = run();
    expect(receipt.status).toBe('verified');
    expect(readFileSync(join(root, 'source.txt'), 'utf8')).toBe('after');
    expect(git('rev-parse', 'HEAD^')).toBe(base);
    expect(git('status', '--porcelain')).toBe('');
    expect(run()).toEqual(receipt);
    expect(git('rev-list', '--count', 'HEAD')).toBe('2');
  });
  it.each(['after_prepare', 'after_head_apply', 'after_apply'])(
    'reconciles crash at %s without duplicate effects',
    (boundary) => {
      expect(() =>
        run({
          fault: (at) => {
            if (at === boundary) throw new Error('crash');
          },
        }),
      ).toThrow('crash');
      expect(run().resultHead).toBe(git('rev-parse', 'HEAD'));
      expect(git('rev-list', '--count', 'HEAD')).toBe('2');
    },
  );
  it.each(['after_prepare', 'after_head_apply', 'after_apply'])(
    'recovers retained intent after process termination at %s',
    (boundary) => {
      const artifact = JSON.stringify(output());
      const script = `import Database from ${JSON.stringify(new URL('../node_modules/better-sqlite3/lib/index.js', import.meta.url).href)};
      import { importImplementationOutput } from ${JSON.stringify(new URL('../dist/implementationImport.js', import.meta.url).href)};
      const [root,binary,artifact,digest,boundary] = process.argv.slice(1);
      const db = new Database(root+'/.git/import.sqlite');
      importImplementationOutput({database:db,sourceRoot:root,gitBinary:binary,artifact:Buffer.from(artifact),artifactDigest:digest,
        authority:{owner:'fixture'},assertAuthority:()=>{},fault:(at)=>{if(at===boundary) process.exit(23)}});`;
      expect(() =>
        execFileSync(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            script,
            root,
            gitBinary,
            artifact,
            digest(artifact),
            boundary,
          ],
          { stdio: 'pipe', timeout: 10000 },
        ),
      ).toThrow();
      const retained = db.prepare('SELECT status FROM implementation_imports').get();
      expect(retained).toEqual({ status: boundary === 'after_apply' ? 'applied' : 'prepared' });
      const receipt = run();
      expect(receipt.status).toBe('verified');
      expect(git('rev-list', '--count', 'HEAD')).toBe('2');
      expect(readFileSync(join(root, 'source.txt'), 'utf8')).toBe('after');
    },
  );
  it('retains prepared evidence and refuses uncertain partial application', () => {
    expect(() =>
      run({
        fault: (at) => {
          if (at === 'after_file_apply') throw new Error('crash');
        },
      }),
    ).toThrow('crash');
    expect(() => run()).toThrow('partial application');
    expect(db.prepare('SELECT status FROM implementation_imports').get()).toEqual({
      status: 'prepared',
    });
    expect(git('rev-parse', 'HEAD')).toBe(base);
  });
  it('rejects concurrent source drift and revoked authority before any writes', () => {
    writeFileSync(join(root, 'source.txt'), 'human change');
    expect(() => run()).toThrow('drift');
    expect(readFileSync(join(root, 'source.txt'), 'utf8')).toBe('human change');
    expect(() =>
      run({
        assertAuthority: () => {
          throw new Error('revoked');
        },
      }),
    ).toThrow('revoked');
    expect(db.prepare('SELECT COUNT(*) AS count FROM implementation_imports').get()).toEqual({
      count: 0,
    });
  });
  it.each(['--assume-unchanged', '--skip-worktree'])(
    'rejects tracked drift hidden with %s',
    (flag) => {
      git('update-index', flag, 'source.txt');
      writeFileSync(join(root, 'source.txt'), 'hidden drift');
      const value = output();
      value.files[0]!.beforeDigest = digest('hidden drift');
      expect(() => run({ value })).toThrow('index flags');
      expect(readFileSync(join(root, 'source.txt'), 'utf8')).toBe('hidden drift');
      expect(git('rev-parse', 'HEAD')).toBe(base);
    },
  );
  it('refuses deletion of ignored host files absent from the approved base', () => {
    writeFileSync(join(root, '.git/info/exclude'), 'ignored.txt\n');
    writeFileSync(join(root, 'ignored.txt'), 'private local content');
    const value = output();
    value.input.task.allowedPaths = ['ignored.txt'];
    value.files = [
      {
        path: 'ignored.txt',
        beforeDigest: digest('private local content'),
        afterDigest: null,
        content: null,
      },
    ];
    value.terminal.changedFiles = ['ignored.txt'];
    expect(() => run({ value })).toThrow('approved base blob');
    expect(readFileSync(join(root, 'ignored.txt'), 'utf8')).toBe('private local content');
  });
  it('rejects another checked-out branch even at the approved commit', () => {
    git('checkout', '-q', '-b', 'task/another-task');
    expect(() => run()).toThrow('branch is outside task authority');
    expect(git('rev-parse', 'HEAD')).toBe(base);
    expect(readFileSync(join(root, 'source.txt'), 'utf8')).toBe('before');
  });
  it('rejects configured filters before invoking them', () => {
    git('config', 'filter.fixture.clean', 'touch filter-executed');
    expect(() => run()).toThrow('filters are unsupported');
    expect(git('rev-parse', 'HEAD')).toBe(base);
  });
  it.each(['symlink', 'hardlink'])('rejects a %s source without importing', (kind) => {
    const target = join(root, '.git', 'disposable-target');
    writeFileSync(target, 'before');
    unlinkSync(join(root, 'source.txt'));
    if (kind === 'symlink') symlinkSync(target, join(root, 'source.txt'));
    else linkSync(target, join(root, 'source.txt'));
    expect(() => run()).toThrow();
    expect(readFileSync(target, 'utf8')).toBe('before');
    expect(git('rev-parse', 'HEAD')).toBe(base);
  });
  it.each([
    'source.txt/../outside',
    'source.txt/./child',
    'source.txt//child',
    'source.txt\\child',
    '.gitattributes',
    '.gitmodules',
  ])('rejects ambiguous or privileged output path %s', (path) => {
    const value = output();
    value.input.task.allowedPaths = [path];
    value.files[0]!.path = path;
    value.terminal.changedFiles = [path];
    expect(() => run({ value })).toThrow();
    expect(git('rev-parse', 'HEAD')).toBe(base);
  });
  it('rechecks authority when reconciling an already verified import', () => {
    const receipt = run();
    expect(() =>
      run({
        assertAuthority: () => {
          throw new Error('approval revoked');
        },
      }),
    ).toThrow('approval revoked');
    expect(git('rev-parse', 'HEAD')).toBe(receipt.resultHead);
    expect(git('rev-list', '--count', 'HEAD')).toBe('2');
  });
  it('imports a new regular file under newly created parent directories', () => {
    const value = output();
    value.input.task.allowedPaths = ['nested'];
    value.files = [
      {
        path: 'nested/deeper/new.ts',
        beforeDigest: null,
        afterDigest: digest('export const value = 1;'),
        content: 'export const value = 1;',
      },
    ];
    value.terminal.changedFiles = ['nested/deeper/new.ts'];
    const receipt = run({ value });
    expect(readFileSync(join(root, 'nested/deeper/new.ts'), 'utf8')).toBe(
      'export const value = 1;',
    );
    expect(git('status', '--porcelain')).toBe('');
    expect(run({ value })).toEqual(receipt);
  });
  it('rejects forged content, missing prior digest, and unsupported file types', () => {
    const value = output();
    value.files[0]!.content = 'forged';
    expect(() => run({ value })).toThrow('digest mismatch');
    value.files[0]!.content = 'after';
    value.files[0]!.beforeDigest = null;
    expect(() => run({ value })).toThrow('absent');
  });
});
