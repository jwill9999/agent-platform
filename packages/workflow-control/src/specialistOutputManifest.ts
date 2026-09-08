import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  type BigIntStats,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve, win32 } from 'node:path';

import { z } from 'zod';

import { workflowRoleSchema } from './contracts.js';

const maxEntries = 1024;
const maxBytes = 16 * 1024 * 1024;
const maxDepth = 32;
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const identifier = z.string().min(1).max(256);
const bindingSchema = z
  .object({
    workspaceId: identifier,
    runId: identifier,
    taskId: identifier,
    executionId: identifier,
    role: workflowRoleSchema,
    contractVersion: z.number().int().positive(),
    policyDigest: digestSchema,
    inputMaterialDigest: digestSchema,
    baselineHeadSha: z.string().regex(/^[a-f0-9]{40}$/u),
  })
  .strict();
const grantSchema = z.object({ kind: z.enum(['file', 'subtree']), path: z.string() }).strict();
const forbidden = new Set([
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

export type SpecialistOutputBinding = Readonly<z.infer<typeof bindingSchema>>;
export type SpecialistOutputGrant = Readonly<z.infer<typeof grantSchema>>;
export type SpecialistOutputEntry = Readonly<
  | { path: string; kind: 'file'; mode: number; sizeBytes: number; digest: string }
  | { path: string; kind: 'directory'; mode: number }
>;
export interface SpecialistOutputChange {
  readonly path: string;
  readonly change: 'added' | 'modified' | 'deleted';
  readonly before: SpecialistOutputEntry | null;
  readonly after: SpecialistOutputEntry | null;
}
declare const baselineBrand: unique symbol;
export interface SpecialistOutputBaseline {
  readonly [baselineBrand]: true;
  readonly baselineDigest: string;
  readonly baselineTreeDigest: string;
}
export interface SpecialistOutputCandidate {
  readonly kind: 'specialist_output_candidate';
  readonly binding: SpecialistOutputBinding;
  readonly baselineDigest: string;
  readonly baselineTreeDigest: string;
  readonly outputTreeDigest: string;
  readonly candidateDigest: string;
  readonly changes: readonly SpecialistOutputChange[];
}
interface RootIdentity {
  dev: bigint;
  ino: bigint;
}
interface Tree {
  entries: readonly SpecialistOutputEntry[];
  digest: string;
  observations: string;
  rootIdentity: RootIdentity;
}
interface BaselineState {
  root: string;
  tree: Tree;
  binding: SpecialistOutputBinding;
  grants: readonly SpecialistOutputGrant[];
  digest: string;
}
const baselines = new WeakMap<SpecialistOutputBaseline, BaselineState>();
const candidates = new WeakMap<
  SpecialistOutputCandidate,
  { baseline: BaselineState; tree: Tree }
>();

function hash(value: string | Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
function comparePaths(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
function validatePath(path: string): void {
  if (
    !path ||
    path.length > 4096 ||
    isAbsolute(path) ||
    win32.isAbsolute(path) ||
    /[\\:\r\n\0]/u.test(path)
  )
    throw new Error('invalid path');
  const components = path.split('/');
  if (
    components.length > maxDepth ||
    components.some(
      (part) =>
        !part ||
        part === '.' ||
        part === '..' ||
        forbidden.has(part.toLowerCase()) ||
        part.toLowerCase().startsWith('.env'),
    )
  )
    throw new Error('prohibited path');
}
function aliasKey(path: string): string {
  return path.normalize('NFC').toLowerCase();
}
function parseGrants(input: readonly SpecialistOutputGrant[]): readonly SpecialistOutputGrant[] {
  const parsed = z.array(grantSchema).max(maxEntries).parse(input);
  const seen = new Set<string>();
  for (const grant of parsed) {
    validatePath(grant.path);
    const key = aliasKey(grant.path);
    if (seen.has(key)) throw new Error('duplicate grant');
    seen.add(key);
    Object.freeze(grant);
  }
  return Object.freeze(parsed.sort((a, b) => comparePaths(a.path, b.path)));
}
function metadata(stat: BigIntStats): string {
  return [stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs].join(
    ':',
  );
}
function assertSameMetadata(before: BigIntStats, after: BigIntStats): void {
  if (metadata(before) !== metadata(after)) throw new Error('tree changed during observation');
}
function checkedMode(stat: BigIntStats): number {
  if ((stat.mode & 0o7000n) !== 0n) throw new Error('special permissions');
  return Number(stat.mode & 0o777n);
}
function readCheckedFile(path: string, initial: BigIntStats, budget: number): Buffer {
  if (!initial.isFile() || initial.nlink !== 1n || initial.size > BigInt(budget))
    throw new Error('file type or byte limit');
  const descriptor = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    assertSameMetadata(initial, fstatSync(descriptor, { bigint: true }));
    const bytes = Buffer.alloc(Number(initial.size) + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(descriptor, bytes, length, bytes.length - length, length);
      if (count === 0) break;
      length += count;
    }
    if (BigInt(length) !== initial.size) throw new Error('file size changed');
    assertSameMetadata(initial, fstatSync(descriptor, { bigint: true }));
    assertSameMetadata(initial, lstatSync(path, { bigint: true }));
    return bytes.subarray(0, length);
  } finally {
    closeSync(descriptor);
  }
}

function scanTree(root: string, expectedRoot?: RootIdentity): Tree {
  if (
    !isAbsolute(root) ||
    resolve(root) !== root ||
    dirname(root) === root ||
    realpathSync(root) !== root
  )
    throw new Error('root is not canonical');
  const rootStat = lstatSync(root, { bigint: true });
  if (
    !rootStat.isDirectory() ||
    (expectedRoot !== undefined &&
      (rootStat.dev !== expectedRoot.dev || rootStat.ino !== expectedRoot.ino))
  )
    throw new Error('root identity changed');
  const entries: SpecialistOutputEntry[] = [];
  const observations: Array<[string, string]> = [];
  const aliases = new Set<string>();
  let remaining = maxBytes;
  const visit = (path: string): void => {
    if (entries.length >= maxEntries) throw new Error('entry limit exceeded');
    if (path !== '') validatePath(path);
    const key = aliasKey(path);
    if (aliases.has(key)) throw new Error('path alias');
    aliases.add(key);
    const absolute = join(root, path);
    const stat = lstatSync(absolute, { bigint: true });
    const mode = checkedMode(stat);
    observations.push([path, metadata(stat)]);
    if (stat.isFile()) {
      const bytes = readCheckedFile(absolute, stat, remaining);
      remaining -= bytes.length;
      entries.push(
        Object.freeze({ path, kind: 'file', mode, sizeBytes: bytes.length, digest: hash(bytes) }),
      );
      return;
    }
    if (!stat.isDirectory()) throw new Error('unsupported entry type');
    entries.push(Object.freeze({ path, kind: 'directory', mode }));
    const directory = opendirSync(absolute);
    try {
      for (let entry = directory.readSync(); entry !== null; entry = directory.readSync()) {
        visit(path === '' ? entry.name : `${path}/${entry.name}`);
      }
    } finally {
      directory.closeSync();
    }
    assertSameMetadata(stat, lstatSync(absolute, { bigint: true }));
  };
  visit('');
  assertSameMetadata(rootStat, lstatSync(root, { bigint: true }));
  entries.sort((a, b) => comparePaths(a.path, b.path));
  observations.sort((a, b) => comparePaths(a[0], b[0]));
  return {
    entries: Object.freeze(entries),
    digest: hash(JSON.stringify(entries)),
    observations: JSON.stringify(observations),
    rootIdentity: { dev: rootStat.dev, ino: rootStat.ino },
  };
}
function stableTree(root: string, expectedRoot?: RootIdentity): Tree {
  const first = scanTree(root, expectedRoot);
  const second = scanTree(root, first.rootIdentity);
  if (first.digest !== second.digest || first.observations !== second.observations)
    throw new Error('tree changed between observations');
  return second;
}
function authorized(
  entry: SpecialistOutputEntry,
  grants: readonly SpecialistOutputGrant[],
): boolean {
  return grants.some((grant) =>
    grant.kind === 'file'
      ? entry.kind === 'file' && entry.path === grant.path
      : entry.path === grant.path || entry.path.startsWith(`${grant.path}/`),
  );
}
function changesBetween(baseline: BaselineState, output: Tree): readonly SpecialistOutputChange[] {
  const before = new Map(baseline.tree.entries.map((entry) => [entry.path, entry]));
  const after = new Map(output.entries.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort(comparePaths);
  const changes: SpecialistOutputChange[] = [];
  for (const path of paths) {
    const initial = before.get(path) ?? null;
    const current = after.get(path) ?? null;
    if (initial !== null && current !== null && initial.kind !== current.kind)
      throw new Error('entry type replacement');
    if (JSON.stringify(initial) === JSON.stringify(current)) continue;
    if (!authorized((current ?? initial)!, baseline.grants))
      throw new Error('immutable context changed');
    const change = initial === null ? 'added' : current === null ? 'deleted' : 'modified';
    changes.push(Object.freeze({ path, change, before: initial, after: current }));
  }
  return Object.freeze(changes);
}
function expectedBaseline(input: {
  baseline: SpecialistOutputBaseline;
  expectedBinding: SpecialistOutputBinding;
  expectedBaselineDigest: string;
}): BaselineState {
  const state = baselines.get(input.baseline);
  if (
    state === undefined ||
    state.digest !== input.expectedBaselineDigest ||
    JSON.stringify(bindingSchema.parse(input.expectedBinding)) !== JSON.stringify(state.binding)
  )
    throw new Error('baseline binding mismatch');
  return state;
}

/**
 * Read-only candidate observation, not runtime evidence or import authority. Fixed limits: 1,024
 * entries including root, 16 MiB bytes per scan, depth 32 and path length 4,096. The canonical root
 * must be the staged source tree, excluding credential/home mounts. Handles are process-local.
 * Permission bits are actual regular mode bits, not Git-normalized modes. An exact-file grant does
 * not authorize creating its missing parent directories; grant a subtree when that is intended.
 * Requires a trusted quiescent filesystem. Repeated scans detect observed races but do not provide
 * an atomic malicious-host snapshot or detect secrets within arbitrary source content.
 */
export function captureSpecialistOutputBaseline(input: {
  workspaceRoot: string;
  expectedBinding: SpecialistOutputBinding;
  writablePaths: readonly SpecialistOutputGrant[];
}): SpecialistOutputBaseline {
  try {
    const binding = Object.freeze(bindingSchema.parse(input.expectedBinding));
    const grants = parseGrants(input.writablePaths);
    const tree = stableTree(input.workspaceRoot);
    const digest = hash(JSON.stringify({ version: 1, binding, grants, treeDigest: tree.digest }));
    const baseline = Object.freeze({
      baselineDigest: digest,
      baselineTreeDigest: tree.digest,
    }) as SpecialistOutputBaseline;
    baselines.set(baseline, { root: input.workspaceRoot, tree, binding, grants, digest });
    return baseline;
  } catch {
    throw new Error('specialist output baseline capture failed');
  }
}

export function observeSpecialistOutput(input: {
  baseline: SpecialistOutputBaseline;
  expectedBinding: SpecialistOutputBinding;
  expectedBaselineDigest: string;
}): SpecialistOutputCandidate {
  try {
    const state = expectedBaseline(input);
    const tree = stableTree(state.root, state.tree.rootIdentity);
    const changes = changesBetween(state, tree);
    const data = {
      kind: 'specialist_output_candidate' as const,
      binding: state.binding,
      baselineDigest: state.digest,
      baselineTreeDigest: state.tree.digest,
      outputTreeDigest: tree.digest,
      changes,
    };
    const candidate = Object.freeze({ ...data, candidateDigest: hash(JSON.stringify(data)) });
    candidates.set(candidate, { baseline: state, tree });
    return candidate;
  } catch {
    throw new Error('specialist output observation failed');
  }
}

/** Reobserve the complete candidate tree; later candidates never replace this candidate's target. */
export function verifySpecialistOutput(input: {
  baseline: SpecialistOutputBaseline;
  expectedBinding: SpecialistOutputBinding;
  expectedBaselineDigest: string;
  candidate: SpecialistOutputCandidate;
}): void {
  try {
    const state = expectedBaseline(input);
    const candidate = candidates.get(input.candidate);
    if (candidate === undefined || candidate.baseline !== state)
      throw new Error('unknown candidate');
    const tree = stableTree(state.root, state.tree.rootIdentity);
    if (tree.digest !== candidate.tree.digest) throw new Error('candidate tree changed');
  } catch {
    throw new Error('specialist output verification failed');
  }
}
