import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import console from 'node:console';
import { setTimeout, clearTimeout, setInterval, clearInterval } from 'node:timers';
import { createServer } from 'node:http';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

export const revision = 'a1d282b36b6f3519aa1f3fc636f609c47dddb294';
export const runtimeFiles = Object.freeze(
  [
    {
      name: 'index.js',
      bytes: 5655958,
      gitBlob: '2da57a506bca32ba8fc714566f3561f962df53fb',
      sha256: '8293b43940d75b363bd2649be9a89349a697044ff53444b6fcb96bed4adbb37b',
    },
    {
      name: 'index.js.map',
      bytes: 6600095,
      gitBlob: '87e80840130481412bf48172ccb2130d40d00324',
      sha256: 'ae9698cf9c2dba36d469fc3f8bb8a937c99e631633a2ffd4cba288a64c56acf4',
    },
    {
      name: 'sourcemap-register.js',
      bytes: 41053,
      gitBlob: 'cb1fb13627f07ab9250566c7069e0756f882663a',
      sha256: 'c2a14a81784d12c15b7baeed88c1faae3457e84890d1e5244cbfc0f4455b5e06',
    },
  ].map(Object.freeze),
);
export const vendorDirectory = join(tmpdir(), 'agent-platform-dependency-vendor');
export const receiptDirectory = join(tmpdir(), 'agent-platform-dependency-vendor-results');
const base = '1'.repeat(40);
const head = '2'.repeat(40);
const route = `/repos/fixture-owner/fixture-repo/dependency-graph/compare/${base}...${head}?per_page=5`;
const fileLimit = 1024 * 1024;
const streamLimit = 256 * 1024;
const deadlineMs = 20000;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const privateWrite = (path, value) => writeFileSync(path, value, { mode: 0o600, flag: 'wx' });

export function readRegularBounded(path, limit) {
  assert.ok(lstatSync(path).isFile(), 'Expected a regular non-symlink file');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    assert.ok(stat.isFile() && stat.size <= limit, 'File exceeds its regular-file bound');
    const storage = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < storage.length) {
      const count = readSync(fd, storage, length, storage.length - length, null);
      if (count === 0) break;
      length += count;
    }
    assert.ok(length <= limit && length === stat.size, 'File changed or exceeded bound');
    return storage.subarray(0, length);
  } finally {
    closeSync(fd);
  }
}

export function gitBlobId(bytes) {
  const result = spawnSync(
    '/usr/bin/git',
    ['hash-object', '--stdin', '-t', 'blob', '--no-filters'],
    {
      input: bytes,
      cwd: '/',
      env: {
        PATH: '/usr/bin:/bin',
        HOME: '/',
        LC_ALL: 'C',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
      },
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 128,
    },
  );
  assert.equal(result.status, 0, 'Canonical Git blob computation failed');
  assert.equal(result.signal, null, 'Canonical Git blob computation terminated');
  assert.match(result.stdout, /^[0-9a-f]{40}\n$/, 'Malformed Git blob identity');
  return result.stdout.trimEnd();
}

export function verifyRuntime(directory) {
  return runtimeFiles.map((expected) => {
    const bytes = readRegularBounded(join(directory, expected.name), expected.bytes);
    assert.equal(bytes.length, expected.bytes, 'Vendor size mismatch');
    assert.equal(hash(bytes), expected.sha256, 'Vendor SHA-256 mismatch');
    assert.equal(gitBlobId(bytes), expected.gitBlob, 'Vendor Git blob mismatch');
    return { ...expected, bytes };
  });
}

export function parseOutputs(bytes) {
  assert.ok(bytes.length <= fileLimit, 'Action output exceeds bound');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const outputs = Object.create(null);
  const lines = text.split('\n');
  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor];
    cursor++;
    if (line === '' && cursor === lines.length) break;
    const match = /^([a-z][a-z-]*)<<(ghadelimiter_[0-9a-f-]+)$/.exec(line);
    assert.ok(match, 'Unexpected action output framing');
    const [, key, delimiter] = match;
    assert.ok(!Object.hasOwn(outputs, key), 'Duplicate action output');
    const parts = [];
    while (cursor < lines.length && lines[cursor] !== delimiter) {
      parts.push(lines[cursor]);
      cursor++;
    }
    assert.ok(cursor < lines.length - 1, 'Truncated action output');
    cursor++;
    outputs[key] = parts.join('\n');
  }
  return outputs;
}

