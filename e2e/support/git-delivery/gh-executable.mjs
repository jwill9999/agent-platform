#!/usr/bin/env node
// Inert external-boundary fixture. Never delegates to gh or accesses the network.
import {
  existsSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { join, isAbsolute } from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const fields = 'number,url,headRefName,baseRefName,title,body,isDraft';
const panelFields =
  'number,title,state,url,headRefName,baseRefName,author,isDraft,reviewDecision,mergeable,createdAt,updatedAt,statusCheckRollup';
const checkFields = 'number,url,statusCheckRollup';

function exact(args, expected) {
  return args.length === expected.length && args.every((arg, index) => arg === expected[index]);
}

function panelRead(args, repository) {
  if (exact(args, ['--version'])) return { kind: 'version' };
  if (exact(args, ['auth', 'status', '--hostname', 'github.com'])) return { kind: 'auth' };
  if (exact(args, ['repo', 'view', repository, '--json', 'url'])) return { kind: 'repository' };
  if (isCommitChecks(args, repository)) return { kind: 'commit-checks' };
  return panelPrRead(args, repository);
}

function isCommitChecks(args, repository) {
  if (args[0] !== 'api') return false;
  const prefix = `repos/${repository}/commits/`;
  const endpoint = args[1] ?? '';
  const sha = endpoint.slice(prefix.length, -'/check-runs'.length);
  return (
    endpoint.startsWith(prefix) &&
    /^[a-f0-9]{40}$/.test(sha) &&
    exact(args, ['api', `${prefix}${sha}/check-runs`, '--jq', '.check_runs'])
  );
}

function panelPrRead(args, repository) {
  if (args[0] !== 'pr') return undefined;
  if (args[1] === 'view' && args.includes('--')) {
    const branch = args[7];
    if (
      typeof branch === 'string' &&
      branch.length > 0 &&
      branch.length <= 255 &&
      ![...branch].some(
        (character) => character.codePointAt(0) <= 32 || character.codePointAt(0) === 127,
      ) &&
      exact(args, ['pr', 'view', '--repo', repository, '--json', checkFields, '--', branch])
    )
      return { kind: 'pr-checks', branch };
    throw new Error('Unexpected fixture query');
  }
  if (args[1] === 'view') {
    const input = options(args.slice(2), ['--repo', '--json']);
    if (input['--repo'] === repository && input['--json'] === checkFields)
      return { kind: 'pr-checks' };
    throw new Error('Unexpected fixture query');
  }
  if (args[1] === 'list' && args.includes('--limit')) {
    const input = options(args.slice(2), ['--repo', '--state', '--limit', '--json']);
    if (
      input['--repo'] === repository &&
      input['--state'] === 'open' &&
      input['--limit'] === '30' &&
      input['--json'] === panelFields
    )
      return { kind: 'panel-list' };
    throw new Error('Unexpected fixture query');
  }
  return undefined;
}

function options(args, required, optional = []) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (![...required, ...optional].includes(option) || Object.hasOwn(result, option)) {
      throw new Error('Unsupported fixture arguments');
    }
    if (option === '--draft') {
      result[option] = true;
    } else {
      const value = args[++index];
      const maximum = option === '--body' ? 65536 : 16384;
      if (typeof value !== 'string' || value.length > maximum)
        throw new Error('Missing fixture value');
      result[option] = value;
    }
  }
  if (required.some((key) => !Object.hasOwn(result, key)))
    throw new Error('Missing fixture option');
  return result;
}

function parse(args, repository) {
  const read = panelRead(args, repository);
  if (read) return read;
  if (args.length === 2 && args[0] === 'auth' && args[1] === 'status') return { kind: 'auth' };
  if (args[0] !== 'pr') throw new Error('Unsupported fixture command');
  const shared = ['--repo', '--head', '--base'];
  const kind = args[1];
  let input;
  if (kind === 'list') input = options(args.slice(2), [...shared, '--state', '--json']);
  else if (kind === 'create')
    input = options(args.slice(2), [...shared, '--title', '--body'], ['--draft']);
  else throw new Error('Unsupported fixture command');
  if (input['--repo'] !== repository || !input['--head'] || !input['--base']) {
    throw new Error('Unexpected fixture repository or branch');
  }
  if (kind === 'list' && (input['--state'] !== 'open' || input['--json'] !== fields)) {
    throw new Error('Unexpected fixture query');
  }
  if (kind === 'create' && !input['--title'].trim()) throw new Error('Empty fixture PR title');
  return { kind, input };
}

