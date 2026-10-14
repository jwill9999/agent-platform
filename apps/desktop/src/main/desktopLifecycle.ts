import { DesktopChildShutdownError } from './ownedDesktopChild.js';
interface Stoppable {
  stop: () => Promise<void>;
}

/** Own asynchronous startup before its first await, including handles returned after quit. */
export class DesktopLifecycle {
  private readonly controller = new AbortController();
  private readonly pending = new Set<Promise<unknown>>();
  private readonly handles = new Set<Stoppable>();
  private stopping?: Promise<void>;
  private cleanupFailure?: unknown;

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  check(): void {
    this.signal.throwIfAborted();
  }

  run<T>(start: () => Promise<T>): Promise<T> {
    this.check();
    const pending = Promise.resolve().then(() => {
      this.check();
      return start();
    });
    this.pending.add(pending);
    void pending.then(
      () => this.pending.delete(pending),
      (error: unknown) => {
        this.pending.delete(pending);
        if (
          error instanceof DesktopChildShutdownError ||
          (this.signal.aborted && !(error instanceof Error && error.name === 'AbortError'))
        ) {
          this.cleanupFailure = error;
        }
      },
    );
    return pending;
  }

  async own<T extends Stoppable>(start: Promise<T>): Promise<T> {
    const handle = await start;
    this.handles.add(handle);
    this.check();
    return handle;
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.controller.abort();
    this.stopping = this.joinAndStop();
    return this.stopping;
  }

  private async joinAndStop(): Promise<void> {
    await Promise.allSettled([...this.pending]);
    const results = await Promise.allSettled([...this.handles].map((handle) => handle.stop()));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    if (this.cleanupFailure) throw this.cleanupFailure;
    this.handles.clear();
  }
}
