import type { DrizzleDb } from '@agent-platform/db';
import type { SubsystemCheck, ReadinessResponse } from '@agent-platform/contracts';
import { statSync, accessSync, constants as fsConstants } from 'node:fs';
import { execSync } from 'node:child_process';

const CHECK_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Individual subsystem checks
// ---------------------------------------------------------------------------

export async function checkDatabase(db: DrizzleDb): Promise<SubsystemCheck> {
  const start = Date.now();
  try {
    const result = await withTimeout(
      () =>
        new Promise<void>((resolve, reject) => {
          try {
            db.run(/* sql */ `SELECT 1`);
            resolve();
          } catch (err) {
            reject(err);
          }
        }),
      CHECK_TIMEOUT_MS,
    );
    if (!result.ok) {
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : 'Database unreachable';
        return { status: 'unhealthy', error: msg, latencyMs: Date.now() - start };
      }
      return {
        status: 'unhealthy',
        error: 'Database check timed out',
        latencyMs: CHECK_TIMEOUT_MS,
      };
    }
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'unhealthy',
      error: err instanceof Error ? err.message : 'Database unreachable',
      latencyMs: Date.now() - start,
    };
  }
}

export function checkDisk(sqlitePath: string | undefined): SubsystemCheck {
  if (!sqlitePath) {
    return { status: 'degraded', error: 'SQLITE_PATH not configured' };
  }

  const start = Date.now();
  try {
    accessSync(sqlitePath, fsConstants.R_OK | fsConstants.W_OK);
    const stats = statSync(sqlitePath);
    const details: Record<string, string> = {
      fileSizeBytes: String(stats.size),
    };

    // Check free disk space (platform-dependent)
    const freeBytes = getFreeDiskSpace(sqlitePath);
    if (freeBytes !== null) {
      details['freeBytes'] = String(freeBytes);
      if (freeBytes < 50 * 1024 * 1024) {
        return {
          status: 'degraded',
          latencyMs: Date.now() - start,
          details,
          error: 'Less than 50MB free disk space',
        };
      }
    }

    return { status: 'healthy', latencyMs: Date.now() - start, details };
  } catch (err) {
    return {
      status: 'unhealthy',
      error: err instanceof Error ? err.message : 'Disk check failed',
      latencyMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runReadinessCheck(deps: {
  db: DrizzleDb | null;
  sqlitePath: string | undefined;
}): Promise<ReadinessResponse> {
  const checks: Record<string, SubsystemCheck> = {};

  if (deps.db) {
    checks['database'] = await checkDatabase(deps.db);
  } else {
    checks['database'] = { status: 'unhealthy', error: 'No database connection' };
  }

  checks['disk'] = checkDisk(deps.sqlitePath);

  const statuses = Object.values(checks).map((c) => c.status);
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (statuses.includes('unhealthy')) {
    overall = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }

  return {
    status: overall,
    checks,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
): Promise<{ ok: true; value: T } | { ok: false; error?: unknown }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false }), ms);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();

    fn()
      .then((value) => {
        clearTimeout(timer);
        resolve({ ok: true, value });
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        resolve({ ok: false, error: err });
      });
  });
}

function getFreeDiskSpace(filePath: string): number | null {
  try {
    if (process.platform === 'win32') return null;
    const output = execSync(`df -k "${filePath}" | tail -1 | awk '{print $4}'`, {
      encoding: 'utf-8',
      timeout: 2000,
    }).trim();
    const kb = parseInt(output, 10);
    return isNaN(kb) ? null : kb * 1024;
  } catch {
    return null;
  }
}
