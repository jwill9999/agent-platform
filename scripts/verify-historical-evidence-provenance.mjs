import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Bootstrap imports are builtins only. No adjacent project code executes before
// the entire local control bundle has been compared with protected Git objects.
const REPOSITORY = 'jwill9999/agent-platform';
const WORKFLOW_PATH = '.github/workflows/promptfoo-code-scan.yml';
const CONTROL_PATHS = new Set([
  '.github/security/historical-evidence-allowlist.v1.json',
  '.github/security/historical-evidence-review.v1.json',
  WORKFLOW_PATH,
  'scripts/classify-historical-evidence.mjs',
  'scripts/qualify-historical-evidence.mjs',
  'scripts/verify-historical-evidence-provenance.mjs',
]);
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const GIT_EXECUTABLE = '/usr/bin/git';
const SYSTEM_PATH = '/usr/bin:/bin';
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
export function validateBootstrapControlRequest(commit, path) {
  if (!sha(commit) || !CONTROL_PATHS.has(path))
    throw new Error('Invalid protected bootstrap object request');
}
function readProtectedControl(repo, commit, path) {
  validateDataRepoPath(repo);
  validateBootstrapControlRequest(commit, path);
  const options = {
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      PATH: SYSTEM_PATH,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
    },
  };
  const prefix = [
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'core.attributesFile=/dev/null',
    '-C',
    repo,
  ];
  const entry = execFileSync(
    GIT_EXECUTABLE,
    [...prefix, 'ls-tree', '-z', commit, '--', path],
    options,
  ).toString();
  const match = /^100644 blob [a-f0-9]{40}\t([^\0]+)\0$/.exec(entry);
  if (match?.[1] !== path) throw new Error(`Missing regular protected control: ${path}`);
  return execFileSync(GIT_EXECUTABLE, [...prefix, 'show', `${commit}:${path}`], options);
}
function validateTarget(pr, head, base) {
  if (
    pr?.state !== 'open' ||
    pr.base?.ref !== 'staging' ||
    pr.base?.repo?.full_name !== REPOSITORY ||
    pr.head?.repo?.full_name !== REPOSITORY ||
    pr.head?.sha !== head ||
    pr.base?.sha !== base ||
    !sha(head) ||
    !sha(base) ||
    !Number.isSafeInteger(pr.number) ||
    pr.number < 1
  )
    throw new Error('Wrong repository, target or stale PR head/base');
}
export function githubApiUrl(path) {
  if (typeof path !== 'string' || path.length > 32 || /[^\x20-\x7e]/.test(path))
    throw new Error('Invalid bootstrap GitHub API route');
  if (path === 'git/ref/heads/staging')
    return 'https://api.github.com/repos/jwill9999/agent-platform/git/ref/heads/staging';
  const match = /^pulls\/([1-9]\d*)$/.exec(path);
  if (!match || !Number.isSafeInteger(Number(match[1])))
    throw new Error('Unsupported bootstrap GitHub API route/identity');
  return new URL(path, 'https://api.github.com/repos/jwill9999/agent-platform/').href;
}
async function githubJson(path, token) {
  const response = await fetch(githubApiUrl(path), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub bootstrap read failed: ${response.status}`);
  return response.json();
}
export function fetchObjects(repo, protectedTip, token) {
  validateDataRepoPath(repo);
  if (!sha(protectedTip)) throw new Error('Invalid protected bootstrap object identity');
  mkdirSync(repo);
  const env = {
    PATH: SYSTEM_PATH,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0:
      'AUTHORIZATION: basic ' + Buffer.from('x-access-token:' + token).toString('base64'),
  };
  execFileSync(GIT_EXECUTABLE, ['-c', 'core.hooksPath=/dev/null', 'init', '--bare', '--', repo], {
    env,
    stdio: 'pipe',
    timeout: 30_000,
  });
  execFileSync(
    GIT_EXECUTABLE,
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-C',
      repo,
      'fetch',
      '--no-tags',
      '--no-recurse-submodules',
      '--stdin',
      'https://github.com/jwill9999/agent-platform.git',
    ],
    {
      env,
      input: protectedTip + '\n',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
}

function validateLocalControl(localRoot, path, bytes) {
  const parts = path.split('/');
  for (let i = 0; i < parts.length; i++) {
    const stat = lstatSync(join(localRoot, ...parts.slice(0, i + 1)));
    const correctType = i < parts.length - 1 ? stat.isDirectory() : stat.isFile();
    if (stat.isSymbolicLink() || !correctType)
      throw new Error(`Unsafe local protected control: ${path}`);
  }
  if (!bytes.equals(readFileSync(join(localRoot, path))))
    throw new Error(`Local control differs from protected source: ${path}`);
}

export async function loadProtectedHelpers({
  repo,
  protectedTip,
  localRoot = dirname(dirname(fileURLToPath(import.meta.url))),
}) {
  if (!sha(protectedTip)) throw new Error('Invalid protected commit identity');
  validateDataRepoPath(repo);
  const type = execFileSync(
    GIT_EXECUTABLE,
    ['-c', 'core.hooksPath=/dev/null', '-C', repo, 'cat-file', '--batch-check=%(objecttype)'],
    {
      input: protectedTip + '\n',
      env: {
        PATH: SYSTEM_PATH,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
      },
      timeout: 30_000,
      maxBuffer: 1024,
    },
  ).toString();
  if (type !== 'commit\n') throw new Error('Missing or wrong protected commit type');
  if (!lstatSync(localRoot).isDirectory() || lstatSync(localRoot).isSymbolicLink())
    throw new Error('Unsafe local control root');
  const protectedBytes = new Map();
  for (const path of CONTROL_PATHS) {
    const bytes = readProtectedControl(repo, protectedTip, path);
    validateLocalControl(localRoot, path, bytes);
    protectedBytes.set(path, bytes);
  }
  // Execute object-derived private copies, so changing adjacent local files after
  // validation cannot alter the helper imported across an asynchronous boundary.
  const directory = mkdtempSync(join(tmpdir(), 'protected-archive-helpers-'));
  try {
    for (const path of [
      'scripts/classify-historical-evidence.mjs',
      'scripts/qualify-historical-evidence.mjs',
    ])
      writeFileSync(join(directory, path.split('/').at(-1)), protectedBytes.get(path), {
        flag: 'wx',
        mode: 0o600,
      });
    const classifier = await import(
      pathToFileURL(join(directory, 'classify-historical-evidence.mjs')).href
    );
    const qualifier = await import(
      pathToFileURL(join(directory, 'qualify-historical-evidence.mjs')).href
    );
    return {
      classifier,
      qualifier,
      cleanup: () => rmSync(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function equivalent(left, right) {
  if (typeof left !== typeof right || left === null || right === null) return left === right;
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, i) => equivalent(value, right[i]))
    );
  if (typeof left === 'object') {
    const a = Object.keys(left).sort((a, b) => a.localeCompare(b, 'en'));
    const b = Object.keys(right).sort((a, b) => a.localeCompare(b, 'en'));
    return equivalent(a, b) && a.every((key) => equivalent(left[key], right[key]));
  }
  return left === right;
}

function validateRun(run, event, source, pr, jobName, jobs) {
  if (
    run?.event !== event ||
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    run.repository?.full_name !== REPOSITORY ||
    run.head_repository?.full_name !== REPOSITORY ||
    run.path !== WORKFLOW_PATH ||
    run.head_sha !== source ||
    !Number.isSafeInteger(run.id) ||
    run.id < 1 ||
    !Number.isSafeInteger(run.run_attempt) ||
    run.run_attempt < 1
  )
    throw new Error('Untrusted workflow run identity/result');
  if (event === 'workflow_dispatch') {
    if (run.head_branch !== 'staging')
      throw new Error('Dispatch did not execute protected staging');
  } else if (!run.pull_requests?.some((entry) => entry.number === pr.number))
    throw new Error('Automatic run is not attached to target PR');
  const matches = jobs.filter((job) => job.name === jobName);
  if (
    matches.length !== 1 ||
    matches[0].run_id !== run.id ||
    matches[0].status !== 'completed' ||
    matches[0].conclusion !== 'success'
  )
    throw new Error('Required actual job is not successful in this run');
}

export async function verifyHistoricalEvidenceProvenance({
  repo,
  pr,
  protectedTip,
  adoptionCommit,
  automaticRun,
  automaticJobs,
  automaticReceipt,
  dispatchRun,
  dispatchJobs,
  dispatchReceipt,
  localRoot,
}) {
  const helpers = await loadProtectedHelpers({ repo, protectedTip, localRoot });
  try {
    const { qualifyHistoricalEvidence } = helpers.qualifier;
    const { assertCommit, git, isAncestor } = helpers.classifier;
    validateTarget(pr, pr.head?.sha, protectedTip);
    assertCommit(repo, adoptionCommit);
    if (!isAncestor(repo, adoptionCommit, protectedTip))
      throw new Error('Adopted policy is not a protected-base ancestor');
    // All trust-boundary code must still be the independently adopted policy,
    // not merely reside somewhere below its ancestry after a policy rewrite.
    for (const path of CONTROL_PATHS) {
      const adopted = git(repo, 'ls-tree', '-z', adoptionCommit, '--', path);
      const current = git(repo, 'ls-tree', '-z', protectedTip, '--', path);
      if (!adopted.length || !adopted.equals(current))
        throw new Error('Protected policy changed since independently qualified adoption');
    }
    validateRun(automaticRun, 'pull_request', pr.head.sha, pr, 'security-scan', automaticJobs);
    validateRun(
      dispatchRun,
      'workflow_dispatch',
      protectedTip,
      pr,
      'archive-provenance',
      dispatchJobs,
    );
    for (const [receipt, run, event] of [
      [automaticReceipt, automaticRun, 'pull_request'],
      [dispatchReceipt, dispatchRun, 'workflow_dispatch'],
    ]) {
      if (
        receipt?.pr !== pr.number ||
        receipt.base !== protectedTip ||
        receipt.head !== pr.head.sha ||
        receipt.repository !== REPOSITORY ||
        receipt.runId !== String(run.id) ||
        receipt.runAttempt !== String(run.run_attempt) ||
        receipt.event !== event
      )
        throw new Error('Receipt is missing, forged or stale');
      const independentlyComputed = qualifyHistoricalEvidence({
        repo,
        base: protectedTip,
        head: pr.head.sha,
        context: {
          repository: REPOSITORY,
          pr: pr.number,
          base: protectedTip,
          head: pr.head.sha,
          controlSource: protectedTip,
          event,
          ref: event === 'pull_request' ? `refs/pull/${pr.number}/merge` : 'refs/heads/staging',
          workflowSource: event === 'pull_request' ? receipt.workflowSource : protectedTip,
          runId: String(run.id),
          runAttempt: String(run.run_attempt),
        },
      });
      if (!equivalent(receipt, independentlyComputed))
        throw new Error(
          'Qualification receipt differs from independently recomputed objects/proof',
        );
    }
    return {
      verified: true,
      qualification: 'historical-archive-not-promptfoo-analysis',
      pr: pr.number,
      base: protectedTip,
      head: pr.head.sha,
      adoptionCommit,
      automaticRun: automaticRun.id,
      dispatchRun: dispatchRun.id,
      automaticReceiptSha256: sha256(JSON.stringify(automaticReceipt)),
      dispatchReceiptSha256: sha256(JSON.stringify(dispatchReceipt)),
    };
  } finally {
    helpers.cleanup();
  }
}

async function paginated(path, key, read) {
  const values = [];
  for (let page = 1; page <= 20; page++) {
    const response = await read(
      `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
    );
    if (!Array.isArray(response[key])) throw new Error('Malformed GitHub enumeration');
    values.push(...response[key]);
    if (response[key].length < 100) return values;
  }
  throw new Error('GitHub enumeration exceeded bounded pages; incomplete proof');
}

