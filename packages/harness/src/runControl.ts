/** Execution authority is application-owned; diagnostics never grant admission. */
export interface RunExecutionControl {
  assertActive(): void;
  /** Admit synchronously, invoke immediately and track the original promise through settlement. */
  invoke<T>(kind: 'model' | 'tool' | 'sensor' | 'setup', action: () => Promise<T>): Promise<T>;
}

export class RunStoppedError extends Error {
  readonly code = 'USER_STOP';
  constructor() {
    super('The user requested Stop for this run.');
    this.name = 'RunStoppedError';
  }
}

export function abortReason(
  signal?: AbortSignal,
  error?: unknown,
): 'user_stop' | 'timeout' | 'client_disconnect' {
  const reason: unknown = signal?.reason;
  if (
    error instanceof RunStoppedError ||
    (error instanceof Error && 'code' in error && error.code === 'USER_STOP')
  )
    return 'user_stop';
  if (
    reason === 'user_stop' ||
    reason instanceof RunStoppedError ||
    (reason instanceof Error && 'code' in reason && reason.code === 'USER_STOP')
  )
    return 'user_stop';
  if (reason === 'timeout' || (reason instanceof Error && reason.name === 'TimeoutError'))
    return 'timeout';
  return 'client_disconnect';
}

export function assertRunActive(control?: RunExecutionControl, signal?: AbortSignal): void {
  control?.assertActive();
  if (signal?.aborted) {
    if (abortReason(signal) === 'user_stop') throw new RunStoppedError();
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException('Run aborted', 'AbortError');
  }
}

export function invokeRunAction<T>(
  control: RunExecutionControl | undefined,
  signal: AbortSignal | undefined,
  kind: 'model' | 'tool' | 'sensor' | 'setup',
  action: () => Promise<T>,
): Promise<T> {
  assertRunActive(control, signal);
  return control ? control.invoke(kind, action) : action();
}

export function isRunInterruption(error: unknown, signal?: AbortSignal): boolean {
  return (
    error instanceof RunStoppedError ||
    (error instanceof Error && 'code' in error && error.code === 'USER_STOP') ||
    (signal?.aborted === true &&
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError' || error === signal.reason))
  );
}
