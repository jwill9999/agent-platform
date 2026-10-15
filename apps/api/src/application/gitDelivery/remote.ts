import { createHash } from 'node:crypto';
import type { GitDeliveryAction, GitDeliveryReceipt } from '@agent-platform/contracts';
import { git, type GitDeliveryMaterial } from './repository.js';
import { runGitDeliveryCommand } from './process.js';
import { GitDeliveryError, type GitDeliveryRemoteMaterial } from './types.js';

type RemoteAction = Extract<GitDeliveryAction, { kind: 'push' | 'pull_request' }>;

const fields = 'number,url,headRefName,baseRefName,title,body,isDraft';
const shaPattern = /^[0-9a-f]{40}$/;
const zero = '0'.repeat(40);
function unsupported(): never {
  throw new GitDeliveryError(
    'GIT_DELIVERY_REMOTE_UNSUPPORTED',
    'Use one unambiguous GitHub remote with the standard branch fetch mapping and no URL rewriting or mirror push.',
  );
}
function slugFor(endpoint: string): string {
  const match =
    /^(?:git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._-]*?)(?:\.git)?$/.exec(
      endpoint,
    );
  if (!match?.[1] || match[1].includes('..')) return unsupported();
  return match[1];
}
async function configuration(
  root: string,
  action: RemoteAction,
  branch: string,
  signal: AbortSignal,
) {
  const entries = (await git(root, ['config', '--null', '--list'], signal))
    .split('\0')
    .filter(Boolean)
    .map((item) => {
      const separator = item.indexOf('\n');
      return [item.slice(0, separator), item.slice(separator + 1)] as const;
    });
  const all = (key: string) => entries.filter(([name]) => name === key).map(([, value]) => value);
  const one = (key: string) => {
    const values = all(key);
    if (values.length > 1) unsupported();
    return values[0];
  };
  if (entries.some(([key]) => /^url\..*\.(?:insteadof|pushinsteadof)$/.test(key))) unsupported();
  const name =
    action.kind === 'push' && action.mode === 'push' ? one(`branch.${branch}.remote`) : 'origin';
  if (!name || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)) unsupported();
  const ref =
    action.kind === 'push' && action.mode === 'push'
      ? one(`branch.${branch}.merge`)
      : `refs/heads/${branch}`;
  if (
    !ref ||
    !ref.startsWith('refs/heads/') ||
    ['main', 'master', 'staging'].includes(ref.slice(11))
  )
    unsupported();
  await git(root, ['check-ref-format', ref], signal);
  const pushRemote = one(`branch.${branch}.pushremote`) ?? one('remote.pushdefault');
  if (pushRemote && pushRemote !== name) unsupported();
  if (
    all(`remote.${name}.push`).length ||
    !['false', undefined].includes(one(`remote.${name}.mirror`))
  )
    unsupported();
  const urls = all(`remote.${name}.url`);
  const pushes = all(`remote.${name}.pushurl`);
  if (urls.length !== 1 || pushes.length > 1) unsupported();
  const endpoint = pushes[0] ?? urls[0]!;
  const repositorySlug = slugFor(endpoint);
  if (
    entries.some(([key]) => key.startsWith(`remote.${endpoint}.`)) ||
    (await git(root, ['ls-remote', '--get-url', '--', endpoint], signal)).trim() !== endpoint
  )
    unsupported();
  // PR lookup and push must address the same repository, even when fetch/push URLs differ in syntax.
  if (slugFor(urls[0]!) !== repositorySlug) unsupported();
  if (
    JSON.stringify(all(`remote.${name}.fetch`)) !==
    JSON.stringify([`+refs/heads/*:refs/remotes/${name}/*`])
  )
    unsupported();
  const trackingRef = `refs/remotes/${name}/${ref.slice(11)}`;
  await git(root, ['check-ref-format', trackingRef], signal);
  const relevant = entries
    .filter(
      ([key]) =>
        key.startsWith(`remote.${name}.`) ||
        key.startsWith(`branch.${branch}.`) ||
        key === 'remote.pushdefault',
    )
    .sort(([a], [b]) => a.localeCompare(b));
  return {
    name,
    endpoint,
    repositorySlug,
    ref,
    trackingRef,
    configuration: createHash('sha256').update(JSON.stringify(relevant)).digest('hex'),
  };
}
export async function remoteTip(
  root: string,
  endpoint: string,
  ref: string,
  signal: AbortSignal,
): Promise<string> {
  const rows = (await git(root, ['ls-remote', '--refs', '--', endpoint, ref], signal))
    .trim()
    .split('\n')
    .filter(Boolean);
  if (!rows.length) return '';
  if (rows.length !== 1) unsupported();
  const [sha, actualRef] = rows[0]!.split('\t');
  if (!sha || !shaPattern.test(sha) || actualRef !== ref) unsupported();
  return sha;
}
async function readTracking(root: string, ref: string, signal: AbortSignal): Promise<string> {
  const output = await git(
    root,
    ['for-each-ref', '--format=%(refname)%09%(objectname)%09%(symref)', ref],
    signal,
  );
  const rows = output.split('\n').filter((row) => row.split('\t')[0] === ref);
  if (!rows.length) return zero;
  const [, tip, symbolic] = rows[0]!.split('\t');
  if (rows.length !== 1 || !tip || !shaPattern.test(tip) || symbolic) unsupported();
  return tip;
}
export async function inspectRemote(
  material: GitDeliveryMaterial,
  action: RemoteAction,
  signal: AbortSignal,
): Promise<GitDeliveryRemoteMaterial> {
  const config = await configuration(material.root, action, material.branch, signal);
  const tip = await remoteTip(material.root, config.endpoint, config.ref, signal);
  if (action.kind === 'push' && action.mode === 'push' && !tip)
    throw new GitDeliveryError(
      'GIT_DELIVERY_UPSTREAM_MISSING',
      'The reviewed upstream branch is missing. Prepare a publish operation instead.',
    );
  const trackingTip = await readTracking(material.root, config.trackingRef, signal);
  let baseTip: string | undefined;
  if (action.kind === 'pull_request') {
    await git(material.root, ['check-ref-format', `refs/heads/${action.baseBranch}`], signal);
    if (action.baseBranch === material.branch || tip !== material.head)
      throw new GitDeliveryError(
        'GIT_DELIVERY_PUBLISH_REQUIRED',
        'Publish the exact reviewed branch tip before opening a pull request against a different base.',
      );
    baseTip = await remoteTip(
      material.root,
      config.endpoint,
      `refs/heads/${action.baseBranch}`,
      signal,
    );
    if (!baseTip)
      throw new GitDeliveryError(
        'GIT_DELIVERY_BASE_MISSING',
        'Choose an existing remote base branch.',
      );
  }
  return { ...config, trackingTip, remoteTip: tip, ...(baseTip ? { baseTip } : {}) };
}
export async function recheckRemoteConfiguration(
  material: GitDeliveryMaterial,
  action: RemoteAction,
  signal: AbortSignal,
): Promise<void> {
  const actual = await configuration(material.root, action, material.branch, signal);
  if (
    !material.remote ||
    actual.configuration !== material.remote.configuration ||
    actual.endpoint !== material.remote.endpoint ||
    actual.ref !== material.remote.ref
  )
    throw new GitDeliveryError(
      'GIT_DELIVERY_STALE',
      'Remote configuration changed. Prepare a fresh review.',
    );
}
export async function pushReviewed(
  material: GitDeliveryMaterial,
  signal: AbortSignal,
): Promise<void> {
  const remote = material.remote!;
  await git(
    material.root,
    [
      '-c',
      'push.followTags=false',
      '-c',
      'push.recurseSubmodules=no',
      'push',
      '--porcelain',
      '--no-follow-tags',
      '--recurse-submodules=no',
      '--',
      remote.endpoint,
      `${material.head}:${remote.ref}`,
    ],
    signal,
  );
}
export async function synchroniseTracking(
  material: GitDeliveryMaterial,
  action: RemoteAction,
  signal: AbortSignal,
  authorise: () => Promise<void> = async () => {},
): Promise<string | undefined> {
  try {
    await recheckRemoteConfiguration(material, action, signal);
    const remote = material.remote!;
    if ((await readTracking(material.root, remote.trackingRef, signal)) !== remote.trackingTip)
      throw new Error('tracking changed');
    await authorise();
    await git(
      material.root,
      ['update-ref', '--no-deref', remote.trackingRef, material.head, remote.trackingTip],
      signal,
    );
    if (action.kind === 'push' && action.mode === 'publish') {
      await authorise();
      await git(material.root, ['config', `branch.${material.branch}.remote`, remote.name], signal);
      const stillBound = await configuration(material.root, action, material.branch, signal);
      if (stillBound.endpoint !== remote.endpoint || stillBound.ref !== remote.ref)
        throw new Error('changed');
      await authorise();
      await git(material.root, ['config', `branch.${material.branch}.merge`, remote.ref], signal);
      const upstream = (
        await git(
          material.root,
          ['for-each-ref', '--format=%(upstream)', `refs/heads/${material.branch}`],
          signal,
        )
      ).trim();
      if (upstream !== remote.trackingRef) throw new Error('upstream changed');
    }
  } catch {
    return 'The remote branch was updated, but local tracking or upstream configuration could not be refreshed. Inspect it with your Git client before continuing.';
  }
}
const gh = (root: string, args: string[], signal: AbortSignal) =>
  runGitDeliveryCommand(process.env.AGENT_PLATFORM_GH_BINARY ?? 'gh', args, root, signal);
