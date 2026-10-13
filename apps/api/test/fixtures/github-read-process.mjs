import { spawn } from 'node:child_process';
import process from 'node:process';
import { setInterval, clearInterval } from 'node:timers';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [, , mode, marker, descendantMarker] = process.argv;
if (!marker || !['descendant', 'parent', 'exiting-parent'].includes(mode)) process.exit(2);
process.on('SIGTERM', () => {});
writeFileSync(marker, String(process.pid));
if (mode !== 'descendant') {
  if (!descendantMarker) process.exit(2);
  spawn(process.execPath, [fileURLToPath(import.meta.url), 'descendant', descendantMarker], {
    stdio: 'inherit',
  });
}
const timer = setInterval(() => {
  if (mode === 'exiting-parent' && existsSync(descendantMarker)) {
    clearInterval(timer);
    process.stdout.write('done', () => process.exit(0));
  }
}, 10);
