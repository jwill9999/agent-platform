export type SafeProviderWarning = {
  category: 'unsupported' | 'compatibility' | 'deprecated' | 'other';
  count: number;
};
let installed = false;
export function ensureSafeProviderWarningLogger(): void {
  if (!installed) installSafeProviderWarningLogger();
}
/** SDK7 exposes a process-local hook, not a per-request logger. Never forward raw warnings. */
export function installSafeProviderWarningLogger(
  sink?: (warning: SafeProviderWarning) => void,
): void {
  installed = true;
  globalThis.AI_SDK_LOG_WARNINGS = ({ warnings }) => {
    const counts = new Map<SafeProviderWarning['category'], number>();
    for (const warning of warnings) {
      const category =
        warning.type === 'unsupported' ||
        warning.type === 'compatibility' ||
        warning.type === 'deprecated'
          ? warning.type
          : 'other';
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    for (const [category, count] of counts) {
      try {
        sink?.({ category, count });
      } catch {
        /* observation never changes generation */
      }
    }
  };
}
