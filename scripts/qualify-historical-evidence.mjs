import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertCommit,
  classifyHistoricalEvidence,
  git,
  GIT_EXECUTABLE,
  SYSTEM_PATH,
  validateDataRepoPath,
  POLICY_PATH,
  readPolicy,
  REVIEW_PATH,
  sha,
  sha256,
  SOURCE,
  SELECTION,
  treeEntry,
  WORKFLOW_PATH,
} from './classify-historical-evidence.mjs';

export const REPOSITORY = 'jwill9999/agent-platform';
export const CLASSIFIER_PATH = 'scripts/classify-historical-evidence.mjs';
export const QUALIFIER_PATH = 'scripts/qualify-historical-evidence.mjs';
export const VERIFIER_PATH = 'scripts/verify-historical-evidence-provenance.mjs';
export const CONTROL_PATHS = [
  POLICY_PATH,
  REVIEW_PATH,
  WORKFLOW_PATH,
  CLASSIFIER_PATH,
  QUALIFIER_PATH,
  VERIFIER_PATH,
];

// The vendor action omits skipReason when serializing SARIF. Validate its raw
// response before it can publish comments or turn a no-analysis response green.
export const PROMPTFOO_BUNDLE_SHA256 =
  'dfaa683013d457419f4246a9a17892fab6da368072fc2bd6e90857af7c67ac03';
export const PROMPTFOO_GUARD_VERSION = 'raw-response-v1';
export function validatePromptfooResponse(response) {
  if (
    response?.success !== true ||
    !Array.isArray(response.comments) ||
    response.skipReason !== undefined
  )
    throw new Error('Promptfoo analysis failed or skipped');
  if (response.review !== undefined && typeof response.review !== 'string')
    throw new Error('Malformed Promptfoo review');
  const review = (response.review || '').trim();
  if (
    /^no files to scan[.!]?$/i.test(review) ||
    /^(?:scan (?:was )?skipped|mock scan|running in act mode|fork pr scanning not authorized|authentication failed|authorization failed|setup failed)/i.test(
      review,
    )
  )
    throw new Error('Promptfoo did not perform genuine analysis');
}
export function insertPromptfooResponseGuard(bundle) {
  const responseAnchor = 'async function handleScanResponse(scanResponse, inputs, context3) {';
  const mockAnchor = 'function createMockScanResponse() {';
  for (const anchor of [responseAnchor, mockAnchor])
    if (bundle.split(anchor).length !== 2)
      throw new Error('Unknown or ambiguous pinned vendor guard anchor');
  const predicate = validatePromptfooResponse.toString();
  const guarded = bundle
    .replace(responseAnchor, `${responseAnchor}\n  (${predicate})(scanResponse);`)
    .replace(
      mockAnchor,
      `${mockAnchor}\n  throw new Error('Mock Promptfoo execution cannot qualify');`,
    );
  return {
    bundle: guarded,
    originalSha256: sha256(bundle),
    guardedSha256: sha256(guarded),
    guardVersion: PROMPTFOO_GUARD_VERSION,
    guardSha256: sha256(predicate),
    limits: [
      'Guard validates raw response completion; ordinary built-in file omissions remain disclosed',
    ],
  };
}
export function guardPromptfooAction(bundle) {
  if (sha256(bundle) !== PROMPTFOO_BUNDLE_SHA256)
    throw new Error('Pinned vendor bundle digest mismatch');
  return insertPromptfooResponseGuard(bundle);
}
export function prepareFullScanRefs(repo, base, head) {
  assertCommit(repo, base);
  assertCommit(repo, head);
  if (git(repo, 'rev-parse', 'HEAD').toString().trim() !== head)
    throw new Error('Wrong detached scan head');
  git(repo, 'update-ref', 'refs/heads/staging', base);
  if (git(repo, 'rev-parse', 'staging').toString().trim() !== base)
    throw new Error('Wrong prepared local scan base');
  return { base, head };
}

