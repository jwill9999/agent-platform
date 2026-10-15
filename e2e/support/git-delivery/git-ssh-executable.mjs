#!/usr/bin/env node
// External transport fixture only: never invokes SSH or any network service.
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

try {
  const directory = dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(readFileSync(join(directory, 'transport.json'), 'utf8'));
  if (
    config.version !== 1 ||
    !/^[a-zA-Z0-9][\w.-]*\/[a-zA-Z0-9][\w.-]*$/.test(config.repository) ||
    realpathSync(config.bareRoot) !== config.bareRoot
  )
    throw new Error('Invalid owned transport configuration');
  const args = process.argv.slice(2);
  if (args[0] === '-o' && args[1] === 'SendEnv=GIT_PROTOCOL') args.splice(0, 2);
  if (args.length !== 2 || args[0] !== 'git@github.com') throw new Error('Destination denied');
  const operation = ['upload-pack', 'receive-pack'].find(
    (name) => args[1] === `git-${name} '${config.repository}.git'`,
  );
  if (!operation) throw new Error('Command denied');
  appendFileSync(
    join(directory, 'transport.jsonl'),
    JSON.stringify({ operation, repository: config.repository }) + '\n',
  );
  const result = spawnSync('/usr/bin/git', [operation, config.bareRoot], {
    stdio: 'inherit',
    shell: false,
  });
  process.exitCode = result.status ?? 1;
} catch {
  process.stderr.write('Owned Git transport fixture rejected the request\n');
  process.exitCode = 64;
}
