import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import type { ExecutionContract } from './contracts.js';
import { bootstrapDigest, bootstrapPolicySchema } from './bootstrapPolicy.js';

export interface DocumentSourceIdentity {
  canonicalRoot: string;
  commonDirectory: string;
  remoteName: string;
  remoteUrl: string;
}

function git(root: string, args: string[]): string {
  try {
    const executable = process.env.WORKFLOW_GIT_BINARY ?? '/usr/bin/git';
    if (!isAbsolute(executable)) throw new Error('document_git_executable_must_be_absolute');
    return execFileSync(executable, ['-C', root, ...args], {
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: '/usr/bin:/bin',
        HOME: process.env.HOME,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
      },
    }).trim();
  } catch {
    throw new Error('document_source_git_unavailable');
  }
}

function commonDirectory(root: string): string {
  return realpathSync(resolve(root, git(root, ['rev-parse', '--git-common-dir'])));
}

/** Provenance is established from the repository, not accepted from manifest labels. */
export function establishDocumentSource(
  contract: ExecutionContract,
  sourceRoot: string,
  policyInput?: unknown,
): DocumentSourceIdentity {
  const common = commonDirectory(sourceRoot);
  const canonicalRoot = realpathSync(dirname(common));
  if (
    realpathSync(git(sourceRoot, ['rev-parse', '--show-toplevel'])) !== sourceRoot ||
    `sha256:${createHash('sha256').update(canonicalRoot).digest('hex')}` !== contract.workspaceId
  )
    throw new Error('document_workspace_identity_rejected');
  let remoteName = 'origin';
  let approvedUrl: string | undefined;
  if (policyInput !== undefined) {
    const policy = bootstrapPolicySchema.parse(policyInput);
    if (
      bootstrapDigest(policy) !== contract.policyDigest ||
      policy.repository !== contract.authority.github.repository ||
      realpathSync(policy.canonicalRoot) !== canonicalRoot ||
      realpathSync(policy.gitCommonDirectory) !== common ||
      realpathSync(policy.sourceRoot) !== sourceRoot
    )
      throw new Error('document_source_policy_rejected');
    remoteName = policy.remoteName;
    approvedUrl = policy.remoteUrl;
  }
  const remoteUrl = git(canonicalRoot, ['remote', 'get-url', remoteName]);
  const repo = contract.authority.github.repository;
  if (
    approvedUrl === undefined
      ? ![
          `https://github.com/${repo}`,
          `https://github.com/${repo}.git`,
          `git@github.com:${repo}.git`,
          `ssh://git@github.com/${repo}.git`,
        ].includes(remoteUrl)
      : remoteUrl !== approvedUrl
  )
    throw new Error('document_repository_identity_rejected');
  const revision = contract.planningDocuments!.sourceRevision;
  if (git(sourceRoot, ['rev-parse', '--verify', `${revision}^{commit}`]) !== revision)
    throw new Error('document_source_revision_rejected');
  git(sourceRoot, ['merge-base', '--is-ancestor', revision, 'HEAD']);
  return { canonicalRoot, commonDirectory: common, remoteName, remoteUrl };
}

/** Resolve the accepted task ref in the registered repository; never search arbitrary directories. */
export function resolveDocumentSource(
  identity: DocumentSourceIdentity,
  publishedRoot: string,
  taskRef?: string,
): string {
  if (
    commonDirectory(identity.canonicalRoot) !== identity.commonDirectory ||
    git(identity.canonicalRoot, ['remote', 'get-url', identity.remoteName]) !== identity.remoteUrl
  )
    throw new Error('document_repository_identity_changed');
  let sourceRoot = publishedRoot;
  if (taskRef !== undefined) {
    const records = git(identity.canonicalRoot, ['worktree', 'list', '--porcelain']).split('\n\n');
    const candidates = records.filter((record) => record.split('\n').includes(`branch ${taskRef}`));
    if (candidates.length !== 1) throw new Error('document_task_workspace_unavailable');
    const path = candidates[0]!
      .split('\n')
      .find((line) => line.startsWith('worktree '))
      ?.slice(9);
    if (!path) throw new Error('document_task_workspace_unavailable');
    sourceRoot = realpathSync(path);
  }
  if (
    commonDirectory(sourceRoot) !== identity.commonDirectory ||
    realpathSync(git(sourceRoot, ['rev-parse', '--show-toplevel'])) !== sourceRoot
  )
    throw new Error('document_task_workspace_changed');
  return sourceRoot;
}