export const requireGhAuthentication = (root: string, signal: AbortSignal) =>
  gh(root, ['auth', 'status'], signal);
function prArgs(
  material: GitDeliveryMaterial,
  action: Extract<RemoteAction, { kind: 'pull_request' }>,
) {
  return [
    '--repo',
    material.remote!.repositorySlug,
    '--head',
    material.branch,
    '--base',
    action.baseBranch,
  ];
}
function prIdentity(
  raw: unknown,
  slug: string,
): { pullRequestUrl: string; pullRequestNumber: number } | undefined {
  if (typeof raw !== 'string') return undefined;
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/([1-9]\d*)$/.exec(raw.trim());
  if (!match || match[1] !== slug || !Number.isSafeInteger(Number(match[2]))) return undefined;
  return { pullRequestUrl: raw.trim(), pullRequestNumber: Number(match[2]) };
}
export async function matchingPullRequest(
  material: GitDeliveryMaterial,
  action: Extract<RemoteAction, { kind: 'pull_request' }>,
  signal: AbortSignal,
): Promise<GitDeliveryReceipt['result'] | undefined> {
  const value: unknown = JSON.parse(
    await gh(
      material.root,
      ['pr', 'list', ...prArgs(material, action), '--state', 'open', '--json', fields],
      signal,
    ),
  );
  if (!Array.isArray(value) || value.length > 1)
    throw new GitDeliveryError(
      'GIT_DELIVERY_PR_AMBIGUOUS',
      'Pull request evidence is ambiguous. Inspect it before continuing.',
    );
  if (!value.length) return undefined;
  const row = value[0] as Record<string, unknown>;
  const identity = prIdentity(row.url, material.remote!.repositorySlug);
  if (
    !identity ||
    row.number !== identity.pullRequestNumber ||
    row.headRefName !== material.branch ||
    row.baseRefName !== action.baseBranch ||
    row.title !== action.title ||
    row.body !== action.body ||
    row.isDraft !== action.draft
  )
    throw new GitDeliveryError(
      'GIT_DELIVERY_PR_EXISTS',
      'A pull request already exists with different reviewed details. Inspect it instead of creating another.',
    );
  return identity;
}
export async function createReviewedPullRequest(
  material: GitDeliveryMaterial,
  action: Extract<RemoteAction, { kind: 'pull_request' }>,
  signal: AbortSignal,
): Promise<NonNullable<GitDeliveryReceipt['result']>> {
  const output = await gh(
    material.root,
    [
      'pr',
      'create',
      ...prArgs(material, action),
      '--title',
      action.title,
      '--body',
      action.body,
      ...(action.draft ? ['--draft'] : []),
    ],
    signal,
  );
  const identity = prIdentity(output, material.remote!.repositorySlug);
  if (!identity)
    throw new GitDeliveryError(
      'GIT_DELIVERY_PR_UNVERIFIED',
      'The pull request response could not be verified. Inspect its recorded outcome.',
    );
  return identity;
}