export function validateReview(review, policySha256) {
  if (
    review?.version !== 1 ||
    review.verdict !== 'approved-inert-retention-with-limits' ||
    review.sourceRevision !== SOURCE ||
    review.selectionManifestSha256 !== SELECTION ||
    review.allowlistSha256 !== policySha256 ||
    review.files !== 220 ||
    review.bytes !== 3_958_506 ||
    review.jsonFiles !== 139 ||
    !/^[a-f0-9]{64}$/.test(review.evidenceSha256) ||
    typeof review.reviewer !== 'string' ||
    !review.reviewer ||
    !Array.isArray(review.limits) ||
    review.limits.length < 3 ||
    !Array.isArray(review.coverage) ||
    review.coverage.length < 3
  )
    throw new Error('Missing or mismatched independent archive data review');
}

export function validateTarget(pr, expectedHead, expectedBase) {
  if (
    pr?.state !== 'open' ||
    pr.base?.repo?.full_name !== REPOSITORY ||
    pr.head?.repo?.full_name !== REPOSITORY ||
    pr.base.ref !== 'staging' ||
    pr.head.sha !== expectedHead ||
    pr.base.sha !== expectedBase ||
    !sha(expectedHead) ||
    !sha(expectedBase) ||
    !Number.isSafeInteger(pr.number) ||
    pr.number < 1
  )
    throw new Error('Wrong repository, target or stale PR head/base');
}

export function validateContext(context, base, head) {
  if (
    context?.repository !== REPOSITORY ||
    !Number.isSafeInteger(context.pr) ||
    context.pr < 1 ||
    !/^[1-9]\d*$/.test(String(context.runId)) ||
    !/^[1-9]\d*$/.test(String(context.runAttempt)) ||
    context.controlSource !== base ||
    context.base !== base ||
    context.head !== head
  )
    throw new Error('Invalid execution context binding');
  if (context.event === 'workflow_dispatch') {
    if (context.ref !== 'refs/heads/staging' || context.workflowSource !== base)
      throw new Error('Archive dispatch must run the current protected staging source');
  } else if (context.event === 'pull_request') {
    if (context.ref !== `refs/pull/${context.pr}/merge` || !sha(context.workflowSource))
      throw new Error('Invalid automatic PR execution ref');
  } else throw new Error('Unsupported qualification event');
}

export function controlIdentity(repo, commit) {
  return Object.fromEntries(
    CONTROL_PATHS.map((path) => {
      const entry = treeEntry(repo, commit, path);
      if (entry?.mode !== '100644' || entry.type !== 'blob')
        throw new Error(`Missing regular protected control: ${path}`);
      return [
        path,
        { blob: entry.blob, sha256: sha256(git(repo, 'cat-file', 'blob', entry.blob)) },
      ];
    }),
  );
}

export function validateAutomaticSource(repo, base, head, merge) {
  assertCommit(repo, merge);
  const parents = git(repo, 'show', '-s', '--format=%P', merge).toString().trim().split(' ');
  if (parents.length !== 2 || parents[0] !== base || parents[1] !== head)
    throw new Error('Automatic merge source is not the qualified base/head');
  const baseWorkflow = treeEntry(repo, base, WORKFLOW_PATH);
  const mergeWorkflow = treeEntry(repo, merge, WORKFLOW_PATH);
  if (
    !baseWorkflow ||
    !mergeWorkflow ||
    baseWorkflow.mode !== '100644' ||
    mergeWorkflow.mode !== '100644' ||
    baseWorkflow.blob !== mergeWorkflow.blob
  )
    throw new Error('Automatic executed workflow differs from protected policy');
}

export function validateArchiveData(repo, head, policy) {
  let jsonFiles = 0;
  const secretCandidates = [];
  const patterns = [
    { category: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
    { category: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_\w{70,})\b/g },
    { category: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
    { category: 'provider-token', pattern: /\bsk-(?:proj-|ant-api\d+-)?[A-Za-z0-9_-]{32,}\b/g },
  ];
  for (const file of policy.files) {
    const bytes = git(repo, 'cat-file', 'blob', file.blob);
    if (
      treeEntry(repo, head, file.path)?.blob !== file.blob ||
      bytes.length !== file.bytes ||
      sha256(bytes) !== file.sha256
    )
      throw new Error('Data changed after classification');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\0')) throw new Error('Unexpected NUL archive data');
    if (file.path.endsWith('.json')) {
      JSON.parse(text);
      jsonFiles++;
    }
    for (const { category, pattern } of patterns) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern))
        secretCandidates.push({
          path: file.path,
          category,
          offset: match.index,
          candidateSha256: sha256(match[0]),
        });
    }
  }
  if (jsonFiles !== 139) throw new Error('JSON coverage mismatch');
  if (secretCandidates.length)
    throw new Error(
      `Unresolved high-confidence credential signatures: ${secretCandidates.length}; no secret values printed`,
    );
  return {
    files: policy.count,
    bytes: policy.bytes,
    jsonFiles,
    utf8Files: policy.count,
    highConfidenceCredentialCandidates: secretCandidates.length,
    limits: [
      'Four high-confidence credential signature families only; not exhaustive secret detection',
      'Literal consumer inspection is independent review evidence; dynamic discovery is not excluded',
      'No execution, import or application of archive contents; not Promptfoo analysis',
    ],
  };
}

