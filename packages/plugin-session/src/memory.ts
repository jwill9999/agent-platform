/**
 * Ephemeral key/value store for a single session. Not persisted — the host owns lifecycle.
 * Call {@link SessionMemoryStore.clear} when the session ends or resets (see package README).
 */
export class SessionMemoryStore {
  private readonly data = new Map<string, string>();

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  get(key: string): string | undefined {
    return this.data.get(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  /** Remove all entries (session reset). */
  clear(): void {
    this.data.clear();
  }

  entries(): IterableIterator<[string, string]> {
    return this.data.entries();
  }

  /** Snapshot for tests / debugging (not for PII-heavy payloads). */
  toJSON(): Record<string, string> {
    return Object.fromEntries(this.data);
  }
}
