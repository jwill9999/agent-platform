import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  stagePreapprovalMaterial,
  type PreapprovalMaterial,
  type PreapprovalMaterialEntry,
} from '../src/index.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    mkdtempSync: vi.fn(actual.mkdtempSync),
    writeFileSync: vi.fn(actual.writeFileSync),
  };
});

const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
let root: string;
let materials: PreapprovalMaterial[];

beforeEach(() => {
  root = realpathSync(actualFs.mkdtempSync(join(tmpdir(), 'preapproval-fixture-')));
  materials = [];
});

afterEach(() => {
  vi.mocked(writeFileSync).mockImplementation(actualFs.writeFileSync);
  for (const material of materials) material.cleanup();
  rmSync(root, { recursive: true, force: true });
  vi.clearAllMocks();
});

function source(path: string, bytes: string | Buffer = 'fixture bytes'): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  actualFs.writeFileSync(join(root, path), bytes);
}

function stage(paths: string[], expectedManifestDigest?: string): PreapprovalMaterial {
  const material = stagePreapprovalMaterial({ sourceRoot: root, paths, expectedManifestDigest });
  materials.push(material);
  return material;
}

function expectFailedStageCleanedUp(operation: () => unknown): void {
  expect(operation).toThrow('preapproval material staging failed');
  const created = vi.mocked(mkdtempSync).mock.results.at(-1)?.value as string;
  expect(created).toContain('workflow-preapproval-');
  expect(existsSync(created)).toBe(false);
}

