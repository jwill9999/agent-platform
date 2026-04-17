import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function expandHome(p: string): string {
  if (p === '~' || p.startsWith('~/')) {
    return p.replace(/^~(?=$|\/)/, os.homedir());
  }
  return p;
}

function isUsableDir(resolved: string): boolean {
  try {
    return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory();
  } catch {
    return false;
  }
}

/**
 * PTY working directory:
 * 1. `cwd` query param (from IDE) if it resolves to a real directory
 * 2. `TERMINAL_CWD` env if valid
 * 3. User home (browsers cannot expose OS path from File System Access picker; client must send path explicitly)
 */
export function resolveTerminalCwd(cwdQuery: string | null): string {
  const home = os.homedir();

  if (cwdQuery?.trim()) {
    const resolved = path.resolve(expandHome(cwdQuery.trim()));
    if (isUsableDir(resolved)) {
      return resolved;
    }
  }

  const envCwd = process.env.TERMINAL_CWD?.trim();
  if (envCwd) {
    const resolved = path.resolve(expandHome(envCwd));
    if (isUsableDir(resolved)) {
      return resolved;
    }
  }

  return home;
}
