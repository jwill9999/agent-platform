import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, open, readlink, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { GitDeliveryAction } from '@agent-platform/contracts';
import { gitDeliveryEnvironment, runGitDeliveryCommand } from './process.js';
import { GitDeliveryError, type GitDeliveryRemoteMaterial } from './types.js';

export interface GitDeliveryMaterial {
  remote?: GitDeliveryRemoteMaterial;
  root: string;
  workspaceRoot: string;
  branch: string;
  head: string;
  indexTree: string;
  indexEntries: string;
  repositoryIdentity: string;
  selectedFingerprint?: string;
  expectedIndexTree?: string;
  expectedIndexEntries?: string;
}
export const git = (root: string, args: string[], signal: AbortSignal, env?: NodeJS.ProcessEnv) =>
  runGitDeliveryCommand(
    '/usr/bin/git',
    ['--literal-pathspecs', '-C', root, ...args],
    root,
    signal,
    env,
  );
export function within(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}
export function normaliseGitDeliveryPaths(paths: string[]): string[] {
  const checked = paths.map((value) => {
    if (
      path.isAbsolute(value) ||
      value.includes('\0') ||
      value.split('/').some((part) => part === '..' || part.toLowerCase() === '.git') ||
      path.posix.normalize(value) !== value ||
      value === '.'
    ) {
      throw new GitDeliveryError(
        'GIT_DELIVERY_PATH_INVALID',
        'Select literal files within this Project.',
        400,
      );
    }
    return value;
  });
  return [...new Set(checked)].sort();
}
async function verifyParent(root: string, selected: string): Promise<void> {
  let parent = path.dirname(path.join(root, selected));
  for (;;) {
    try {
      if (!within(root, await realpath(parent)))
        throw new GitDeliveryError(
          'GIT_DELIVERY_PATH_ESCAPE',
          'The selected file leaves this Project.',
          403,
        );
      return;
    } catch (error) {
      if (error instanceof GitDeliveryError) throw error;
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || parent === root)
        throw new GitDeliveryError(
          'GIT_DELIVERY_PATH_UNAVAILABLE',
          'The selected file cannot be inspected.',
          409,
        );
      parent = path.dirname(parent);
    }
  }
}
export async function selectedFingerprint(
  root: string,
  paths: string[],
  signal: AbortSignal,
): Promise<string> {
  const records: Array<Record<string, unknown>> = [];
  let bytes = 0;
  for (const selected of paths) {
    signal.throwIfAborted();
    await verifyParent(root, selected);
    const file = path.join(root, selected);
    const stat = await lstat(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw new GitDeliveryError(
        'GIT_DELIVERY_PATH_UNAVAILABLE',
        'The selected file cannot be inspected.',
        409,
      );
    });
    if (!stat) {
      records.push({ path: selected, type: 'deleted' });
      continue;
    }
    if (stat.isSymbolicLink()) {
      records.push({ path: selected, type: 'link', target: await readlink(file) });
      continue;
    }
    if (!stat.isFile())
      throw new GitDeliveryError(
        'GIT_DELIVERY_FILE_REQUIRED',
        'Select individual regular files or symlinks, not directories.',
        400,
      );
    const contentHash = createHash('sha256');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const actual = await handle.stat();
      if (!actual.isFile() || actual.ino !== stat.ino || actual.dev !== stat.dev)
        throw new GitDeliveryError(
          'GIT_DELIVERY_STALE',
          'Selected file changed while it was being reviewed.',
        );
      for await (const chunk of handle.createReadStream({ autoClose: false, signal })) {
        bytes += (chunk as Buffer).length;
        if (bytes > 64 * 1024 * 1024)
          throw new GitDeliveryError(
            'GIT_DELIVERY_SELECTION_TOO_LARGE',
            'Select at most 64 MiB of file content per review.',
            409,
          );
        contentHash.update(chunk as Buffer);
      }
    } finally {
      await handle.close();
    }
    records.push({
      path: selected,
      type: 'file',
      executable: stat.mode & 0o111,
      digest: contentHash.digest('hex'),
    });
  }
  return createHash('sha256').update(JSON.stringify(records)).digest('hex');
}
export function indexPaths(entries: string): string[] {
  return [
    ...new Set(
      entries
        .split('\0')
        .filter(Boolean)
        .map((line) => line.slice(line.indexOf('\t') + 1)),
    ),
  ].sort();
}
export function selectedIndexEntries(entries: string, paths: string[]): string {
  return entries
    .split('\0')
    .filter((line) => line && paths.includes(line.slice(line.indexOf('\t') + 1)))
    .sort()
    .join('\0');
}
export async function inspectGitDeliveryRepository(
  root: string,
  workspaceRoot: string,
  action: GitDeliveryAction,
  signal: AbortSignal,
): Promise<GitDeliveryMaterial> {
  if (!within(workspaceRoot, root))
    throw new GitDeliveryError(
      'GIT_DELIVERY_ROOT_ESCAPE',
      'Repository must remain within its approved Project.',
      403,
    );
  const top = (await git(root, ['rev-parse', '--show-toplevel'], signal)).trim();
  const gitDirectory = await lstat(path.join(root, '.git')).catch(() => undefined);
  if ((await realpath(top)) !== root || !gitDirectory?.isDirectory())
    throw new GitDeliveryError(
      'GIT_DELIVERY_LAYOUT_UNSUPPORTED',
      'This delivery flow requires a regular repository at the approved Project root.',
      409,
    );
  for (const state of [
    'MERGE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
    'BISECT_LOG',
    'rebase-apply',
    'rebase-merge',
    'sequencer',
  ]) {
    const exists = await lstat(path.join(root, '.git', state)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return undefined;
        throw new GitDeliveryError(
          'GIT_DELIVERY_STATE_UNAVAILABLE',
          'Repository operation state cannot be inspected.',
        );
      },
    );
    if (exists)
      throw new GitDeliveryError(
        'GIT_DELIVERY_OPERATION_IN_PROGRESS',
        'Finish the existing merge, rebase, cherry-pick or bisect before delivery.',
      );
  }
  const branch = (await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], signal)).trim();
  if (!branch || ['main', 'master', 'staging'].includes(branch))
    throw new GitDeliveryError(
      'GIT_DELIVERY_BRANCH_PROTECTED',
      'Select an existing working branch before delivery.',
      409,
    );
  const head = (await git(root, ['rev-parse', '--verify', 'HEAD^{commit}'], signal)).trim();
  if ((await git(root, ['ls-files', '-u', '-z'], signal)) !== '')
    throw new GitDeliveryError(
      'GIT_DELIVERY_CONFLICT',
      'Resolve existing conflicts before delivery.',
      409,
    );
  if ((await git(root, ['rev-parse', '--shared-index-path'], signal)).trim()) {
    throw new GitDeliveryError(
      'GIT_DELIVERY_INDEX_UNSUPPORTED',
      'Split indexes are not supported by this bounded delivery flow.',
    );
  }
  const indexEntries = await git(root, ['ls-files', '--stage', '-z'], signal);
  const flags = await git(root, ['ls-files', '-v', '-z'], signal);
  const debug = await git(root, ['ls-files', '--debug', '-z'], signal);
  if (
    flags.split('\0').some((entry) => entry && !entry.startsWith('H ')) ||
    [...debug.matchAll(/flags: ([0-9a-f]+)/g)].some((match) => match[1] !== '0')
  ) {
    throw new GitDeliveryError(
      'GIT_DELIVERY_INDEX_UNSUPPORTED',
      'Resolve sparse, intent-to-add or special index flags before delivery.',
      409,
    );
  }
  // Fresh managed runtimes may configure a temporary parent that has not been created yet.
  const temporaryParent = tmpdir();
  await mkdir(temporaryParent, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(temporaryParent, 'agent-platform-git-review-'));
  let indexTree: string;
  try {
    const original = path.join(root, '.git', 'index');
    if (!(await lstat(original)).isFile())
      throw new GitDeliveryError(
        'GIT_DELIVERY_INDEX_UNSUPPORTED',
        'The repository index layout is unsupported.',
      );
    const copied = path.join(directory, 'index');
    await copyFile(original, copied);
    const env = { ...gitDeliveryEnvironment(), GIT_INDEX_FILE: copied };
    if ((await git(root, ['ls-files', '--stage', '-z'], signal, env)) !== indexEntries)
      throw new GitDeliveryError('GIT_DELIVERY_STALE', 'Index changed during review.');
    // Git may write a cache-tree extension: use only the owned copy. Git objects may be added, never refs/index/worktree effects.
    indexTree = (await git(root, ['write-tree'], signal, env)).trim();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  if (action.kind === 'commit') {
    const staged = (
      await git(root, ['diff', '--cached', '--name-only', '-z', '--no-renames'], signal)
    )
      .split('\0')
      .filter(Boolean)
      .sort();
    if (staged.length === 0)
      throw new GitDeliveryError(
        'GIT_DELIVERY_NOTHING_STAGED',
        'Stage changes before committing.',
        409,
      );
    if (JSON.stringify(staged) !== JSON.stringify(action.paths))
      throw new GitDeliveryError(
        'GIT_DELIVERY_INDEX_SELECTION',
        'Confirm every currently staged file before committing. Unstage unrelated changes explicitly.',
        409,
        { stagedPaths: staged },
      );
  }
  const rootStat = await lstat(root);
  const repositoryIdentity = `${rootStat.dev}:${rootStat.ino}:${gitDirectory.dev}:${gitDirectory.ino}`;
  return {
    root,
    workspaceRoot,
    branch,
    head,
    indexTree,
    indexEntries,
    repositoryIdentity,
    ...(action.kind === 'stage'
      ? { selectedFingerprint: await selectedFingerprint(root, action.paths, signal) }
      : {}),
  };
}
export async function currentRepositoryIdentity(root: string): Promise<string | undefined> {
  try {
    const [rootStat, gitStat] = await Promise.all([lstat(root), lstat(path.join(root, '.git'))]);
    if (!rootStat.isDirectory() || !gitStat.isDirectory() || (await realpath(root)) !== root)
      return undefined;
    return `${rootStat.dev}:${rootStat.ino}:${gitStat.dev}:${gitStat.ino}`;
  } catch {
    return undefined;
  }
}

export function sameReviewedMaterial(a: GitDeliveryMaterial, b: GitDeliveryMaterial): boolean {
  return (
    a.root === b.root &&
    a.workspaceRoot === b.workspaceRoot &&
    a.branch === b.branch &&
    a.head === b.head &&
    a.indexTree === b.indexTree &&
    a.indexEntries === b.indexEntries &&
    a.selectedFingerprint === b.selectedFingerprint &&
    a.repositoryIdentity === b.repositoryIdentity &&
    JSON.stringify(a.remote) === JSON.stringify(b.remote)
  );
}
