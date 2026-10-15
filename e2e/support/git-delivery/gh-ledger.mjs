import {
  mkdtemp,
  copyFile,
  chmod,
  readFile,
  writeFile,
  rename,
  rm,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';

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
