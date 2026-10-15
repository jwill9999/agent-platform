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
  const input =
    kind === 'list'
      ? options(args.slice(2), [...shared, '--state', '--json'])
      : kind === 'create'
        ? options(args.slice(2), [...shared, '--title', '--body'], ['--draft'])
        : (() => {
            throw new Error('Unsupported fixture command');
          })();
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
      output: `${JSON.stringify({ url: `https://github.com/${config.repository}` })}\n`,
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
  const rows = ledger.pullRequests.filter((pr) => pr.headRefName === config.currentBranch);
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

function run() {
  const directory = process.env.GIT_DELIVERY_GH_FIXTURE_DIR;
  if (!directory || !isAbsolute(directory)) throw new Error('Owned fixture directory required');
  const config = JSON.parse(readFileSync(join(directory, 'config.json'), 'utf8'));
  if (config.version !== 1) throw new Error('Unsupported fixture version');
  // Validate before locking or recording: unsupported commands never look successful.
  const request = parse(process.argv.slice(2), config.repository);
  const lock = join(directory, 'active.lock');
  const descriptor = openSync(lock, 'wx', 0o600);
  closeSync(descriptor);
  const temporary = join(directory, `ledger.${process.pid}.tmp`);
  try {
    const path = join(directory, 'ledger.json');
    const ledger = JSON.parse(readFileSync(path, 'utf8'));
    const result = dispatch(request, config, ledger);
    ledger.calls.push({
      args: process.argv.slice(2),
      outcome: result.code === 0 ? 'success' : 'error',
    });
    writeFileSync(temporary, `${JSON.stringify(ledger)}\n`, { mode: 0o600 });
    renameSync(temporary, path);
    if (result.output) process.stdout.write(result.output);
    if (result.error) process.stderr.write(`${result.error}\n`);
    process.exitCode = result.code;
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
    unlinkSync(lock);
  }
}

try {
  run();
} catch {
  process.stderr.write('Invalid or busy owned GitHub fixture invocation\n');
  process.exitCode = 2;
}