function readResult(request, config, ledger) {
  if (request.kind === 'version') return { code: 0, output: 'gh version 0.0.0 (owned fixture)\n' };
  if (request.kind === 'repository')
    return {
      code: 0,
      output: JSON.stringify({ url: 'https://github.com/' + config.repository }) + '\n',
    };
  if (!['panel-list', 'pr-checks', 'commit-checks'].includes(request.kind)) return undefined;
  if (config.enrichmentFailure && ledger.pullRequests.length > 0)
    return { code: 1, error: 'Fixture PR query unavailable' };
  if (request.kind === 'commit-checks') return { code: 0, output: '[]\n' };
  if (request.kind === 'panel-list') {
    const rows = ledger.pullRequests.slice(0, 30).map((pr) => ({
      number: pr.number,
      url: pr.url,
      title: pr.title,
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName,
      isDraft: pr.isDraft,
      state: 'OPEN',
      statusCheckRollup: [],
    }));
    return { code: 0, output: `${JSON.stringify(rows)}\n` };
  }
  const rows = ledger.pullRequests.filter(
    (pr) => pr.headRefName === (request.branch ?? config.currentBranch),
  );
  if (rows.length !== 1)
    return { code: 1, error: 'No unambiguous fixture pull request for branch' };
  const { number, url } = rows[0];
  return { code: 0, output: `${JSON.stringify({ number, url, statusCheckRollup: [] })}\n` };
}

function dispatch(request, config, ledger) {
  const read = readResult(request, config, ledger);
  if (read) return read;
  if (request.kind === 'auth') {
    return config.authFailure
      ? { code: 1, error: 'Fixture authentication unavailable' }
      : { code: 0, output: 'Fixture authentication ready\n' };
  }
  const { input } = request;
  const existing = ledger.pullRequests.filter(
    (pr) => pr.headRefName === input['--head'] && pr.baseRefName === input['--base'],
  );
  if (request.kind === 'list') {
    return config.enrichmentFailure && ledger.pullRequests.length > 0
      ? { code: 1, error: 'Fixture PR query unavailable' }
      : { code: 0, output: `${JSON.stringify(existing)}\n` };
  }
  if (existing.length) return { code: 1, error: 'Fixture pull request already exists' };
  const number = ledger.pullRequests.length + 1;
  const pr = {
    number,
    url: `https://github.com/${config.repository}/pull/${number}`,
    headRefName: input['--head'],
    baseRefName: input['--base'],
    title: input['--title'],
    body: input['--body'],
    isDraft: input['--draft'] === true,
  };
  ledger.pullRequests.push(pr);
  if (config.loseCreateResponseOnce && !ledger.lostResponseConsumed) {
    ledger.lostResponseConsumed = true;
    return { code: 1, error: 'Fixture response lost after creation' };
  }
  return { code: 0, output: `${pr.url}\n` };
}

const LOCK_BUDGET_MS = 1000;

async function lockDelay(milliseconds, signal) {
  try {
    await delay(milliseconds, undefined, { signal });
  } catch (error) {
    if (!signal.aborted) throw error;
  }
}