export function decodeReceiptZip(zip) {
  if (!Buffer.isBuffer(zip) || zip.length > 128 * 1024)
    throw new Error('Invalid receipt artifact bytes');
  const extract =
    "import io,json,stat,sys,zipfile\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nentries=z.infolist()\nassert len(entries)==1\ne=entries[0]\nassert e.filename=='archive-qualification.json' and not e.is_dir() and e.file_size<=65536\nmode=e.external_attr>>16\nassert not stat.S_ISLNK(mode) and (stat.S_IFMT(mode) in (0,stat.S_IFREG))\nsys.stdout.buffer.write(z.read(e))";
  const bytes = execFileSync('/usr/bin/python3', ['-I', '-c', extract], {
    input: zip,
    maxBuffer: 64 * 1024,
    timeout: 10_000,
    env: { PATH: SYSTEM_PATH },
  });
  return JSON.parse(bytes.toString('utf8'));
}

async function downloadReceipt(run, name, token, read, apiUrl) {
  const all = await paginated(`actions/runs/${run.id}/artifacts`, 'artifacts', read);
  const matches = all.filter((entry) => entry.name === name);
  if (
    matches.length !== 1 ||
    matches[0].expired ||
    matches[0].workflow_run?.id !== run.id ||
    matches[0].workflow_run?.head_sha !== run.head_sha ||
    !/^sha256:[a-f0-9]{64}$/.test(matches[0].digest)
  )
    throw new Error('Missing or ambiguous run-bound receipt artifact');
  const artifact = matches[0];
  const response = await fetch(apiUrl(`actions/artifacts/${artifact.id}/zip`), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 302)
    throw new Error('Artifact download did not return a signed data URL');
  const location = new URL(response.headers.get('location'));
  if (
    location.protocol !== 'https:' ||
    !(
      location.hostname.endsWith('.blob.core.windows.net') ||
      location.hostname.endsWith('.actions.githubusercontent.com')
    )
  )
    throw new Error('Unexpected artifact download host');
  // Never forward the GitHub token to artifact storage.
  const downloaded = await fetch(location, {
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!downloaded.ok) throw new Error('Artifact data unavailable');
  const chunks = [];
  let size = 0;
  for await (const chunk of downloaded.body) {
    size += chunk.length;
    if (size > 128 * 1024) throw new Error('Receipt artifact unexpectedly large');
    chunks.push(Buffer.from(chunk));
  }
  const zip = Buffer.concat(chunks);
  if (`sha256:${sha256(zip)}` !== artifact.digest) throw new Error('Artifact digest mismatch');
  return decodeReceiptZip(zip);
}

export async function revalidateFinalProof({
  pr,
  protectedTip,
  automaticRun,
  dispatchRun,
  read,
  enumerate,
}) {
  const after = await read(`pulls/${pr.number}`);
  validateTarget(after, pr.head.sha, protectedTip);
  if ((await read('git/ref/heads/staging')).object?.sha !== protectedTip)
    throw new Error('Protected base changed during verification');
  const automatic = await read(`actions/runs/${automaticRun.id}`);
  const dispatch = await read(`actions/runs/${dispatchRun.id}`);
  await Promise.all(
    [
      [automatic, automaticRun, 'pull_request', pr.head.sha, 'security-scan'],
      [dispatch, dispatchRun, 'workflow_dispatch', protectedTip, 'archive-provenance'],
    ].map(async ([fresh, prior, event, source, name]) => {
      if (fresh.id !== prior.id || fresh.run_attempt !== prior.run_attempt)
        throw new Error('Workflow attempt changed during verification');
      const jobs = await enumerate(
        `actions/runs/${fresh.id}/attempts/${fresh.run_attempt}/jobs`,
        'jobs',
      );
      validateRun(fresh, event, source, pr, name, jobs);
    }),
  );
  const candidates = await enumerate(
    `actions/workflows/promptfoo-code-scan.yml/runs?event=pull_request&head_sha=${pr.head.sha}`,
    'workflow_runs',
  );
  const latest = candidates
    .filter(
      (run) =>
        run.head_sha === pr.head.sha &&
        run.event === 'pull_request' &&
        run.pull_requests?.some((entry) => entry.number === pr.number),
    )
    .sort((a, b) => b.id - a.id)[0];
  if (
    !latest ||
    latest.id !== automaticRun.id ||
    latest.run_attempt !== automaticRun.run_attempt ||
    latest.status !== 'completed' ||
    latest.conclusion !== 'success'
  )
    throw new Error('Automatic proof changed during verification');
  // Refresh both identities once more after enumeration: a same-head rerun may
  // begin while the latest-run or job pages are being fetched. A merge caller
  // must still repeat the gate immediately before its exact-head merge request.
  const priorRuns = [automaticRun, dispatchRun];
  const freshRuns = await Promise.all(priorRuns.map((prior) => read(`actions/runs/${prior.id}`)));
  freshRuns.forEach((fresh, index) => {
    const prior = priorRuns[index];
    if (
      fresh.id !== prior.id ||
      fresh.run_attempt !== prior.run_attempt ||
      fresh.head_sha !== prior.head_sha ||
      fresh.status !== 'completed' ||
      fresh.conclusion !== 'success'
    )
      throw new Error('Workflow changed at final verification fence');
  });
}

async function main() {
  const [prText, automaticText, dispatchText, adoptionCommit] = process.argv.slice(2);
  if (
    process.argv.length !== 6 ||
    ![prText, automaticText, dispatchText].every(
      (value) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)),
    ) ||
    !sha(adoptionCommit)
  )
    throw new Error(
      'Usage: verify-historical-evidence-provenance.mjs PR AUTOMATIC_RUN DISPATCH_RUN ADOPTED_POLICY_SHA',
    );
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error('GH_TOKEN is required for authenticated read-only proof');
  const pr = await githubJson(`pulls/${prText}`, token);
  const tip = await githubJson('git/ref/heads/staging', token);
  validateTarget(pr, pr.head?.sha, tip.object?.sha);
  const directory = mkdtempSync(join(tmpdir(), 'archive-provenance-'));
  let helpers;
  try {
    const repo = join(directory, 'objects.git');
    fetchObjects(repo, tip.object.sha, token);
    helpers = await loadProtectedHelpers({ repo, protectedTip: tip.object.sha });
    const read = (path) => helpers.qualifier.githubJson(path, token);
    const automaticRun = await read(`actions/runs/${automaticText}`);
    const dispatchRun = await read(`actions/runs/${dispatchText}`);
    const candidates = await paginated(
      `actions/workflows/promptfoo-code-scan.yml/runs?event=pull_request&head_sha=${pr.head.sha}`,
      'workflow_runs',
      read,
    );
    const latest = candidates
      .filter(
        (run) =>
          run.head_sha === pr.head.sha &&
          run.event === 'pull_request' &&
          run.pull_requests?.some((entry) => entry.number === pr.number),
      )
      .sort((a, b) => b.id - a.id)[0];
    if (!latest || latest.id !== automaticRun.id || latest.run_attempt !== automaticRun.run_attempt)
      throw new Error('Automatic proof is not the latest current-head attempt');
    const automaticJobs = await paginated(
      `actions/runs/${automaticText}/attempts/${automaticRun.run_attempt}/jobs`,
      'jobs',
      read,
    );
    const dispatchJobs = await paginated(
      `actions/runs/${dispatchText}/attempts/${dispatchRun.run_attempt}/jobs`,
      'jobs',
      read,
    );
    const automaticReceipt = await downloadReceipt(
      automaticRun,
      `automatic-archive-${pr.number}-${pr.head.sha}-${automaticRun.run_attempt}`,
      token,
      read,
      helpers.qualifier.githubApiUrl,
    );
    const dispatchReceipt = await downloadReceipt(
      dispatchRun,
      `archive-provenance-${pr.number}-${pr.head.sha}-${dispatchRun.run_attempt}`,
      token,
      read,
      helpers.qualifier.githubApiUrl,
    );
    if (!sha(automaticReceipt.workflowSource)) throw new Error('Invalid automatic merge identity');
    helpers.qualifier.fetchObjects(
      repo,
      [pr.head.sha, automaticReceipt.workflowSource, adoptionCommit],
      token,
      { existing: true },
    );
    const result = await verifyHistoricalEvidenceProvenance({
      repo,
      pr,
      protectedTip: tip.object.sha,
      adoptionCommit,
      automaticRun,
      automaticJobs,
      automaticReceipt,
      dispatchRun,
      dispatchJobs,
      dispatchReceipt,
    });
    await revalidateFinalProof({
      pr,
      protectedTip: tip.object.sha,
      automaticRun,
      dispatchRun,
      read,
      enumerate: (path, key) => paginated(path, key, read),
    });
    if (process.env.ARCHIVE_VERIFIED_OUTPUT)
      writeFileSync(process.env.ARCHIVE_VERIFIED_OUTPUT, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally {
    helpers?.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
