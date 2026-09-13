import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  opendirSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  captureSpecialistOutputBaseline,
  observeSpecialistOutput,
  verifySpecialistOutput,
  type SpecialistOutputBaseline,
  type SpecialistOutputBinding,
  type SpecialistOutputCandidate,
  type SpecialistOutputGrant,
} from '../src/index.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readSync: vi.fn(actual.readSync), opendirSync: vi.fn(actual.opendirSync) };
});
const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
const binding: SpecialistOutputBinding = {
  workspaceId: 'workspace',
  runId: 'run',
  taskId: 'task',
  executionId: 'execution',
  role: 'implementation_worker',
  contractVersion: 1,
  policyDigest: `sha256:${'a'.repeat(64)}`,
  inputMaterialDigest: `sha256:${'b'.repeat(64)}`,
  baselineHeadSha: 'c'.repeat(40),
};
let fixture: string;
let root: string;
beforeEach(() => {
  fixture = realpathSync(mkdtempSync(join(tmpdir(), 'specialist-output-')));
  root = join(fixture, 'workspace');
  mkdirSync(root, { mode: 0o700 });
});
afterEach(() => {
  vi.mocked(readSync).mockImplementation(actualFs.readSync);
  vi.mocked(opendirSync).mockImplementation(actualFs.opendirSync);
  vi.clearAllMocks();
  rmSync(fixture, { recursive: true, force: true });
});
function file(path: string, content: string | Buffer = 'fixture'): void {
  mkdirSync(dirname(join(root, path)), { recursive: true, mode: 0o700 });
  writeFileSync(join(root, path), content, { mode: 0o600 });
}
function capture(writablePaths: readonly SpecialistOutputGrant[] = []): SpecialistOutputBaseline {
  return captureSpecialistOutputBaseline({
    workspaceRoot: root,
    expectedBinding: binding,
    writablePaths,
  });
}
function expectation(baseline: SpecialistOutputBaseline) {
  return { baseline, expectedBinding: binding, expectedBaselineDigest: baseline.baselineDigest };
}
function observe(baseline: SpecialistOutputBaseline): SpecialistOutputCandidate {
  return observeSpecialistOutput(expectation(baseline));
}
function verify(baseline: SpecialistOutputBaseline, candidate: SpecialistOutputCandidate): void {
  verifySpecialistOutput({ ...expectation(baseline), candidate });
}