async function acquireLock(lock, owner, signal) {
  const start = performance.now();
  async function attempt(first) {
    if (signal.aborted || (!first && performance.now() - start >= LOCK_BUDGET_MS))
      return { acquired: false, waitMs: Math.ceil(performance.now() - start) };
    try {
      const descriptor = openSync(lock, 'wx', 0o600);
      try {
        writeFileSync(descriptor, owner);
      } finally {
        closeSync(descriptor);
      }
      return { acquired: true, waitMs: Math.ceil(performance.now() - start) };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const remaining = LOCK_BUDGET_MS - (performance.now() - start);
    if (remaining > 0) await lockDelay(Math.min(10, remaining), signal);
    return attempt(false);
  }
  return attempt(true);
}

function finishClaim(claimed, claim, record, cancel) {
  try {
    if (claimed) {
      try {
        record();
      } finally {
        // The claim protects every fixture write, including the final receipt.
        unlinkSync(claim);
      }
    }
  } finally {
    process.off('SIGTERM', cancel);
    process.off('SIGINT', cancel);
  }
}

async function run() {
  const directory = process.env.GIT_DELIVERY_GH_FIXTURE_DIR;
  if (!directory || !isAbsolute(directory)) throw new Error('Owned fixture directory required');
  const owner = randomUUID();
  const lock = join(directory, 'active.lock');
  const claim = join(directory, `claim.${owner}`);
  const temporary = join(directory, `ledger.${owner}.tmp`);
  const receiptPath = join(directory, `receipt.${owner}.json`);
  const receiptTemporary = `${receiptPath}.tmp`;
  const receipt = {
    version: 1,
    kind: 'unknown',
    stage: 'configuration',
    outcome: 'running',
    startedAtMs: Date.now(),
    waitMs: 0,
    lockBudgetMs: LOCK_BUDGET_MS,
  };
  let claimed = false;
  let acquired = false;
  const cancellation = new globalThis.AbortController();
  const cancel = () => cancellation.abort();
  const record = () => {
    writeFileSync(receiptTemporary, JSON.stringify(receipt), { mode: 0o600 });
    renameSync(receiptTemporary, receiptPath);
  };
  try {
    const config = JSON.parse(readFileSync(join(directory, 'config.json'), 'utf8'));
    if (config.version !== 1) throw new Error('Unsupported fixture version');
    // Invalid commands never acquire claims, the lock or ledger effects.
    receipt.stage = 'validation';
    const request = parse(process.argv.slice(2), config.repository);
    receipt.kind = request.kind;
    process.on('SIGTERM', cancel);
    process.on('SIGINT', cancel);
    receipt.stage = 'claim';
    closeSync(openSync(claim, 'wx', 0o600));
    claimed = true;
    receipt.stage = 'waiting';
    record();
    const ownership = await acquireLock(lock, owner, cancellation.signal);
    receipt.waitMs = ownership.waitMs;
    acquired = ownership.acquired;
    if (cancellation.signal.aborted) {
      receipt.outcome = 'cancelled';
      process.exitCode = 2;
      process.stderr.write('Owned GitHub fixture invocation cancelled\n');
      return;
    }
    if (!acquired) {
      receipt.outcome = 'lock_timeout';
      process.exitCode = 2;
      process.stderr.write('Owned GitHub fixture lock deadline exceeded\n');
      return;
    }
    receipt.stage = 'ledger_read';
    const path = join(directory, 'ledger.json');
    const ledger = JSON.parse(readFileSync(path, 'utf8'));
    receipt.stage = 'dispatch';
    const result = dispatch(request, config, ledger);
    ledger.calls.push({
      args: process.argv.slice(2),
      outcome: result.code === 0 ? 'success' : 'error',
    });
    receipt.stage = 'persist';
    writeFileSync(temporary, `${JSON.stringify(ledger)}\n`, { mode: 0o600 });
    renameSync(temporary, path);
    receipt.stage = 'output';
    if (result.output) process.stdout.write(result.output);
    if (result.error) process.stderr.write(`${result.error}\n`);
    process.exitCode = result.code;
    receipt.outcome = result.code === 0 ? 'success' : 'command_error';
    receipt.stage = 'complete';
  } catch {
    receipt.outcome = 'fixture_error';
    process.stderr.write('Invalid or busy owned GitHub fixture invocation\n');
    process.exitCode = 2;
  } finally {
    try {
      if (existsSync(temporary)) unlinkSync(temporary);
      // A queued or timed-out invocation must never release another invocation's lock.
      if (acquired && readFileSync(lock, 'utf8') === owner) unlinkSync(lock);
    } catch {
      receipt.stage = 'cleanup';
      receipt.outcome = 'fixture_error';
      process.exitCode = 2;
    } finally {
      finishClaim(claimed, claim, record, cancel);
    }
  }
}

try {
  await run();
} catch {
  process.stderr.write('Owned GitHub fixture evidence or cleanup failed\n');
  process.exitCode = 2;
}
