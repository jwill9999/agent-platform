import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { z } from 'zod';
import { evidenceReferenceSchema, relativePathSchema } from './contracts.js';

const sha = z.string().regex(/^[a-f0-9]{40}$/u);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const absolute = z.string().refine(isAbsolute, 'absolute path required');

// Preserve the existing UTF-16 path order used by reviewed manifests and diff digests.
function comparePaths(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

const bootstrapEvidenceSchema = evidenceReferenceSchema
  .extend({
    producer: z.string().min(1),
    producerRole: z.enum(['test_runner', 'code_reviewer']),
    candidateTreeSha: sha,
  })
  .strict();
export const bootstrapPolicySchema = z
  .object({
    kind: z.literal('bootstrap_task_artifact'),
    canonicalRoot: absolute,
    sourceRoot: absolute,
    gitCommonDirectory: absolute,
    repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/u),
    taskId: z.string().min(1),
    ref: z.string().regex(/^refs\/heads\/task\/[A-Za-z0-9._-]+$/u),
    initialHeadSha: sha,
    treeSha: sha,
    diffDigest: digest,
    diffFormat: z.literal('name-status-z-no-renames'),
    manifest: z
      .array(
        z
          .object({
            path: relativePathSchema,
            digest: digest.nullable(),
            mode: z.enum(['100644', '100755']).nullable(),
          })
          .strict(),
      )
      .min(1),
    remoteName: z.string().regex(/^[A-Za-z0-9._-]+$/u),
    remoteUrl: z.string().min(1),
    adapters: z
      .object({
        remoteBinary: absolute,
        remoteBinaryDigest: digest,
        beadsReadBinary: absolute,
        beadsReadBinaryDigest: digest,
        dependencies: z
          .array(z.object({ path: absolute, digest }).strict())
          .min(1)
          .optional(),
      })
      .strict(),
    expectedRemoteSha: sha.nullable(),
    author: z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        authoredAtUnix: z.number().int().nonnegative(),
        message: z.string().min(1).max(500),
      })
      .strict(),
    beadsSnapshot: z.record(z.unknown()),
    evidence: z.array(bootstrapEvidenceSchema).min(1),
    allowedPaths: z.array(relativePathSchema).min(1),
    prohibitedActions: z.tuple([
      z.literal('beads.mutate'),
      z.literal('github.deliver'),
      z.literal('notification.approval'),
    ]),
  })
  .strict()
  .superRefine((policy, context) => {
    if (
      policy.ref !== `refs/heads/task/${policy.taskId}` ||
      policy.beadsSnapshot.id !== policy.taskId ||
      policy.beadsSnapshot.status !== 'in_progress'
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'bootstrap task/ref/Beads binding mismatch',
      });
    const paths = policy.manifest.map((item) => item.path);
    if (
      !policy.evidence.some((item) => item.kind === 'test') ||
      !policy.evidence.some((item) => item.kind === 'review') ||
      policy.evidence.some(
        (item) =>
          !['test', 'review'].includes(item.kind) ||
          item.candidateTreeSha !== policy.treeSha ||
          item.producerRole !== (item.kind === 'test' ? 'test_runner' : 'code_reviewer'),
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'bootstrap requires explicit test and independent review evidence',
      });
    if (
      new Set(paths).size !== paths.length ||
      paths.join('\0') !== [...paths].sort(comparePaths).join('\0')
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'manifest must have unique sorted paths',
      });
    for (const item of policy.manifest) {
      if (
        (item.digest === null) !== (item.mode === null) ||
        !policy.allowedPaths.some((path) => item.path === path || item.path.startsWith(`${path}/`))
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'manifest exceeds path authority or has invalid deletion',
        });
    }
  });
export type BootstrapPolicy = z.infer<typeof bootstrapPolicySchema>;
export const implementationArtifactReadySchema = z
  .object({
    kind: z.literal('implementation_artifact_ready'),
    runId: z.string().min(1),
    taskId: z.string().min(1),
    contractDigest: digest,
    policyDigest: digest,
    materialDigest: digest,
    ref: z.string().min(1),
    headSha: sha,
    treeSha: sha,
    beadsSnapshotDigest: digest,
    evidence: z.array(bootstrapEvidenceSchema).min(1),
  })
  .strict();

