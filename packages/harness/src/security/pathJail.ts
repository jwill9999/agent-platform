/**
 * Mount-based file path security for system tools.
 *
 * PathJail enforces that every file-path argument stays within one of the
 * configured mounts and carries the right permission for the requested
 * operation (read vs write).
 */

import { resolve, normalize, relative, isAbsolute, dirname, basename } from 'node:path';
import { realpath } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MountPermission = 'read_only' | 'read_write';

export interface Mount {
  /** Human label (e.g. "workspace", "uploads"). */
  label: string;
  /** Absolute host path. */
  hostPath: string;
  permission: MountPermission;
}

export type PathOperation = 'read' | 'write';

export interface PathValidationResult {
  allowed: boolean;
  resolvedPath: string;
  /** If allowed, which mount matched. */
  mount?: Mount;
  /** If denied, why. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Always-blocked directories (never allow, regardless of mounts)
// ---------------------------------------------------------------------------

const ALWAYS_BLOCKED: readonly string[] = [
  '/etc',
  '/root',
  '/proc',
  '/sys',
  '/dev',
  '/boot',
  '/sbin',
  '/usr/sbin',
  '/var/run',
  '/var/log',
  '/run',
  '/snap',
  '/lost+found',
  '/mnt',
  '/media',
];

function isAlwaysBlocked(absPath: string): boolean {
  const normalized = normalize(absPath);
  return ALWAYS_BLOCKED.some(
    (blocked) => normalized === blocked || normalized.startsWith(`${blocked}/`),
  );
}

// ---------------------------------------------------------------------------
// PathJail
// ---------------------------------------------------------------------------

export class PathJail {
  private readonly mounts: readonly Mount[];
  private resolvedMounts: Mount[] | null = null;

  constructor(mounts: Mount[]) {
    this.mounts = mounts.map((m) => ({
      ...m,
      hostPath: resolve(m.hostPath),
    }));
  }

  /** Resolve mount hostPaths through symlinks (cached after first call). */
  private async getResolvedMounts(): Promise<Mount[]> {
    if (this.resolvedMounts) return this.resolvedMounts;
    this.resolvedMounts = await Promise.all(
      this.mounts.map(async (m) => {
        try {
          return { ...m, hostPath: await realpath(m.hostPath) };
        } catch {
          return m;
        }
      }),
    );
    return this.resolvedMounts;
  }

  /**
   * Validate that `targetPath` falls within an allowed mount and the
   * mount's permission covers the requested operation.
   *
   * The path is resolved to an absolute path (relative paths are resolved
   * against the first read_write mount — the workspace). Symlink traversal
   * is checked via `realpath` when the file exists.
   */
  async validate(targetPath: string, operation: PathOperation): Promise<PathValidationResult> {
    const resolvedMounts = await this.getResolvedMounts();

    // Resolve relative paths against workspace (first rw mount) or cwd
    let absPath: string;
    if (isAbsolute(targetPath)) {
      absPath = normalize(targetPath);
    } else {
      const workspace = resolvedMounts.find((m) => m.permission === 'read_write');
      const base = workspace?.hostPath ?? process.cwd();
      absPath = resolve(base, targetPath);
    }

    // Check always-blocked first
    if (isAlwaysBlocked(absPath)) {
      return {
        allowed: false,
        resolvedPath: absPath,
        reason: `Path "${absPath}" is in a protected system directory`,
      };
    }

    // Resolve symlinks if the path exists; if not, resolve the parent directory
    let realAbsPath = absPath;
    try {
      realAbsPath = await realpath(absPath);
    } catch {
      // File doesn't exist yet — resolve parent dir to handle macOS /var → /private/var
      try {
        const dir = dirname(absPath);
        const base = basename(absPath);
        const realDir = await realpath(dir);
        realAbsPath = resolve(realDir, base);
      } catch {
        // Parent also doesn't exist — keep as-is
      }
    }

    // Re-check after symlink resolution
    if (realAbsPath !== absPath && isAlwaysBlocked(realAbsPath)) {
      return {
        allowed: false,
        resolvedPath: realAbsPath,
        reason: `Symlink resolves to protected system directory "${realAbsPath}"`,
      };
    }

    // Find a matching mount
    for (const mount of resolvedMounts) {
      const rel = relative(mount.hostPath, realAbsPath);
      if (rel.startsWith('..') || isAbsolute(rel)) continue;

      // Mount matches — check permission
      if (operation === 'write' && mount.permission === 'read_only') {
        return {
          allowed: false,
          resolvedPath: realAbsPath,
          mount,
          reason: `Mount "${mount.label}" is read-only — write denied`,
        };
      }

      return { allowed: true, resolvedPath: realAbsPath, mount };
    }

    return {
      allowed: false,
      resolvedPath: realAbsPath,
      reason: `Path "${realAbsPath}" is outside all allowed mounts`,
    };
  }

  /** Convenience: validate + throw on denial. */
  async enforce(targetPath: string, operation: PathOperation): Promise<string> {
    const result = await this.validate(targetPath, operation);
    if (!result.allowed) {
      throw new PathJailError(result.reason ?? 'Access denied', result.resolvedPath);
    }
    return result.resolvedPath;
  }

  /** Extract path-like args from a tool call's arguments object. */
  static extractPaths(args: Record<string, unknown>): string[] {
    const paths: string[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && PATH_LIKE_KEYS.has(key)) {
        paths.push(value);
      }
    }
    return paths;
  }
}

/** Keys that are treated as file paths in tool arguments. */
const PATH_LIKE_KEYS = new Set([
  'path',
  'file',
  'filePath',
  'file_path',
  'directory',
  'dir',
  'source',
  'destination',
  'dest',
  'src',
  'target',
  'from',
  'to',
  'output',
  'input',
]);

export class PathJailError extends Error {
  readonly resolvedPath: string;
  constructor(message: string, resolvedPath: string) {
    super(message);
    this.name = 'PathJailError';
    this.resolvedPath = resolvedPath;
  }
}