describe('execution-bound specialist output candidates', () => {
  it('captures a complete unchanged tree including directories without changing bytes or permissions', () => {
    file('context.txt');
    mkdirSync(join(root, 'empty'), { mode: 0o750 });
    const before = readFileSync(join(root, 'context.txt'));
    const baseline = capture();
    const candidate = observe(baseline);
    expect(candidate.changes).toEqual([]);
    expect(candidate.outputTreeDigest).toBe(baseline.baselineTreeDigest);
    expect(candidate.binding).toEqual(binding);
    expect(() => verify(baseline, candidate)).not.toThrow();
    expect(readFileSync(join(root, 'context.txt'))).toEqual(before);
    expect(statSync(join(root, 'context.txt')).mode & 0o777).toBe(0o600);
    expect(statSync(join(root, 'empty')).mode & 0o777).toBe(0o750);
    expect(actualFs.readdirSync(root)).toEqual(['context.txt', 'empty']);
  });

  it('observes binary additions/modifications/deletions and regular modes in deterministic order', () => {
    file('work/modify.bin', Buffer.from([0, 255]));
    file('work/delete.bin');
    file('work/script', 'script');
    const baseline = capture([{ kind: 'subtree', path: 'work' }]);
    file('work/modify.bin', Buffer.from([1, 254]));
    file('work/add.bin', Buffer.from([0, 128, 255]));
    rmSync(join(root, 'work/delete.bin'));
    chmodSync(join(root, 'work/script'), 0o755);
    const candidate = observe(baseline);
    expect(candidate.changes.map((entry) => [entry.path, entry.change])).toEqual([
      ['work/add.bin', 'added'],
      ['work/delete.bin', 'deleted'],
      ['work/modify.bin', 'modified'],
      ['work/script', 'modified'],
    ]);
    expect(candidate.changes[0]!.before).toBeNull();
    expect(candidate.changes[0]!.after).toMatchObject({ kind: 'file', sizeBytes: 3, mode: 0o600 });
    expect(candidate.changes[1]!.after).toBeNull();
    expect(candidate.changes[3]!.after).toMatchObject({ mode: 0o755 });
    expect(candidate.outputTreeDigest).not.toBe(baseline.baselineTreeDigest);
    expect(observe(baseline).candidateDigest).toBe(candidate.candidateDigest);
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(Object.isFrozen(candidate.binding)).toBe(true);
    expect(Object.isFrozen(candidate.changes)).toBe(true);
    expect(Object.isFrozen(candidate.changes[0])).toBe(true);
    expect(Object.isFrozen(candidate.changes[0]!.after)).toBe(true);
    verify(baseline, candidate);
  });

  it('tracks directory additions, deletions and modes within a subtree without rejecting directory link counts', () => {
    mkdirSync(join(root, 'work/old'), { recursive: true, mode: 0o700 });
    const baseline = capture([{ kind: 'subtree', path: 'work' }]);
    rmSync(join(root, 'work/old'), { recursive: true });
    mkdirSync(join(root, 'work/new'), { mode: 0o750 });
    chmodSync(join(root, 'work'), 0o755);
    expect(observe(baseline).changes.map((entry) => [entry.path, entry.change])).toEqual([
      ['work', 'modified'],
      ['work/new', 'added'],
      ['work/old', 'deleted'],
    ]);
  });

  it.each(['modify', 'delete', 'mode', 'new-file', 'new-directory', 'root-mode'])(
    'rejects immutable context change: %s',
    (kind) => {
      file('context');
      const baseline = capture([{ kind: 'subtree', path: 'work' }]);
      if (kind === 'modify') file('context', 'changed');
      if (kind === 'delete') rmSync(join(root, 'context'));
      if (kind === 'mode') chmodSync(join(root, 'context'), 0o755);
      if (kind === 'new-file') file('other');
      if (kind === 'new-directory') mkdirSync(join(root, 'other'));
      if (kind === 'root-mode') chmodSync(root, 0o755);
      expect(() => observe(baseline)).toThrow('observation failed');
    },
  );

  it('uses exact file grants and component-boundary subtree grants', () => {
    file('work/a');
    const baseline = capture([
      { kind: 'file', path: 'work/a' },
      { kind: 'subtree', path: 'safe' },
    ]);
    file('work/a', 'permitted');
    file('safe/nested/b');
    expect(() => observe(baseline)).not.toThrow();
    file('safety/escape');
    expect(() => observe(baseline)).toThrow('observation failed');
    rmSync(join(root, 'safety'), { recursive: true });
    file('work/ab');
    expect(() => observe(baseline)).toThrow('observation failed');
  });

  it('requires subtree authority for missing parent directories', () => {
    const baseline = capture([{ kind: 'file', path: 'new/file' }]);
    file('new/file');
    expect(() => observe(baseline)).toThrow('observation failed');
  });

  it.each(['file-to-directory', 'directory-to-file'])(
    'rejects type replacement %s even within a grant',
    (kind) => {
      if (kind === 'file-to-directory') file('work');
      else mkdirSync(join(root, 'work'));
      const baseline = capture([{ kind: 'subtree', path: 'work' }]);
      rmSync(join(root, 'work'), { recursive: true });
      if (kind === 'file-to-directory') mkdirSync(join(root, 'work'));
      else file('work');
      expect(() => observe(baseline)).toThrow('observation failed');
    },
  );

  it('copies authority inputs and rejects later caller mutation as new expectations', () => {
    file('work');
    const mutableBinding = { ...binding };
    const grants: Array<{ kind: 'file' | 'subtree'; path: string }> = [
      { kind: 'file', path: 'work' },
    ];
    const baseline = captureSpecialistOutputBaseline({
      workspaceRoot: root,
      expectedBinding: mutableBinding,
      writablePaths: grants,
    });
    mutableBinding.executionId = 'foreign';
    grants[0]!.path = 'context';
    grants.push({ kind: 'subtree', path: 'outside' });
    file('work', 'allowed');
    expect(() => observe(baseline)).not.toThrow();
    expect(() =>
      observeSpecialistOutput({ ...expectation(baseline), expectedBinding: mutableBinding }),
    ).toThrow();
    file('outside/leak');
    expect(() => observe(baseline)).toThrow();
  });

  it.each(Object.keys(binding))(
    'rejects substituted binding field %s on observation and verification',
    (key) => {
      const baseline = capture();
      const candidate = observe(baseline);
      const altered = { ...binding, [key]: key === 'contractVersion' ? 2 : 'foreign' };
      const input = { ...expectation(baseline), expectedBinding: altered };
      expect(() => observeSpecialistOutput(input)).toThrow();
      expect(() => verifySpecialistOutput({ ...input, candidate })).toThrow();
    },
  );

  it('rejects unknown binding fields, forged handles/candidates and stale baseline expectations', () => {
    const baseline = capture();
    const candidate = observe(baseline);
    expect(() =>
      observeSpecialistOutput({
        ...expectation(baseline),
        expectedBinding: { ...binding, unexpected: true } as SpecialistOutputBinding,
      }),
    ).toThrow();
    expect(() =>
      observeSpecialistOutput({ ...expectation(baseline), baseline: { ...baseline } }),
    ).toThrow();
    expect(() =>
      observeSpecialistOutput({
        ...expectation(baseline),
        expectedBaselineDigest: `sha256:${'d'.repeat(64)}`,
      }),
    ).toThrow();
    expect(() => verify(baseline, { ...candidate })).toThrow();
    expect(() => verify(capture(), candidate)).toThrow();
  });

  it('reverifies the full tree and never updates an older candidate to a later output', () => {
    file('context');
    file('work', 'before');
    const baseline = capture([{ kind: 'file', path: 'work' }]);
    file('work', 'first');
    const first = observe(baseline);
    file('work', 'second');
    const second = observe(baseline);
    expect(() => verify(baseline, first)).toThrow('verification failed');
    verify(baseline, second);
    file('context', 'tampered');
    expect(() => verify(baseline, second)).toThrow('verification failed');
  });

  it('rejects root replacement even with the same paths, bytes and modes', () => {
    file('work');
    const baseline = capture([{ kind: 'file', path: 'work' }]);
    const candidate = observe(baseline);
    renameSync(root, join(fixture, 'old-workspace'));
    mkdirSync(root, { mode: 0o700 });
    file('work');
    expect(() => observe(baseline)).toThrow();
    expect(() => verify(baseline, candidate)).toThrow();
  });

  it.each([
    '.git/config',
    '.beads/file',
    '.ssh/key',
    '.codex/config',
    '.agents/file',
    '.env.local',
    'nested/auth.json',
    '.aws/credentials',
    '.npmrc',
  ])('rejects prohibited tree/grant path %s', (path) => {
    expect(() => capture([{ kind: 'file', path }])).toThrow('capture failed');
    file(path, 'synthetic secret marker');
    expect(() => capture()).toThrow('capture failed');
    expect(readSync).not.toHaveBeenCalled();
  });

  it.each([
    '',
    '.',
    '..',
    '../outside',
    '/outside',
    'C:relative',
    'a\\b',
    'a//b',
    'a/./b',
    'a\0b',
    'x'.repeat(4097),
  ])('rejects invalid grant %#', (path) => {
    expect(() => capture([{ kind: 'subtree', path }])).toThrow('capture failed');
  });

  it('rejects case and Unicode-normalization grant aliases', () => {
    for (const paths of [
      ['File', 'file'],
      ['é', 'e\u0301'],
    ]) {
      expect(() => capture(paths.map((path) => ({ kind: 'file', path })))).toThrow();
    }
  });

  it.each([
    ['A', 'a'],
    ['é', 'e\u0301'],
  ])('rejects a path alias encountered in the directory iterator: %s', (original, alias) => {
    file(original);
    vi.mocked(opendirSync).mockImplementationOnce((path, options) => {
      const directory = actualFs.opendirSync(path, options);
      const realRead = directory.readSync.bind(directory);
      let duplicated = false;
      vi.spyOn(directory, 'readSync').mockImplementation(() => {
        const entry = realRead();
        if (entry !== null) return entry;
        if (!duplicated) {
          duplicated = true;
          return { name: alias } as ReturnType<typeof directory.readSync>;
        }
        return null;
      });
      return directory;
    });
    expect(() => capture()).toThrow('capture failed');
  });

  it.each(['symlink', 'hardlink', 'fifo', 'file-special-mode', 'directory-special-mode'])(
    'rejects unsupported filesystem entry %s',
    (kind) => {
      file('target');
      if (kind === 'symlink') symlinkSync(join(root, 'target'), join(root, 'link'));
      if (kind === 'hardlink') linkSync(join(root, 'target'), join(root, 'link'));
      if (kind === 'fifo') execFileSync('mkfifo', [join(root, 'pipe')]);
      if (kind === 'file-special-mode') chmodSync(join(root, 'target'), 0o4600);
      if (kind === 'directory-special-mode') chmodSync(root, 0o1700);
      expect(() => capture()).toThrow('capture failed');
    },
  );

  it('rejects symlinked root ancestry', () => {
    symlinkSync(root, join(fixture, 'link'));
    expect(() =>
      captureSpecialistOutputBaseline({
        workspaceRoot: join(fixture, 'link'),
        expectedBinding: binding,
        writablePaths: [],
      }),
    ).toThrow();
  });

  it('bounds entry count, depth and binary byte size', () => {
    for (let index = 0; index < 1024; index += 1) file(`files/${index}`, '');
    expect(() => capture()).toThrow();
    rmSync(join(root, 'files'), { recursive: true });
    file(`${'d/'.repeat(32)}file`);
    expect(() => capture()).toThrow();
    rmSync(join(root, 'd'), { recursive: true });
    file('large', '');
    truncateSync(join(root, 'large'), 16 * 1024 * 1024 + 1);
    expect(() => capture()).toThrow();
    truncateSync(join(root, 'large'), 8 * 1024 * 1024 + 1);
    file('other-large', '');
    truncateSync(join(root, 'other-large'), 8 * 1024 * 1024);
    expect(() => capture()).toThrow();
  });

  it('rejects newly created prohibited output even under a subtree grant', () => {
    mkdirSync(join(root, 'work'));
    const baseline = capture([{ kind: 'subtree', path: 'work' }]);
    file('work/auth.json', 'synthetic credential marker');
    vi.mocked(readSync).mockClear();
    expect(() => observe(baseline)).toThrow('observation failed');
    expect(readSync).not.toHaveBeenCalled();
  });

  it('detects file mutation during checked descriptor reading', () => {
    file('work', 'before');
    const baseline = capture([{ kind: 'file', path: 'work' }]);
    vi.mocked(readSync).mockImplementationOnce((...args: Parameters<typeof readSync>) => {
      const result = actualFs.readSync(...args);
      file('work', 'mutated');
      return result;
    });
    expect(() => observe(baseline)).toThrow();
    expect(readFileSync(join(root, 'work'), 'utf8')).toBe('mutated');
  });

  it('detects a same-length file mutation between complete scans', () => {
    file('work', 'before');
    const baseline = capture([{ kind: 'file', path: 'work' }]);
    vi.mocked(opendirSync).mockImplementationOnce((path, options) => {
      const directory = actualFs.opendirSync(path, options);
      const close = directory.closeSync.bind(directory);
      vi.spyOn(directory, 'closeSync').mockImplementationOnce(() => {
        close();
        file('work', 'after!');
      });
      return directory;
    });
    expect(() => observe(baseline)).toThrow('observation failed');
  });
});
