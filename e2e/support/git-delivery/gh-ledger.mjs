import {
  mkdtemp,
  copyFile,
  chmod,
  readFile,
  writeFile,
  rename,
  rm,
  access,
  readdir,
  open,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';

function checkedBranch(value) {
  if (
    value !== undefined &&
    (typeof value !== 'string' ||
      value.length === 0 ||
      value.length > 255 ||
      [...value].some(
        (character) => character.codePointAt(0) <= 32 || character.codePointAt(0) === 127,
      ))
  )
    throw new Error('Invalid fixture current branch');
  return value;
}

/**
 * Create a per-test external gh boundary; starts no processes and opens no ports.
 * @param {{repository?: string, currentBranch?: string, authFailure?: boolean,
 * enrichmentFailure?: boolean, loseCreateResponseOnce?: boolean}} options
 */
export async function createGhLedgerFixture({
  repository = 'fixture/project',
  currentBranch,
  ...failures
} = {}) {
  if (!/^[a-zA-Z0-9][\w.-]*\/[a-zA-Z0-9][\w.-]*$/.test(repository)) {
    throw new Error('Invalid fixture repository');
  }
  const allowed = ['authFailure', 'enrichmentFailure', 'loseCreateResponseOnce'];
  function checkedFailures(values) {
    for (const [name, value] of Object.entries(values)) {
      if (!allowed.includes(name) || typeof value !== 'boolean')
        throw new Error('Invalid failure mode');
    }
    return values;
  }
  let config = {
    version: 1,
    repository,
    currentBranch: checkedBranch(currentBranch),
    ...checkedFailures(failures),
  };
  const directory = await mkdtemp(join(tmpdir(), 'git-delivery-gh-'));
  const executable = join(directory, 'gh');
  let closed = false;
  async function assertIdle() {
    if (closed) throw new Error('Fixture is closed');
    if ((await readdir(directory)).some((name) => /^claim\.[0-9a-f-]{36}$/.test(name)))
      throw new Error('Await owned child completion before configuring or closing fixture');
    try {
      await access(join(directory, 'active.lock'));
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    throw new Error('Await owned child completion before configuring or closing fixture');
  }
  async function updateConfig(next) {
    await assertIdle();
    const temporary = join(directory, 'config.tmp');
    await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
    await rename(temporary, join(directory, 'config.json'));
    config = next;
  }
  try {
    await chmod(directory, 0o700);
    await copyFile(new URL('./gh-executable.mjs', import.meta.url), executable);
    await chmod(executable, 0o700);
    await writeFile(join(directory, 'config.json'), JSON.stringify(config), { mode: 0o600 });
    await writeFile(
      join(directory, 'ledger.json'),
      JSON.stringify({ pullRequests: [], calls: [], lostResponseConsumed: false }),
      { mode: 0o600 },
    );
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    directory,
    executable,
    env: { GIT_DELIVERY_GH_FIXTURE_DIR: directory },
    async readLedger() {
      if (closed) throw new Error('Fixture is closed');
      return JSON.parse(await readFile(join(directory, 'ledger.json'), 'utf8'));
    },
    async readEvidence() {
      return readInvocationEvidence(directory);
    },
    async setFailureModes(values) {
      const next = { ...config, ...checkedFailures(values) };
      await updateConfig(next);
    },
    async setCurrentBranch(value) {
      await updateConfig({ ...config, currentBranch: checkedBranch(value) });
    },
    async close() {
      if (closed) return;
      await assertIdle();
      await rm(directory, { recursive: true, force: true });
      closed = true;
    },
  };
}

const stages = new Set([
  'configuration',
  'validation',
  'claim',
  'waiting',
  'ledger_read',
  'dispatch',
  'persist',
  'output',
  'complete',
  'cleanup',
]);
const outcomes = new Set([
  'running',
  'success',
  'command_error',
  'lock_timeout',
  'fixture_error',
  'cancelled',
]);
const kinds = new Set([
  'unknown',
  'version',
  'auth',
  'repository',
  'commit-checks',
  'panel-list',
  'pr-checks',
  'list',
  'create',
]);

/** Safe bounded observations only: never expose argv, configuration, outputs or raw errors. */
async function readInvocationEvidence(directory) {
  const maximum = 512;
  const result = {
    version: 1,
    maximum,
    records: [],
    activeClaims: null,
    truncated: false,
    errors: 0,
  };
  let files;
  try {
    files = await readdir(directory);
  } catch {
    result.errors++;
    return result;
  }
  result.activeClaims = files.filter((name) => /^claim\.[0-9a-f-]{36}$/.test(name)).length;
  const receipts = files.filter((name) => /^receipt\.[0-9a-f-]{36}\.json$/.test(name)).sort();
  result.truncated = receipts.length > maximum;
  for (const name of receipts.slice(0, maximum)) {
    try {
      const handle = await open(join(directory, name), 'r');
      let value;
      try {
        const bytes = Buffer.alloc(2049);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
        if (bytesRead > 2048) throw new Error('Invocation evidence exceeds bound');
        value = JSON.parse(bytes.subarray(0, bytesRead).toString('utf8'));
      } finally {
        await handle.close();
      }
      if (
        value.version !== 1 ||
        !stages.has(value.stage) ||
        !outcomes.has(value.outcome) ||
        !kinds.has(value.kind) ||
        !Number.isSafeInteger(value.startedAtMs) ||
        value.startedAtMs < 0 ||
        !Number.isSafeInteger(value.waitMs) ||
        value.waitMs < 0 ||
        value.waitMs > 60000 ||
        value.lockBudgetMs !== 1000
      )
        throw new Error('Invalid safe invocation evidence');
      result.records.push({
        version: 1,
        kind: value.kind,
        stage: value.stage,
        outcome: value.outcome,
        startedAtMs: value.startedAtMs,
        waitMs: value.waitMs,
        lockBudgetMs: 1000,
      });
    } catch {
      result.errors++;
    }
  }
  return result;
}
