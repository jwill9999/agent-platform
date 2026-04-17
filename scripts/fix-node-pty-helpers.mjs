/**
 * node-pty ships `spawn-helper` in prebuilds; pnpm/npm sometimes install it without +x,
 * which makes posix_spawnp fail for every shell. On macOS, Gatekeeper quarantine can
 * also block exec until cleared. Restore execute permission and strip quarantine.
 */
import { execFileSync, execSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

if (process.platform === 'win32') {
  process.exit(0);
}

const nm = path.join(repoRoot, 'node_modules');
if (!existsSync(nm)) {
  process.exit(0);
}

try {
  const out = execSync(
    `find "${nm}" -name spawn-helper -path '*node-pty*' -type f 2>/dev/null`,
    { encoding: 'utf8' },
  );
  for (const line of out.trim().split('\n')) {
    const p = line.trim();
    if (!p) continue;
    try {
      chmodSync(p, 0o755);
      if (process.platform === 'darwin') {
        try {
          execFileSync('xattr', ['-c', p], { stdio: 'ignore' });
        } catch {
          /* ignore */
        }
      }
      console.log('[fix-node-pty-helpers] fixed', p);
    } catch {
      // ignore
    }
  }
} catch {
  // find missing or no matches
}