/** Canonical JSON also makes object-key order irrelevant in observed Beads snapshots. */
export function bootstrapJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(bootstrapJson).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${bootstrapJson(item)}`)
      .join(',')}}`;
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error('bootstrap value is not JSON');
  return result;
}
export function bootstrapDigest(value: unknown): string {
  return `sha256:${createHash('sha256').update(bootstrapJson(value)).digest('hex')}`;
}
export function bootstrapGit(
  root: string,
  args: string[],
  options: { input?: Buffer; maxBuffer?: number } = {},
): Buffer {
  return execFileSync(
    '/usr/bin/git',
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
        PATH: '/usr/bin:/bin',
        LANG: 'C',
        LC_ALL: 'C',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '/usr/bin/false',
        GIT_SSH_COMMAND: '/usr/bin/false',
      },
      timeout: 5000,
      input: options.input,
      maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    },
  );
}
function gitText(root: string, args: string[]): string {
  return bootstrapGit(root, args).toString('utf8').trim();
}
export function assertBootstrapCheckout(policy: BootstrapPolicy, expectedHead: string): void {
  for (const root of [policy.canonicalRoot, policy.sourceRoot]) {
    if (
      realpathSync(root) !== root ||
      realpathSync(gitText(root, ['rev-parse', '--show-toplevel'])) !== root
    )
      throw new Error('bootstrap checkout realpath changed');
    const common = gitText(root, ['rev-parse', '--git-common-dir']);
    if (realpathSync(resolve(root, common)) !== policy.gitCommonDirectory)
      throw new Error('bootstrap common Git authority changed');
  }
  if (
    realpathSync(policy.gitCommonDirectory) !== policy.gitCommonDirectory ||
    gitText(policy.sourceRoot, ['symbolic-ref', 'HEAD']) !== policy.ref ||
    gitText(policy.sourceRoot, ['rev-parse', 'HEAD']) !== expectedHead ||
    gitText(policy.sourceRoot, ['rev-parse', `${policy.ref}^{commit}`]) !== expectedHead ||
    gitText(policy.canonicalRoot, ['remote', 'get-url', policy.remoteName]) !== policy.remoteUrl ||
    gitText(policy.canonicalRoot, ['remote', 'get-url', '--push', policy.remoteName]) !==
      policy.remoteUrl
  )
    throw new Error('bootstrap source/ref/head/remote binding changed');
  if (gitText(policy.sourceRoot, ['config', '--bool', 'core.filemode']) !== 'true')
    throw new Error('bootstrap requires exact executable-mode observation');
}

interface TreeFile {
  path: string;
  oid: string;
  mode: '100644' | '100755';
  digest: string;
  sizeBytes: number;
}
function objectHash(root: string, kind: 'blob' | 'tree', content: Buffer): string {
  // Git owns repository-format object identity; no object or index is written without -w.
  return sha.parse(
    bootstrapGit(root, ['hash-object', '-t', kind, '--stdin'], { input: content })
      .toString('utf8')
      .trim(),
  );
}
function treeHash(root: string, files: TreeFile[], prefix = ''): string {
  const entries = new Map<string, { mode: string; oid: string; directory: boolean }>();
  for (const file of files) {
    const rest = file.path.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash === -1) entries.set(rest, { mode: file.mode, oid: file.oid, directory: false });
    else {
      const name = rest.slice(0, slash);
      if (!entries.has(name))
        entries.set(name, {
          mode: '40000',
          oid: treeHash(
            root,
            files.filter((item) => item.path.startsWith(`${prefix}${name}/`)),
            `${prefix}${name}/`,
          ),
          directory: true,
        });
    }
  }
  const sorted = [...entries].sort(([a, x], [b, y]) =>
    Buffer.compare(
      Buffer.from(a + (x.directory ? '/' : '')),
      Buffer.from(b + (y.directory ? '/' : '')),
    ),
  );
  return objectHash(
    root,
    'tree',
    Buffer.concat(
      sorted.flatMap(([name, entry]) => [
        Buffer.from(`${entry.mode} ${name}\0`),
        Buffer.from(entry.oid, 'hex'),
      ]),
    ),
  );
}

