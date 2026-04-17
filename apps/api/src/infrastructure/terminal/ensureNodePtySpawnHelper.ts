import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let didRun = false;

/**
 * node-pty runs a `spawn-helper` binary next to `pty.node`. Installers sometimes drop the
 * executable bit; on macOS, Gatekeeper quarantine can also block exec. Both yield
 * "posix_spawnp failed" for every shell. Fix once per process before spawning PTYs.
 */
export function ensureNodePtySpawnHelperExecutable(): void {
  if (didRun || process.platform === 'win32') {
    return;
  }
  didRun = true;

  try {
    const require = createRequire(fileURLToPath(import.meta.url));
    const pkgRoot = path.dirname(require.resolve('node-pty/package.json'));
    const candidates = [
      path.join(pkgRoot, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
      path.join(pkgRoot, 'build', 'Release', 'spawn-helper'),
      path.join(pkgRoot, 'build', 'Debug', 'spawn-helper'),
    ];

    for (const helper of candidates) {
      if (!existsSync(helper)) {
        continue;
      }
      try {
        chmodSync(helper, 0o755);
      } catch {
        /* ignore */
      }
      if (process.platform === 'darwin') {
        try {
          execFileSync('xattr', ['-c', helper], { stdio: 'ignore' });
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* node-pty missing or resolve failed */
  }
}
