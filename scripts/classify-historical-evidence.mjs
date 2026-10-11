import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isAbsolute, normalize } from 'node:path';

export const POLICY_PATH = '.github/security/historical-evidence-allowlist.v1.json';
export const REVIEW_PATH = '.github/security/historical-evidence-review.v1.json';
export const WORKFLOW_PATH = '.github/workflows/promptfoo-code-scan.yml';
export const SOURCE = '6ca3cd1baf7ff13add1da57dc0ecc330d2ab2cec';
export const SELECTION = '30788264b062ce9dec1060237b6b41fb78a6b8734a6fecc46861a375a9b49b11';
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export const GIT_EXECUTABLE = '/usr/bin/git';
export const SYSTEM_PATH = '/usr/bin:/bin';
export function validateDataRepoPath(repo) {
  if (
    typeof repo !== 'string' ||
    !isAbsolute(repo) ||
    normalize(repo) !== repo ||
    repo === '/' ||
    /[\0-\x1f\x7f]/.test(repo)
  )
    throw new Error('Invalid absolute data repository path');
  return repo;
}
function safeTreePath(path) {
  return (
    typeof path === 'string' &&
    /^[\w./-]+$/.test(path) &&
    path.split('/').every((part) => part && part !== '.' && part !== '..') &&
    !path.startsWith('-')
  );
}
export function validateGitArguments(args) {
  if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string'))
    throw new Error('Invalid Git argument types');
  const [command, ...values] = args;
  const shape = {
    'cat-file': () => values.length === 2 && ['-t', 'blob'].includes(values[0]) && sha(values[1]),
    'ls-tree': () =>
      values.length === 4 &&
      values[0] === '-z' &&
      sha(values[1]) &&
      values[2] === '--' &&
      safeTreePath(values[3]),
    'rev-parse': () => values.length === 1 && ['HEAD', 'staging'].includes(values[0]),
    'update-ref': () => values.length === 2 && values[0] === 'refs/heads/staging' && sha(values[1]),
    show: () =>
      (values.length === 3 &&
        values[0] === '-s' &&
        values[1] === '--format=%P' &&
        sha(values[2])) ||
      (values.length === 1 &&
        /^[a-f0-9]{40}:[\w./-]+$/.test(values[0]) &&
        safeTreePath(values[0].slice(41))),
  };
  // The raw diff has six fixed flags followed by two immutable identities and --.
  if (command === 'diff') {
    if (
      values.length !== 9 ||
      values.slice(0, 6).join(' ') !==
        '--raw -z --no-renames --no-ext-diff --no-textconv --no-abbrev' ||
      !sha(values[6]) ||
      !sha(values[7]) ||
      values[8] !== '--'
    )
      throw new Error('Unsupported Git argument shape');
    return args;
  }
  if (!Object.hasOwn(shape, command) || !shape[command]())
    throw new Error('Unsupported Git argument shape');
  return args;
}

export function git(repo, ...args) {
  return execFileSync(
    GIT_EXECUTABLE,
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.attributesFile=/dev/null',
      '-C',
      validateDataRepoPath(repo),
      ...validateGitArguments(args),
    ],
    {
      encoding: null,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30_000,
      env: {
        PATH: SYSTEM_PATH,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
      },
    },
  );
}