describe('stagePreapprovalMaterial', () => {
  it('preserves locale-independent UTF-16 manifest ordering through the public API', () => {
    const expectedOrder = [
      '!first.ts',
      '-dash.ts',
      'Z.ts',
      '_under.ts',
      'a.ts',
      'Ω.ts',
      '中.ts',
      '𐀀.ts',
      '\uE000.ts',
    ];
    for (const path of expectedOrder) source(path);
    const first = stage([...expectedOrder].reverse());
    const entries: readonly PreapprovalMaterialEntry[] = first.manifest;
    expect(entries.map((entry) => entry.path)).toEqual(expectedOrder);
    const second = stage(expectedOrder, first.manifestDigest);
    expect(second.manifestDigest).toEqual(first.manifestDigest);
  });

  it('stages only enumerated bytes privately, with stable ordering and an expected digest', () => {
    const binary = Buffer.from([0, 255, 10, 128]);
    source('nested/b.bin', binary);
    source('a.ts', 'export const fixture = true;');
    source('unselected.txt');
    const first = stage(['nested/b.bin', 'a.ts']);
    const second = stage(['a.ts', 'nested/b.bin'], first.manifestDigest);
    expect(first.manifest).toEqual(second.manifest);
    expect(first.manifestDigest).toEqual(second.manifestDigest);
    expect(first.manifest.map((entry) => entry.path)).toEqual(['a.ts', 'nested/b.bin']);
    expect(readFileSync(join(first.stagedSourceRoot, 'nested/b.bin'))).toEqual(binary);
    expect(existsSync(join(first.stagedSourceRoot, 'unselected.txt'))).toBe(false);
    expect(lstatSync(first.stagedSourceRoot).mode & 0o777).toBe(0o700);
    expect(lstatSync(join(first.stagedSourceRoot, 'nested')).mode & 0o777).toBe(0o700);
    expect(lstatSync(join(first.stagedSourceRoot, 'nested/b.bin')).mode & 0o777).toBe(0o600);
    expect(Object.isFrozen(first.manifest)).toBe(true);
    expect(Object.isFrozen(first.manifest[0])).toBe(true);
    expect(() => first.verify()).not.toThrow();
    first.cleanup();
    first.cleanup();
    expect(existsSync(first.stagedSourceRoot)).toBe(false);
    expect(readFileSync(join(root, 'nested/b.bin'))).toEqual(binary);
  });

  it.each([
    '',
    '../outside',
    'nested/../../outside',
    '/absolute',
    'C:\\absolute',
    'C:relative',
    '\\\\server\\share',
    'nested\\file',
    './a.ts',
    'nested//file',
    'a.ts/',
    'bad\0name',
    '.git/config',
    'nested/.beads/store',
    '.ssh/id_rsa',
    '.codex/config.toml',
    '.agents/skills/file',
    '.env',
    '.env.local',
    '.env-example',
    'nested/AUTH.json',
    '.aws/credentials',
    '.azure/config',
    '.gnupg/key',
    '.gitconfig',
    '.git-credentials',
    '.npmrc',
    '.netrc',
  ])('rejects unsafe or sensitive path %j before creating staging', (path) => {
    expect(() => stage([path])).toThrow('preapproval material');
    expect(mkdtempSync).not.toHaveBeenCalled();
  });

  it.each([{ paths: ['a.ts', 'a.ts'] }, { paths: ['a.ts', 'A.ts'] }, { paths: [] }])(
    'rejects duplicate aliases or empty sets %j',
    ({ paths }) => {
      expect(() => stage(paths)).toThrow('preapproval material');
      expect(mkdtempSync).not.toHaveBeenCalled();
    },
  );

  it('rejects directories and missing source files without recursively copying', () => {
    source('nested/a.ts');
    expectFailedStageCleanedUp(() => stage(['nested']));
    expectFailedStageCleanedUp(() => stage(['missing.ts']));
  });

  it.each(['leaf', 'parent', 'root', 'root-parent'])('rejects %s symlinks', (kind) => {
    source('nested/a.ts');
    let paths = ['link/a.ts'];
    let sourceRoot = root;
    if (kind === 'leaf') {
      symlinkSync(join(root, 'nested/a.ts'), join(root, 'link'));
      paths = ['link'];
    } else {
      symlinkSync(join(root, 'nested'), join(root, 'link'));
      if (kind === 'root') {
        sourceRoot = join(root, 'link');
        paths = ['a.ts'];
      } else if (kind === 'root-parent') {
        source('nested/deeper/a.ts');
        sourceRoot = join(root, 'link/deeper');
        paths = ['a.ts'];
      }
    }
    expect(() => stagePreapprovalMaterial({ sourceRoot, paths })).toThrow('staging failed');
  });

  it('binds both file names and bytes to the manifest and cleans digest mismatch failures', () => {
    source('a.ts', 'one');
    source('b.ts', 'one');
    const first = stage(['a.ts']);
    expect(stage(['b.ts']).manifestDigest).not.toEqual(first.manifestDigest);
    source('a.ts', 'two');
    expect(stage(['a.ts']).manifestDigest).not.toEqual(first.manifestDigest);
    expectFailedStageCleanedUp(() => stage(['a.ts'], first.manifestDigest));
  });

  it.each(['source', 'stage'])('detects same-length byte tampering in %s', (target) => {
    source('a.ts', 'one');
    const material = stage(['a.ts']);
    actualFs.writeFileSync(
      join(target === 'source' ? root : material.stagedSourceRoot, 'a.ts'),
      'two',
    );
    expect(() => material.verify()).toThrow('verification failed');
  });

  it.each(['extra-file', 'empty-directory', 'missing-file', 'symlink'])(
    'rejects staged tree change %s',
    (change) => {
      source('a.ts');
      const material = stage(['a.ts']);
      if (change === 'extra-file')
        actualFs.writeFileSync(join(material.stagedSourceRoot, 'extra'), 'extra');
      if (change === 'empty-directory') mkdirSync(join(material.stagedSourceRoot, 'extra'));
      if (change === 'missing-file' || change === 'symlink')
        rmSync(join(material.stagedSourceRoot, 'a.ts'));
      if (change === 'symlink')
        symlinkSync(join(root, 'a.ts'), join(material.stagedSourceRoot, 'a.ts'));
      expect(() => material.verify()).toThrow('verification failed');
    },
  );

  it('checks the staged exact file set before returning and cleans up a failed verification', () => {
    source('a.ts');
    vi.mocked(writeFileSync).mockImplementationOnce((path, bytes, options) => {
      actualFs.writeFileSync(path, bytes, options);
      actualFs.writeFileSync(join(dirname(String(path)), 'unexpected'), 'extra');
    });
    expectFailedStageCleanedUp(() => stage(['a.ts']));
  });

  it('checks source bytes again before returning and cleans up source changes during staging', () => {
    source('a.ts', 'one');
    vi.mocked(writeFileSync).mockImplementationOnce((path, bytes, options) => {
      actualFs.writeFileSync(path, bytes, options);
      actualFs.writeFileSync(join(root, 'a.ts'), 'two');
    });
    expectFailedStageCleanedUp(() => stage(['a.ts']));
  });

  it('cleans up partial writes and does not expose underlying errors or file contents', () => {
    source('a.ts');
    vi.mocked(writeFileSync).mockImplementationOnce(() => {
      throw new Error('sensitive fixture content');
    });
    expectFailedStageCleanedUp(() => stage(['a.ts']));
  });

  it('bounds file count and cumulative byte size', () => {
    expect(() => stage(Array.from({ length: 1025 }, (_, index) => `${index}.ts`))).toThrow(
      'file count',
    );
    expect(mkdtempSync).not.toHaveBeenCalled();
    source('a.bin', '');
    truncateSync(join(root, 'a.bin'), 16 * 1024 * 1024);
    source('b.bin', 'x');
    expectFailedStageCleanedUp(() => stage(['a.bin', 'b.bin']));
    truncateSync(join(root, 'a.bin'), 16 * 1024 * 1024 + 1);
    expectFailedStageCleanedUp(() => stage(['a.bin']));
  });
});
