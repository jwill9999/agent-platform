import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';

export type ChildCompletion = { code: number | null; signal: NodeJS.Signals | null };
export function ownCaptureChild(child: ChildProcess) {
  let completion: ChildCompletion | undefined;
  // Observe immediately, including spawn errors; only 'close' confirms the owned resources settled.
  child.on('error', () => {});
  const closed = new Promise<ChildCompletion>((resolve) => {
    child.once('close', (code, signal) => {
      completion = { code, signal };
      resolve(completion);
    });
  });
  return { child, closed, completion: () => completion };
}
export type OwnedCaptureChild = ReturnType<typeof ownCaptureChild>;
function failure(
  code:
    | 'aborted'
    | 'timeout'
    | 'closed_before_message'
    | 'message_unavailable'
    | 'close_unconfirmed',
) {
  return new Error(`owned_capture_child_${code}`);
}
async function bounded<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  milliseconds: number,
): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => {});
    throw failure('aborted');
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(failure('aborted'));
        signal.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => reject(failure('timeout')), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}
export async function captureChildMessage(
  owned: OwnedCaptureChild,
  signal: AbortSignal,
): Promise<unknown> {
  if (owned.completion()) throw failure('closed_before_message');
  const cleanup = new AbortController();
  const lifetime = AbortSignal.any([signal, cleanup.signal]);
  try {
    const message = once(owned.child, 'message', { signal: lifetime }).then(([value]) => value);
    return await bounded(
      Promise.race([
        message,
        owned.closed.then(() => {
          throw failure('closed_before_message');
        }),
      ]),
      signal,
      3000,
    );
  } catch (error) {
    if (signal.aborted) throw failure('aborted');
    if (error instanceof Error && error.message.startsWith('owned_capture_child_')) throw error;
    throw failure('message_unavailable');
  } finally {
    cleanup.abort();
  }
}
export function captureChildClose(owned: OwnedCaptureChild, signal: AbortSignal) {
  return bounded(owned.closed, signal, 3000);
}
function terminate(owned: OwnedCaptureChild, signal: NodeJS.Signals): void {
  try {
    owned.child.kill(signal);
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ESRCH'))
      throw failure('close_unconfirmed');
  }
}
export async function stopCaptureChild(
  owned: OwnedCaptureChild | undefined,
  gracefulMs = 2000,
): Promise<ChildCompletion | undefined> {
  if (!owned) return undefined;
  if (owned.completion()) return owned.completion();
  terminate(owned, 'SIGTERM');
  try {
    return await bounded(owned.closed, new AbortController().signal, gracefulMs);
  } catch {
    terminate(owned, 'SIGKILL');
  }
  try {
    return await bounded(owned.closed, new AbortController().signal, 1000);
  } catch {
    throw failure('close_unconfirmed');
  }
}
