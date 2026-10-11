import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { TrustedSourceGit } from './sourceGit.js';
import { assertBootstrapExecutablePin } from './bootstrapAdapterRuntime.js';

export const REVIEW_TEXT_LIMIT = 2_000_000;
export const REVIEW_SKILL_NAMESPACE = 'review-skill-evidence';
const skillPath = /^\.agents\/skills\/[a-z0-9][a-z0-9-]*\/SKILL\.md$/u;

export function isReviewSkillPath(path: string): boolean {
  return skillPath.test(path);
}

export function validateReviewText(bytes: Uint8Array, total: number): string {
  if (total > REVIEW_TEXT_LIMIT) throw new Error('review evidence exceeds input limit');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\0')) throw new Error('review evidence must be text without NUL');
  return text;
}

/** Read immutable committed blobs, never live skill contents or their scripts/configuration. */
export function captureCommittedReviewSkills(root: string, paths: readonly string[]) {
  if (paths.length === 0) return [];
  if (
    paths.length > 128 ||
    new Set(paths).size !== paths.length ||
    paths.some((path) => !isReviewSkillPath(path))
  )
    throw new Error('review skill selection must name exact SKILL.md files');
  const git = new TrustedSourceGit(root, process.env.WORKFLOW_GIT_BINARY ?? '/usr/bin/git');
  // Never invoke repository-configured transports, even for missing promised objects.
  // GIT_ALLOW_PROTOCOL is an overriding allowlist; an empty list denies every protocol.
  const read = (args: string[]) => {
    assertBootstrapExecutablePin(git.pin);
    return execFileSync(
      git.pin.path,
      [
        '--no-replace-objects',
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'core.fsmonitor=false',
        ...args,
      ],
      {
        cwd: root,
        env: {
          PATH: `${dirname(git.pin.path)}:/usr/bin:/bin`,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_TERMINAL_PROMPT: '0',
          GIT_NO_LAZY_FETCH: '1',
          GIT_ALLOW_PROTOCOL: '',
        },
        timeout: 10000,
        maxBuffer: REVIEW_TEXT_LIMIT + 4096,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
  };
  if (read(['rev-parse', '--show-toplevel']).toString().trim() !== root)
    throw new Error('review skill source must be the repository root');
  const revision = read(['rev-parse', '--verify', 'HEAD^{commit}']).toString().trim();
  if (!/^[a-f0-9]{40,64}$/u.test(revision)) throw new Error('review source revision is invalid');
  let total = 0;
  return paths.map((path) => {
    const entry = read(['ls-tree', '-z', revision, '--', path]).toString();
    const match = /^(100644|100755) blob ([a-f0-9]{40,64})\t([^\0]+)\0$/u.exec(entry);
    if (!match || match[3] !== path)
      throw new Error('review skill must be a committed regular file');
    const oid = match[2]!;
    const size = Number(read(['cat-file', '-s', oid]).toString().trim());
    if (!Number.isSafeInteger(size) || size < 0 || size > REVIEW_TEXT_LIMIT - total)
      throw new Error('review evidence exceeds input limit');
    const bytes = read(['cat-file', 'blob', oid]);
    if (bytes.length !== size) throw new Error('review skill blob size changed');
    total += bytes.length;
    validateReviewText(bytes, total);
    return {
      path,
      stagedPath: `${REVIEW_SKILL_NAMESPACE}/${createHash('sha256').update(path).digest('hex')}.txt`,
      sourceRevision: revision,
      bytes,
    };
  });
}

/** Empty private allocation for skill-only reviews; no source directory is copied. */
export async function createSkillReviewWorkspace() {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'workflow-review-')));
  try {
    const root = join(parent, 'workspace'),
      codexHome = join(parent, 'codex-home');
    await mkdir(root, { mode: 0o700 });
    await mkdir(codexHome, { mode: 0o700 });
    await writeFile(join(codexHome, 'auth.json'), '{}\n', { mode: 0o600, flag: 'wx' });
    return { root, codexHome };
  } catch (error) {
    await rm(parent, { recursive: true, force: true });
    throw error;
  }
}