function change(name, version, scope, severity, ghsa, changeType = 'added') {
  return {
    change_type: changeType,
    manifest: 'pnpm-lock.yaml',
    ecosystem: 'npm',
    name,
    version,
    scope,
    package_url: `pkg:npm/${name}@${version}`,
    license: 'MIT',
    source_repository_url: null,
    vulnerabilities: [
      {
        severity,
        advisory_ghsa_id: ghsa,
        advisory_summary: 'Deterministic fixture advisory; not a live graph result',
        advisory_url: `https://github.com/advisories/${ghsa}`,
      },
    ],
  };
}
const vitest = () => change('vitest', '2.1.9', 'development', 'critical', 'GHSA-5xrq-8626-4rwp');
const next = (severity = 'critical', type = 'added') =>
  change('next', '15.5.15', 'runtime', severity, 'GHSA-p293-qw3h-jr36', type);
const unknown = () => change('unknown-fixture', '1.0.0', 'unknown', 'high', 'GHSA-xxxx-yyyy-zzzz');
const fixtures = [
  { name: 'clean', rows: [], vulnerable: [], exit: 0 },
  { name: 'below-threshold', rows: [next('moderate')], vulnerable: [], exit: 0 },
  { name: 'removed-critical', rows: [next('critical', 'removed')], vulnerable: [], exit: 0 },
  {
    name: 'critical-development-and-runtime',
    rows: [vitest(), next()],
    vulnerable: [vitest(), next()],
    exit: 1,
  },
  { name: 'high-unknown', rows: [unknown()], vulnerable: [unknown()], exit: 1 },
  {
    name: 'authentication-failure-not-analysis',
    rows: { message: 'Bad credentials' },
    status: 401,
    exit: 1,
  },
];

export function fixtureEnvironment(directory, port) {
  return {
    PATH: '/usr/bin:/bin',
    HOME: directory,
    GITHUB_ACTIONS: 'true',
    GITHUB_ACTION: 'dependency-fixture',
    GITHUB_REPOSITORY: 'fixture-owner/fixture-repo',
    GITHUB_WORKSPACE: directory,
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_EVENT_PATH: join(directory, 'event.json'),
    GITHUB_RUN_ID: '0',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_API_URL: `http://127.0.0.1:${port}`,
    GITHUB_GRAPHQL_URL: `http://127.0.0.1:${port}/graphql`,
    GITHUB_OUTPUT: join(directory, 'output.txt'),
    GITHUB_STEP_SUMMARY: join(directory, 'summary.md'),
    'INPUT_REPO-TOKEN': 'fixture-not-a-real-token',
    'INPUT_BASE-REF': base,
    'INPUT_HEAD-REF': head,
    'INPUT_FAIL-ON-SEVERITY': 'high',
    'INPUT_FAIL-ON-SCOPES': 'runtime, development, unknown',
    'INPUT_VULNERABILITY-CHECK': 'true',
    'INPUT_LICENSE-CHECK': 'false',
    'INPUT_SHOW-OPENSSF-SCORECARD': 'false',
    'INPUT_COMMENT-SUMMARY-IN-PR': 'never',
    'INPUT_WARN-ONLY': 'false',
    'INPUT_RETRY-ON-SNAPSHOT-WARNINGS': 'false',
  };
}

function fixtureServer(fixture, requests) {
  return createServer((req, res) => {
    const allowed =
      req.method === 'GET' &&
      req.url === route &&
      req.socket.remoteAddress === '127.0.0.1' &&
      req.headers.authorization === 'token fixture-not-a-real-token';
    requests.push({ method: req.method, route: req.url, allowed });
    res.writeHead(allowed ? (fixture.status ?? 200) : 400, {
      'content-type': 'application/json',
      'x-github-request-id': 'DETERMINISTIC-LOCAL-FIXTURE',
    });
    res.end(JSON.stringify(allowed ? fixture.rows : { message: 'Unexpected fixture request' }));
  });
}

