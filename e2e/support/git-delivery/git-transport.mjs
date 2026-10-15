import { chmod, copyFile, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL } from 'node:url';

/** Caller owns the real bare repository; this fixture owns only its transport config and ledger. */
export async function createGitTransportFixture({ bareRoot, repository = 'fixture/project' }) {
  if (!/^[a-zA-Z0-9][\w.-]*\/[a-zA-Z0-9][\w.-]*$/.test(repository))
    throw new Error('Invalid fixture repository');
  const canonical = await realpath(bareRoot);
  const directory = await mkdtemp(join(tmpdir(), 'git-delivery-transport-'));
  const executable = join(directory, 'ssh');
  try {
    await chmod(directory, 0o700);
    await copyFile(new URL('./git-ssh-executable.mjs', import.meta.url), executable);
    await chmod(executable, 0o700);
    await writeFile(
      join(directory, 'transport.json'),
      JSON.stringify({ version: 1, repository, bareRoot: canonical }),
      { mode: 0o600 },
    );
    await writeFile(join(directory, 'transport.jsonl'), '', { mode: 0o600 });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    directory,
    executable,
    repository,
    remoteUrl: `git@github.com:${repository}.git`,
    sshCommand: `'${executable.replaceAll("'", "'\\''")}'`,
    async ledger() {
      return (await readFile(join(directory, 'transport.jsonl'), 'utf8'))
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
    async close() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}
