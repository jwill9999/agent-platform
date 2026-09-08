import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve, win32 } from 'node:path';

const maxFiles = 1024;
const maxBytes = 16 * 1024 * 1024;
const blockedComponents = new Set([
  '.git',
  '.beads',
  '.ssh',
  '.codex',
  '.agents',
  '.aws',
  '.azure',
  '.gnupg',
  '.gitconfig',
  '.git-credentials',
  '.npmrc',
  '.netrc',
  'auth.json',
]);

export interface PreapprovalMaterialEntry {
  readonly path: string;
  readonly sizeBytes: number;
  readonly digest: string;
}

export interface PreapprovalMaterial {
  readonly stagedSourceRoot: string;
  readonly manifest: readonly PreapprovalMaterialEntry[];
  readonly manifestDigest: string;
  /** Recheck both source bytes and the staged tree against the original manifest. */
  verify(): void;
  /** Removes only this operation's private temporary directory. Idempotent. */
  cleanup(): void;
}

function digest(bytes: Uint8Array | string): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function removeStage(root: string): void {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    throw new Error('preapproval material cleanup failed');
  }
}

function validatePaths(paths: readonly string[]): string[] {
  if (paths.length === 0 || paths.length > maxFiles)
    throw new Error('preapproval material file count is invalid');
  const unique = new Set<string>();
  for (const path of paths) {
    if (
      typeof path !== 'string' ||
      isAbsolute(path) ||
      win32.isAbsolute(path) ||
      /[\\:\r\n\0]/u.test(path) ||
      path.length > 4096
    )
      throw new Error('preapproval material path is invalid');
    const parts = path.split('/');
    if (
      parts.some((part) => {
        const lower = part.toLowerCase();
        return (
          part === '' ||
          part === '.' ||
          part === '..' ||
          blockedComponents.has(lower) ||
          lower.startsWith('.env')
        );
      })
    )
      throw new Error('preapproval material path is prohibited');
    // Case aliases also collide on common macOS and Windows filesystems.
    const key = path.toLowerCase();
    if (unique.has(key)) throw new Error('preapproval material paths contain duplicates');
    unique.add(key);
  }
  // Preserve UTF-16 code-unit ordering independently of the host's locale.
  return [...paths].sort((left, right) => {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });
}

function assertRoot(root: string): void {
  if (
    !isAbsolute(root) ||
    resolve(root) !== root ||
    realpathSync(root) !== root ||
    !lstatSync(root).isDirectory()
  )
    throw new Error('preapproval material root must be a canonical directory');
}

function readRegularFile(root: string, path: string, byteBudget: number): Buffer {
  assertRoot(root);
  let current = root;
  const parts = path.split('/');
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    if (!lstatSync(current).isDirectory())
      throw new Error('preapproval material parent must be a regular directory');
  }
  const file = join(root, path);
  if (!lstatSync(file).isFile())
    throw new Error('preapproval material must contain only regular files');
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size > byteBudget)
      throw new Error('preapproval material file type or byte limit is invalid');
    // One additional byte detects growth without allowing unbounded readFile allocation.
    const bytes = Buffer.alloc(before.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const after = fstatSync(fd);
    if (offset !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs)
      throw new Error('preapproval material changed while reading');
    return bytes.subarray(0, offset);
  } finally {
    closeSync(fd);
  }
}

function verifyTree(root: string, manifest: readonly PreapprovalMaterialEntry[]): void {
  const expected = new Set(manifest.map((entry) => entry.path));
  const directories = new Set<string>();
  for (const path of expected) {
    for (let parent = dirname(path); parent !== '.'; parent = dirname(parent))
      directories.add(parent);
  }
  const visit = (relative: string): void => {
    for (const name of readdirSync(join(root, relative))) {
      const path = relative === '' ? name : `${relative}/${name}`;
      const stat = lstatSync(join(root, path));
      if (stat.isDirectory() && directories.delete(path)) visit(path);
      else if (!stat.isFile() || !expected.delete(path))
        throw new Error('preapproval material staged file set mismatch');
    }
  };
  assertRoot(root);
  visit('');
  if (expected.size !== 0 || directories.size !== 0)
    throw new Error('preapproval material staged file set mismatch');
}

/**
 * Exact, explicitly enumerated material only; no execution or approval authority.
 * Limits: 1,024 files and 16 MiB total. Files use 0600 and directories use 0700.
 * Paths block known credential/control locations; arbitrary source bytes are not a secret scanner.
 * The caller owns cleanup. verify() must be called again before consuming the returned paths.
 * Requires a trusted, quiescent host filesystem: checks cannot prevent concurrent ancestor/inode
 * replacement or changes after verification. This is not a malicious-host isolation boundary.
 */
export function stagePreapprovalMaterial(input: {
  sourceRoot: string;
  paths: readonly string[];
  expectedManifestDigest?: string;
}): PreapprovalMaterial {
  const paths = validatePaths(input.paths);
  const sourceRoot = input.sourceRoot;
  let stagedSourceRoot: string | undefined;
  try {
    assertRoot(sourceRoot);
    stagedSourceRoot = mkdtempSync(join(realpathSync(tmpdir()), 'workflow-preapproval-'));
    chmodSync(stagedSourceRoot, 0o700);
    const stage = stagedSourceRoot;
    const manifest: PreapprovalMaterialEntry[] = [];
    let remaining = maxBytes;
    for (const path of paths) {
      const bytes = readRegularFile(sourceRoot, path, remaining);
      remaining -= bytes.length;
      mkdirSync(dirname(join(stage, path)), { recursive: true, mode: 0o700 });
      writeFileSync(join(stage, path), bytes, { flag: 'wx', mode: 0o600 });
      manifest.push(Object.freeze({ path, sizeBytes: bytes.length, digest: digest(bytes) }));
    }
    Object.freeze(manifest);
    // Sorted paths plus byte lengths and SHA-256 byte digests form an unambiguous versioned manifest.
    const manifestDigest = digest(JSON.stringify({ version: 1, files: manifest }));
    if (
      input.expectedManifestDigest !== undefined &&
      input.expectedManifestDigest !== manifestDigest
    )
      throw new Error('preapproval material manifest digest mismatch');
    const verify = (): void => {
      try {
        verifyTree(stage, manifest);
        for (const entry of manifest) {
          for (const root of [sourceRoot, stage]) {
            const bytes = readRegularFile(root, entry.path, entry.sizeBytes);
            if (bytes.length !== entry.sizeBytes || digest(bytes) !== entry.digest)
              throw new Error('byte mismatch');
          }
        }
      } catch {
        throw new Error('preapproval material verification failed');
      }
    };
    verify();
    return Object.freeze({
      stagedSourceRoot: stage,
      manifest,
      manifestDigest,
      verify,
      cleanup: () => removeStage(stage),
    });
  } catch {
    if (stagedSourceRoot !== undefined) removeStage(stagedSourceRoot);
    // Never expose filenames, source contents, or underlying OS error details.
    throw new Error('preapproval material staging failed');
  }
}
