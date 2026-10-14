import type { ChildProcess } from 'node:child_process';
import type { Writable } from 'node:stream';

export class DesktopChildShutdownError extends Error {}

/** Register immediately after spawn: killed/exit are not proof that stdio has closed. */
export function ownDesktopChild(
  child: ChildProcess,
  logs: readonly Writable[] = [],
  graceMs = 2_000,
  confirmationMs = 2_000,
): { stop: () => Promise<void>; processError: () => Error | undefined } {
  let closed = false;
  let processError: Error | undefined;
  let stopPromise: Promise<void> | undefined;
  let confirmClose!: () => void;
  const childClosed = new Promise<void>((resolve) => {
    confirmClose = resolve;
  });
  child.once('close', () => {
    closed = true;
    confirmClose();
  });
  child.on('error', (error: Error) => {
    processError = error;
  });
  // Attach before piping so filesystem errors cannot become unhandled events.
  const logResults = logs.map(
    (log) =>
      new Promise<Error | undefined>((resolve) => {
        log.once('finish', () => resolve(undefined));
        log.once('error', (error: Error) => resolve(error));
        log.once('close', () => {
          if (!log.writableFinished) resolve(new Error('Desktop child log closed before finish.'));
        });
      }),
  );

  async function stop(): Promise<void> {
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    let rejectShutdown: (error: Error) => void = () => undefined;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          if (!closed) {
            if (child.pid && child.exitCode === null && child.signalCode === null) {
              child.kill('SIGTERM');
            }
            forceTimer = setTimeout(() => {
              if (!closed && child.pid && child.exitCode === null && child.signalCode === null) {
                try {
                  child.kill('SIGKILL');
                } catch {
                  rejectShutdown(
                    new DesktopChildShutdownError(
                      'Desktop child force stop failed; retain diagnostics.',
                    ),
                  );
                }
              }
            }, graceMs);
            await childClosed;
          }
          for (const log of logs) {
            if (!log.writableEnded && !log.destroyed) log.end();
          }
          const errors = await Promise.all(logResults);
          const error = errors.find(Boolean);
          if (error)
            throw new DesktopChildShutdownError(
              'Desktop child log completion failed; retain diagnostics.',
            );
        })(),
        new Promise<never>((_, reject) => {
          rejectShutdown = reject;
          deadlineTimer = setTimeout(
            () =>
              reject(
                new DesktopChildShutdownError(
                  'Desktop child shutdown could not be confirmed; retain diagnostics.',
                ),
              ),
            graceMs + confirmationMs,
          );
        }),
      ]);
    } catch (error) {
      if (error instanceof DesktopChildShutdownError) throw error;
      throw new DesktopChildShutdownError('Desktop child stop failed; retain diagnostics.');
    } finally {
      clearTimeout(forceTimer);
      clearTimeout(deadlineTimer);
    }
  }

  return {
    stop: () => (stopPromise ??= stop()),
    processError: () => processError,
  };
}