export function qualifyHistoricalEvidence({ repo, base, head, context }) {
  validateContext(context, base, head);
  const classification = classifyHistoricalEvidence({ repo, base, head });
  if (classification.route !== 'archive')
    throw new Error(`Not eligible for archive provenance: ${classification.reason}`);
  if (context.event === 'pull_request')
    validateAutomaticSource(repo, base, head, context.workflowSource);
  const { policy } = readPolicy(repo, base);
  const reviewEntry = treeEntry(repo, base, REVIEW_PATH);
  if (reviewEntry?.mode !== '100644' || reviewEntry.type !== 'blob')
    throw new Error('Protected independent review receipt missing');
  const reviewBytes = git(repo, 'cat-file', 'blob', reviewEntry.blob);
  const review = JSON.parse(reviewBytes.toString('utf8'));
  validateReview(review, classification.policySha256);
  return {
    version: 1,
    qualification: 'historical-archive-not-promptfoo-analysis',
    ...context,
    classification,
    controls: controlIdentity(repo, base),
    reviewSha256: sha256(reviewBytes),
    independentReviewEvidenceSha256: review.evidenceSha256,
    validation: validateArchiveData(repo, head, policy),
  };
}

export function githubApiUrl(path) {
  if (typeof path !== 'string' || path.length > 256 || /[^\x20-\x7e]/.test(path))
    throw new Error('Invalid GitHub API route');
  const id = '[1-9]\\d*';
  const page = '(?:\\?per_page=100&page=([1-9]\\d*))?';
  const routes = [
    new RegExp(`^pulls/(${id})$`),
    /^git\/ref\/heads\/staging$/,
    new RegExp(`^actions/runs/(${id})$`),
    new RegExp(`^actions/runs/(${id})/attempts/(${id})/jobs${page}$`),
    new RegExp(`^actions/runs/(${id})/artifacts${page}$`),
    new RegExp(`^actions/artifacts/(${id})/zip$`),
  ];
  const match = routes.map((route) => route.exec(path)).find(Boolean);
  const workflow =
    /^actions\/workflows\/promptfoo-code-scan\.yml\/runs\?event=pull_request&head_sha=([a-f0-9]{40})(?:&per_page=100&page=([1-9]\d*))?$/.exec(
      path,
    );
  if (!match && !workflow) throw new Error('Unsupported GitHub API route/query');
  const numeric = match
    ? match.slice(1).filter((value) => value !== undefined)
    : [workflow[2]].filter((value) => value !== undefined);
  if (numeric.some((value) => !Number.isSafeInteger(Number(value)) || Number(value) < 1))
    throw new Error('Invalid numeric GitHub API identity');
  const pagination = /(?:[?&])per_page=100&page=([1-9]\d*)$/.exec(path);
  if (pagination && Number(pagination[1]) > 20) throw new Error('Invalid bounded API page');
  return new URL(path, 'https://api.github.com/repos/jwill9999/agent-platform/').href;
}