function bootstrapFileChanged(
  root: string,
  initial: { mode: string; oid: string } | undefined,
  current: TreeFile | undefined,
): boolean {
  if (initial?.oid !== current?.oid || initial?.mode !== current?.mode) return true;
  if (initial === undefined || current === undefined) return false;
  // Equal Git IDs must not hide changed bytes from the SHA-256 reviewed manifest.
  const baseline = bootstrapGit(root, ['cat-file', 'blob', initial.oid], {
    maxBuffer: Math.max(16 * 1024 * 1024, current.sizeBytes),
  });
  return `sha256:${createHash('sha256').update(baseline).digest('hex')}` !== current.digest;
}

/** Pure observation: no index, objects, refs, journal or remote are written. */
export function observeBootstrapCandidate(
  policy: BootstrapPolicy,
  expectedHead = policy.initialHeadSha,
) {
  assertBootstrapCheckout(policy, expectedHead);
  const initial = new Map<string, { mode: string; oid: string }>();
  for (const line of bootstrapGit(policy.sourceRoot, ['ls-tree', '-r', '-z', policy.initialHeadSha])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/u.exec(line);
    if (!match) throw new Error('bootstrap baseline contains unsupported tree entry');
    initial.set(match[3]!, { mode: match[1]!, oid: match[2]! });
  }
  const names = [
    ...new Set(
      bootstrapGit(policy.sourceRoot, [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '-z',
      ])
        .toString('utf8')
        .split('\0')
        .filter(Boolean),
    ),
  ].sort(comparePaths);
  const files: TreeFile[] = [];
  for (const path of names) {
    relativePathSchema.parse(path);
    const absolutePath = join(policy.sourceRoot, path);
    if (!existsSync(absolutePath)) continue;
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() || realpathSync(absolutePath) !== absolutePath)
      throw new Error('bootstrap source contains symlink or non-file');
    const content = readFileSync(absolutePath);
    files.push({
      path,
      mode: stat.mode & 0o111 ? '100755' : '100644',
      oid: objectHash(policy.sourceRoot, 'blob', content),
      digest: `sha256:${createHash('sha256').update(content).digest('hex')}`,
      sizeBytes: content.length,
    });
  }
  const current = new Map(files.map((file) => [file.path, file]));
  const changed = [...new Set([...initial.keys(), ...current.keys()])]
    .sort(comparePaths)
    .filter((path) =>
      bootstrapFileChanged(policy.sourceRoot, initial.get(path), current.get(path)),
    );
  const manifest = changed.map((path) => ({
    path,
    digest: current.get(path)?.digest ?? null,
    mode: current.get(path)?.mode ?? null,
  }));
  const rawDiff = Buffer.from(
    changed
      .map((path) => {
        let status = 'M';
        if (!initial.has(path)) status = 'A';
        else if (!current.has(path)) status = 'D';
        return `${status}\0${path}\0`;
      })
      .join(''),
  );
  return {
    kind: 'bootstrap_candidate_observed' as const,
    ref: policy.ref,
    headSha: expectedHead,
    treeSha: treeHash(policy.sourceRoot, files),
    manifest,
    diffDigest: `sha256:${createHash('sha256').update(rawDiff).digest('hex')}`,
  };
}
export function assertBootstrapCandidate(
  policy: BootstrapPolicy,
  expectedHead = policy.initialHeadSha,
) {
  const observation = observeBootstrapCandidate(policy, expectedHead);
  if (
    observation.treeSha !== policy.treeSha ||
    observation.diffDigest !== policy.diffDigest ||
    bootstrapJson(observation.manifest) !== bootstrapJson(policy.manifest)
  )
    throw new Error('bootstrap candidate tree/path manifest changed');
  return observation;
}