export function isAncestor(repo, base, head) {
  if (!sha(base) || !sha(head)) throw new Error('Invalid ancestry commit identities');
  validateDataRepoPath(repo);
  try {
    execFileSync(
      GIT_EXECUTABLE,
      [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'core.attributesFile=/dev/null',
        '-C',
        repo,
        'merge-base',
        '--is-ancestor',
        '--',
        base,
        head,
      ],
      {
        timeout: 30_000,
        maxBuffer: 1024,
        env: {
          PATH: SYSTEM_PATH,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_TERMINAL_PROMPT: '0',
        },
      },
    );
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

export function readObjectBatch(repo, value, expectedType = null) {
  if (!sha(value)) throw new Error('Invalid object identity');
  const output = execFileSync(
    GIT_EXECUTABLE,
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.attributesFile=/dev/null',
      '-C',
      validateDataRepoPath(repo),
      'cat-file',
      '--batch',
    ],
    {
      input: value + '\n',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30_000,
      env: {
        PATH: SYSTEM_PATH,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
      },
    },
  );
  return decodeObjectBatch(output, value, expectedType);
}
export function decodeObjectBatch(output, value, expectedType = null) {
  if (!Buffer.isBuffer(output) || !sha(value))
    throw new Error('Invalid batch object bytes/identity');
  const headerEnd = output.indexOf(10);
  if (headerEnd < 0 || headerEnd > 100) throw new Error('Malformed Git object header');
  const header = /^([a-f0-9]{40}) (blob|tree|commit|tag) (0|[1-9]\d*)$/.exec(
    output.subarray(0, headerEnd).toString('utf8'),
  );
  if (header?.[1] !== value || (expectedType && header[2] !== expectedType))
    throw new Error('Missing or wrong Git object identity/type');
  const bytes = Number(header[3]);
  if (
    !Number.isSafeInteger(bytes) ||
    bytes < 0 ||
    output.length !== headerEnd + 1 + bytes + 1 ||
    output.at(-1) !== 10
  )
    throw new Error('Malformed Git object size/framing');
  return { type: header[2], content: output.subarray(headerEnd + 1, headerEnd + 1 + bytes) };
}
export function assertCommit(repo, value) {
  readObjectBatch(repo, value, 'commit');
}

export function treeEntry(repo, commit, path) {
  const bytes = git(repo, 'ls-tree', '-z', commit, '--', path);
  if (!bytes.length) return null;
  const records = bytes.toString('utf8').split('\0').filter(Boolean);
  if (records.length !== 1) throw new Error('Ambiguous tree entry');
  const match = /^(\d{6}) (blob|tree|commit) ([a-f0-9]{40})\t(.+)$/.exec(records[0]);
  if (!match || match[4] !== path) throw new Error('Malformed tree entry');
  return { mode: match[1], type: match[2], blob: match[3] };
}

export function validatePolicy(policy) {
  if (
    policy?.version !== 1 ||
    policy.sourceRevision !== SOURCE ||
    policy.selectionManifestSha256 !== SELECTION ||
    policy.count !== 220 ||
    policy.bytes !== 3_958_506 ||
    !Array.isArray(policy.files) ||
    policy.files.length !== 220
  )
    throw new Error('Invalid historical policy identity/count');
  const seen = new Set();
  let bytes = 0;
  let json = 0;
  for (const file of policy.files) {
    if (
      typeof file.path !== 'string' ||
      !/^docs\/reviews\/[A-Za-z0-9_./-]+\.(json|txt|log|diff|patch)$/.test(file.path) ||
      file.path.split('/').some((part) => part === '.' || part === '..' || part === '') ||
      seen.has(file.path)
    )
      throw new Error('Unsafe or duplicate historical path');
    if (
      file.mode !== '100644' ||
      !sha(file.blob) ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      file.bytes > policy.bytes
    )
      throw new Error('Invalid historical blob/mode/size');
    seen.add(file.path);
    bytes += file.bytes;
    if (file.path.endsWith('.json')) json++;
  }
  if (bytes !== policy.bytes || json !== 139) throw new Error('Historical policy totals mismatch');
  return policy;
}

export function readPolicy(repo, base) {
  const entry = treeEntry(repo, base, POLICY_PATH);
  if (entry?.mode !== '100644' || entry.type !== 'blob')
    throw new Error('Protected policy missing or not regular data');
  const bytes = git(repo, 'cat-file', 'blob', entry.blob);
  return {
    policy: validatePolicy(JSON.parse(bytes.toString('utf8'))),
    policySha256: sha256(bytes),
  };
}

export function classifyHistoricalEvidence({ repo, base, head }) {
  assertCommit(repo, base);
  assertCommit(repo, head);
  const { policy, policySha256 } = readPolicy(repo, base);
  if (!isAncestor(repo, base, head))
    return { route: 'full', reason: 'base-is-not-head-ancestor', base, head, policySha256 };
  const raw = git(
    repo,
    'diff',
    '--raw',
    '-z',
    '--no-renames',
    '--no-ext-diff',
    '--no-textconv',
    '--no-abbrev',
    base,
    head,
    '--',
  );
  const parts = raw.toString('utf8').split('\0');
  if (parts.pop() !== '') throw new Error('Truncated raw diff');
  if (parts.length % 2) throw new Error('Incomplete raw diff enumeration');
  const changes = [];
  for (let index = 0; index < parts.length; index += 2) {
    const match = /^:(\d{6}) (\d{6}) ([a-f0-9]{40}) ([a-f0-9]{40}) ([A-Z])$/.exec(parts[index]);
    if (!match) throw new Error('Malformed raw diff record');
    changes.push({
      oldMode: match[1],
      mode: match[2],
      oldBlob: match[3],
      blob: match[4],
      status: match[5],
      path: parts[index + 1],
    });
  }
  if (changes.length !== policy.count)
    return {
      route: 'full',
      reason: 'not-complete-220-additions',
      base,
      head,
      policySha256,
      changedFiles: changes.length,
    };
  const expected = new Map(policy.files.map((file) => [file.path, file]));
  const seen = new Set();
  for (const change of changes) {
    const approved = expected.get(change.path);
    if (
      !approved ||
      seen.has(change.path) ||
      change.status !== 'A' ||
      change.oldMode !== '000000' ||
      change.oldBlob !== '0'.repeat(40) ||
      change.mode !== '100644' ||
      change.blob !== approved.blob ||
      treeEntry(repo, base, change.path)
    )
      return { route: 'full', reason: 'unapproved-change', base, head, policySha256 };
    const content = git(repo, 'cat-file', 'blob', change.blob);
    if (content.length !== approved.bytes || sha256(content) !== approved.sha256)
      return { route: 'full', reason: 'unapproved-content', base, head, policySha256 };
    seen.add(change.path);
  }
  return {
    route: 'archive',
    base,
    head,
    policySha256,
    sourceRevision: SOURCE,
    selectionManifestSha256: SELECTION,
    files: policy.count,
    bytes: policy.bytes,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const [repo, base, head] = process.argv.slice(2);
    if (!repo || !base || !head || process.argv.length !== 5)
      throw new Error('Usage: classify-historical-evidence.mjs REPO BASE_SHA HEAD_SHA');
    console.log(JSON.stringify(classifyHistoricalEvidence({ repo, base, head })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
