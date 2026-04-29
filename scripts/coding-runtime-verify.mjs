/* global console, process */
import { spawnSync } from 'node:child_process';

const REQUIRED_COMMANDS = [
  { name: 'git', versionArgs: ['--version'] },
  { name: 'rg', versionArgs: ['--version'] },
  { name: 'jq', versionArgs: ['--version'] },
  { name: 'make', versionArgs: ['--version'] },
  { name: 'node', versionArgs: ['--version'] },
  { name: 'pnpm', versionArgs: ['--version'] },
  { name: 'diff', versionArgs: ['--version'] },
  { name: 'file', versionArgs: ['--version'] },
  { name: 'wc', versionArgs: ['--version'] },
  { name: 'sed', versionArgs: ['--version'] },
  { name: 'awk', versionArgs: ['--version'] },
];

function commandPath(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function commandVersion(command, versionArgs) {
  const result = spawnSync(command, versionArgs, {
    encoding: 'utf8',
    timeout: 5000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.status !== 0 || !output) return null;
  return output.split('\n')[0] ?? null;
}

const results = REQUIRED_COMMANDS.map((command) => {
  const path = commandPath(command.name);
  return {
    name: command.name,
    found: path !== null,
    path,
    version: path ? commandVersion(command.name, command.versionArgs) : null,
  };
});

const missing = results.filter((result) => !result.found);
for (const result of results) {
  const suffix = result.version ? ` (${result.version})` : '';
  console.log(`${result.found ? 'OK' : 'MISSING'} ${result.name}${suffix}`);
}

if (missing.length > 0) {
  console.error(`Missing required coding runtime commands: ${missing.map((m) => m.name).join(', ')}`);
  process.exit(1);
}

console.log('Coding runtime CLI baseline verified.');