function boundedStream(stream, child, chunks, state) {
  let bytes = 0;
  stream.on('data', (chunk) => {
    const remaining = Math.max(0, streamLimit - bytes);
    if (remaining > 0) chunks.push(chunk.subarray(0, remaining));
    bytes += chunk.length;
    if (bytes > streamLimit) {
      state.failure = 'Vendor stream exceeded bound';
      child.kill('SIGKILL');
    }
  });
}

async function executeVendor(bundle, directory, env) {
  const child = spawn(process.execPath, [bundle], {
    cwd: directory,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = [],
    stderr = [],
    state = {};
  boundedStream(child.stdout, child, stdout, state);
  boundedStream(child.stderr, child, stderr, state);
  const deadline = setTimeout(() => {
    state.failure = 'Vendor deadline exceeded';
    child.kill('SIGKILL');
  }, deadlineMs);
  const monitor = setInterval(() => {
    try {
      for (const name of ['output.txt', 'summary.md']) {
        if (statSync(join(directory, name)).size > fileLimit)
          throw new Error('Output bound exceeded');
      }
    } catch {
      state.failure = 'Vendor file missing or exceeded bound';
      child.kill('SIGKILL');
    }
  }, 10);
  try {
    const result = await new Promise((resolveExit) => {
      child.once('error', () => {
        state.failure = 'Vendor process could not start';
      });
      child.once('close', (code, signal) => resolveExit({ code, signal }));
    });
    return {
      ...result,
      failure: state.failure,
      stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr),
    };
  } finally {
    clearTimeout(deadline);
    clearInterval(monitor);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
}

function verifyCase(fixture, result, requests, outputs) {
  assert.equal(result.code, fixture.exit, 'Unexpected vendor exit');
  assert.equal(requests.length, 1, 'Vendor must make exactly one request without retries');
  assert.ok(requests[0].allowed, 'Unexpected vendor request');
  if (fixture.status === 401) {
    assert.equal(
      outputs['dependency-changes'],
      undefined,
      'Authentication failure cannot qualify analysis',
    );
    assert.equal(
      outputs['vulnerable-changes'],
      undefined,
      'Authentication failure cannot qualify rejection',
    );
    return;
  }
  assert.deepEqual(
    JSON.parse(outputs['dependency-changes']),
    fixture.rows,
    'Full vendor inventory mismatch',
  );
  assert.deepEqual(
    JSON.parse(outputs['vulnerable-changes']),
    fixture.vulnerable,
    'Vendor policy result mismatch',
  );
}

async function closeFixtureServer(server, failure) {
  try {
    server.closeAllConnections();
    await new Promise((closed, reject) =>
      server.close((error) => (error ? reject(error) : closed())),
    );
  } catch (error) {
    if (!failure) throw error;
  }
}

export async function runCase(fixture, bundle, root) {
  const directory = join(root, fixture.name);
  mkdirSync(directory, { mode: 0o700 });
  privateWrite(join(directory, 'output.txt'), '');
  privateWrite(join(directory, 'summary.md'), '');
  privateWrite(
    join(directory, 'event.json'),
    JSON.stringify({
      repository: { owner: { login: 'fixture-owner' }, name: 'fixture-repo', private: false },
      pull_request: { number: 1, base: { sha: base }, head: { sha: head } },
    }),
  );
  const requests = [];
  const server = fixtureServer(fixture, requests);
  await new Promise((listen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', listen);
  });
  const start = performance.now();
  let result;
  let phase = 'execution';
  let failure;
  try {
    result = await executeVendor(
      bundle,
      directory,
      fixtureEnvironment(directory, server.address().port),
    );
    let evidenceError;
    try {
      privateWrite(join(directory, 'stdout.log'), result.stdout);
      privateWrite(join(directory, 'stderr.log'), result.stderr);
    } catch (error) {
      evidenceError = error;
    }
    assert.equal(result.failure, undefined, result.failure);
    assert.equal(result.signal, null, 'Vendor terminated by signal');
    if (evidenceError) throw evidenceError;
    phase = 'output-read';
    const output = readRegularBounded(join(directory, 'output.txt'), fileLimit);
    readRegularBounded(join(directory, 'summary.md'), fileLimit);
    phase = 'output-parse';
    const outputs = parseOutputs(output);
    phase = 'policy-verification';
    verifyCase(fixture, result, requests, outputs);
    return {
      name: fixture.name,
      exit: result.code,
      elapsedMs: performance.now() - start,
      requests,
      inputSha256: hash(JSON.stringify(fixture.rows)),
      outputBytes: output.length,
      outputSha256: hash(output),
      stdoutSha256: hash(result.stdout),
      stderrSha256: hash(result.stderr),
      fullChanges: fixture.status ? null : fixture.rows.length,
      vulnerableChanges: fixture.status ? null : fixture.vulnerable.length,
      qualified: true,
    };
  } catch (error) {
    failure = error;
    try {
      privateWrite(
        join(directory, 'failure.json'),
        `${JSON.stringify(
          {
            qualified: false,
            phase,
            category: result?.failure ?? phase,
            exit: result?.code ?? null,
            signal: result?.signal ?? null,
            requests,
            elapsedMs: performance.now() - start,
            stdoutSha256: result ? hash(result.stdout) : null,
            stderrSha256: result ? hash(result.stderr) : null,
          },
          null,
          2,
        )}\n`,
      );
    } catch {
      /* Evidence failure must not replace the original failure. */
    }
    throw error;
  } finally {
    await closeFixtureServer(server, failure);
  }
}

async function runFixtureSequence(index, bundle, directory) {
  if (index === fixtures.length) return [];
  const result = await runCase(fixtures[index], bundle, directory);
  const remaining = await runFixtureSequence(index + 1, bundle, directory);
  return [result, ...remaining];
}

export async function runFixtures(runtimeDirectory, resultsDirectory) {
  const verified = verifyRuntime(runtimeDirectory);
  const scratch = mkdtempSync(join(tmpdir(), 'dependency-vendor-fixture-'));
  mkdirSync(resultsDirectory, { mode: 0o700, recursive: true });
  const runtime = join(scratch, 'runtime');
  mkdirSync(runtime, { mode: 0o700 });
  try {
    // Execute private copies of precisely verified bytes, avoiding a mutable download-path race.
    for (const file of verified) privateWrite(join(runtime, file.name), file.bytes);
    const results = await runFixtureSequence(0, join(runtime, 'index.js'), resultsDirectory);
    const sourceSha256 = hash(readFileSync(fileURLToPath(import.meta.url)));
    const receipt = {
      node: process.version,
      utc: new Date().toISOString(),
      sourceSha256,
      repository: 'actions/dependency-review-action',
      revision,
      runtimeFiles,
      base,
      head,
      policy: { failOnSeverity: 'high', failOnScopes: ['runtime', 'development', 'unknown'] },
      realCredentialsUsed: false,
      candidateSourceExecuted: false,
      packageInstallation: false,
      retries: 0,
      deadlineMs,
      streamLimit,
      fileLimit,
      limitations: [
        'Deterministic official-bundle API fixtures; not live hosted graph or advisory qualification.',
        'No OS network sandbox; the pinned vendor is configured with only a loopback API endpoint.',
        'File bounds are monitored and validated; no OS disk quota is imposed.',
      ],
      results,
    };
    privateWrite(
      join(resultsDirectory, 'qualified-result.json'),
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
    return receipt;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(
      process.argv.length,
      2,
      'The dependency vendor fixture command accepts no path arguments',
    );
    const receipt = await runFixtures(vendorDirectory, receiptDirectory);
    console.log(JSON.stringify({ qualified: receipt.results.length, revision: receipt.revision }));
  } catch {
    console.error(
      'Official dependency vendor fixtures did not qualify; inspect retained local artifacts.',
    );
    process.exitCode = 1;
  }
}
