import { spawn } from 'node:child_process';
import process from 'node:process';
import { setInterval, clearInterval } from 'node:timers';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [, , mode] = process.argv;
if (process.argv.length !== 3 || !['descendant', 'parent', 'exiting-parent'].includes(mode)) {
  process.exit(2);
}
process.on('SIGTERM', () => {});
// The caller supplies an owned temporary cwd; CLI input cannot select a marker path.
writeFileSync(mode === 'descendant' ? 'descendant' : 'parent', String(process.pid), { flag: 'wx' });
if (mode !== 'descendant') {
  spawn(process.execPath, [fileURLToPath(import.meta.url), 'descendant'], {
    stdio: 'inherit',
  });
}
const timer = setInterval(() => {
  if (mode === 'exiting-parent' && existsSync('descendant')) {
    clearInterval(timer);
    process.stdout.write('done', () => process.exit(0));
  }
}, 10);
