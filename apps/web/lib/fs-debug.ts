/**
 * Opt-in diagnostics for the File System Access / IDE folder flow.
 *
 * Enable either:
 * - URL: `?fsDebug=1` on any page that mounts the hook (e.g. `/ide?fsDebug=1`)
 * - localStorage: `localStorage.setItem('agent-platform-fs-debug', '1')` then reload
 */
export function isFsDebugEnabled(): boolean {
  if (globalThis.window === undefined) return false;
  try {
    const params = new URLSearchParams(globalThis.window.location.search);
    if (params.get('fsDebug') === '1') return true;
    if (globalThis.window.localStorage?.getItem('agent-platform-fs-debug') === '1') return true;
  } catch {
    return false;
  }
  return false;
}

export function fsDebugLog(...args: unknown[]): void {
  if (!isFsDebugEnabled()) return;
  console.log('[fs]', ...args);
}
