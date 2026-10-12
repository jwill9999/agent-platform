import type { ChildProcess } from 'node:child_process';
import { constants } from 'node:os';

const MAX_RESPONSE_BYTES = 16 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const startupCodes = new Set([
  'ENOSPC',
  'EACCES',
  'EPERM',
  'ENOENT',
  'EADDRINUSE',
  'EMFILE',
  'ENFILE',
  'EIO',
]);
const statuses = new Set(['healthy', 'degraded', 'unhealthy']);
const transportCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH']);

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function status(value: unknown): string | undefined {
  return typeof value === 'string' && statuses.has(value) ? value : undefined;
}

function projectHealth(value: unknown) {
  const body = record(value);
  const checks = record(body?.checks);
  return {
    overall: status(body?.status),
    database: status(record(checks?.database)?.status),
    disk: status(record(checks?.disk)?.status),
    runner: status(record(checks?.commandRunner)?.status),
  };
}

async function readBoundedHealth(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) return undefined;
      chunks.push(chunk.value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      return undefined;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/** Fixture evidence only: never retains bodies, errors, credentials, paths or log lines. */
export function createStartupEvidence(backendPort: number, rendererPort: number) {
  const startedAt = performance.now();
  let attempts = 0;
  let stderrBytes = 0;
  let stderrTruncated = false;
  let stderrTail = '';
  const stderrCodes = new Set<string>();
  let process: Pick<ChildProcess, 'exitCode' | 'signalCode'> | undefined;
  let last: {
    httpStatus?: number;
    transportCode?: string;
    health?: ReturnType<typeof projectHealth>;
  } = {};
  return {
    observeProcess(
      child: Pick<ChildProcess, 'exitCode' | 'signalCode'> & Partial<Pick<ChildProcess, 'stderr'>>,
    ) {
      process = child;
      child.stderr?.on('data', (chunk: Buffer | string) => {
        const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        const remaining = MAX_STDERR_BYTES - stderrBytes;
        if (bytes.byteLength > remaining) stderrTruncated = true;
        if (remaining <= 0) return;
        const text = stderrTail + bytes.subarray(0, remaining).toString('utf8');
        stderrBytes += Math.min(bytes.byteLength, remaining);
        for (const match of text.matchAll(/\bcode:\s*['"]([A-Z]+)['"]/g)) {
          if (startupCodes.has(match[1]!)) stderrCodes.add(match[1]!);
        }
        stderrTail = text.slice(-64);
      });
    },
    async probe(remainingMs = 5_000): Promise<boolean> {
      attempts++;
      last = {};
      try {
        const response = await fetch(`http://127.0.0.1:${backendPort}/health/ready`, {
          signal: AbortSignal.timeout(Math.max(1, Math.min(5_000, Math.floor(remainingMs)))),
        });
        last.httpStatus = response.status;
        try {
          last.health = projectHealth(await readBoundedHealth(response));
        } catch {
          // Evidence collection must not narrow the existing HTTP.ok readiness predicate.
          last.health = projectHealth(undefined);
        }
        return response.ok;
      } catch (error) {
        const failure = record(error);
        const code = record(failure?.cause)?.code ?? failure?.code;
        last.transportCode =
          failure?.name === 'TimeoutError' || failure?.name === 'AbortError'
            ? 'ETIMEDOUT'
            : typeof code === 'string' && transportCodes.has(code)
              ? code
              : 'UNKNOWN';
        return false;
      }
    },
    snapshot() {
      const exitCode = process?.exitCode;
      const signal = process?.signalCode;
      return {
        backendPort,
        rendererPort,
        attempts,
        elapsedMs: Math.round(performance.now() - startedAt),
        ...last,
        stderr: {
          codes: [...stderrCodes],
          inspectedBytes: stderrBytes,
          truncated: stderrTruncated,
        },
        electronProcess: {
          observed: Boolean(process),
          exitCode: typeof exitCode === 'number' && Number.isInteger(exitCode) ? exitCode : null,
          signal: signal && Object.hasOwn(constants.signals, signal) ? signal : null,
        },
      };
    },
  };
}

/** Defer reporting an attachment failure until the fixture has finished cleaning up. */
export async function attemptStartupEvidenceAttachment(
  attach: () => Promise<void>,
): Promise<boolean> {
  try {
    await attach();
    return true;
  } catch {
    return false;
  }
}