export async function githubJson(path, token) {
  const response = await fetch(githubApiUrl(path), {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`GitHub read failed: ${response.status}`);
  return response.json();
}

export function fetchObjects(repo, refs, token) {
  validateDataRepoPath(repo);
  if (!Array.isArray(refs) || refs.length < 1 || refs.length > 4 || !refs.every(sha))
    throw new Error('Invalid requested object identities');
  mkdirSync(repo, { recursive: false });
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
  const args = ['-c', 'core.hooksPath=/dev/null'];
  execFileSync(GIT_EXECUTABLE, [...args, 'init', '--bare', repo], {
    env,
    stdio: 'pipe',
    timeout: 30_000,
  });
  execFileSync(
    GIT_EXECUTABLE,
    [
      ...args,
      '-C',
      repo,
      'fetch',
      '--no-tags',
      '--no-recurse-submodules',
      `https://github.com/${REPOSITORY}.git`,
      ...refs,
    ],
    { env, stdio: 'pipe', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
  );
}

function validateWorkflowTarget(event, eventName, ref, workflowSource, base, head) {
  if (
    eventName === 'pull_request' &&
    (event.pull_request.head.sha !== head || event.pull_request.base.sha !== base)
  )
    throw new Error('Stale automatic event');
  if (
    eventName === 'workflow_dispatch' &&
    (ref !== 'refs/heads/staging' || workflowSource !== base)
  )
    throw new Error('Dispatch source is not current protected staging');
}
function writeFullRoute(outputPath, githubOutput, context, record) {
  const { base, head } = context;
  if (githubOutput) appendFileSync(githubOutput, `route=full\nbase=${base}\nhead=${head}\n`);
  writeFileSync(outputPath, JSON.stringify({ version: 1, ...context, ...record }, null, 2) + '\n');
  return { route: 'full', base, head };
}

export async function runQualification({
  event,
  eventName,
  ref,
  workflowSource,
  runId,
  runAttempt,
  repository,
  token,
  directory,
  outputPath,
  githubOutput,
}) {
  if (repository !== REPOSITORY || !token || !directory || !outputPath || !sha(workflowSource))
    throw new Error('Missing trusted workflow inputs');
  const value =
    eventName === 'workflow_dispatch' ? event.inputs?.pr_number : event.pull_request?.number;
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new Error('Invalid PR number');
  const pr = await githubJson(`pulls/${value}`, token);
  const base = pr.base?.sha;
  const head = pr.head?.sha;
  validateTarget(pr, head, base);
  validateWorkflowTarget(event, eventName, ref, workflowSource, base, head);
  const protectedTip = await githubJson('git/ref/heads/staging', token);
  if (protectedTip.object?.sha !== base) throw new Error('Protected base changed');
  const repo = join(directory, 'objects.git');
  fetchObjects(repo, [base, head, workflowSource], token);
  const context = {
    repository,
    pr: pr.number,
    base,
    head,
    event: eventName,
    ref,
    workflowSource,
    controlSource: base,
    runId: String(runId),
    runAttempt: String(runAttempt),
  };
  validateContext(context, base, head);
  const protectedClassifier = treeEntry(repo, base, CLASSIFIER_PATH);
  const protectedPolicy = treeEntry(repo, base, POLICY_PATH);
  // Bootstrap is full-scan only. A partially installed policy is an error, not fallback.
  if (!protectedClassifier && !protectedPolicy && eventName === 'pull_request') {
    return writeFullRoute(outputPath, githubOutput, context, {
      route: 'full',
      reason: 'protected-policy-not-adopted',
    });
  }
  if (!protectedClassifier || !protectedPolicy) throw new Error('Protected policy is incomplete');
  const classification = classifyHistoricalEvidence({ repo, base, head });
  if (classification.route !== 'archive') {
    if (eventName === 'workflow_dispatch')
      throw new Error(`Archive provenance denied: ${classification.reason}`);
    return writeFullRoute(outputPath, githubOutput, context, { classification });
  }
  const receipt = qualifyHistoricalEvidence({ repo, base, head, context });
  const after = await githubJson(`pulls/${pr.number}`, token);
  validateTarget(after, head, base);
  if ((await githubJson('git/ref/heads/staging', token)).object?.sha !== base)
    throw new Error('Protected base moved during qualification');
  writeFileSync(outputPath, JSON.stringify(receipt, null, 2) + '\n');
  if (githubOutput) appendFileSync(githubOutput, `route=archive\nbase=${base}\nhead=${head}\n`);
  return { route: 'archive', base, head };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    await runQualification({
      event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
      eventName: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF,
      workflowSource: process.env.GITHUB_SHA,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GH_TOKEN,
      directory: process.env.ARCHIVE_DATA_DIR,
      outputPath: process.env.ARCHIVE_RECEIPT_PATH,
      githubOutput: process.env.GITHUB_OUTPUT,
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
