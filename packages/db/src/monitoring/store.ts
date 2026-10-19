import type { CaptureFailureObserver } from '@agent-platform/contracts';
import { createCaptureStore } from '../diagnostics/captureStore.js';
import { randomUUID } from 'node:crypto';
import {
  MonitoringSampleSchema,
  MonitoringWindowSchema,
  type MonitoringSample,
  type MonitoringStore,
  type MonitoringHealth,
  type MonitoringPage,
  type MonitoringWindow,
  MonitoringPreferenceInputSchema,
  type MonitoringPreference,
} from '@agent-platform/contracts';

function monitoringErrorCode(reason: string): 'invalid_cursor' | 'expired_history' | 'unavailable' {
  if (reason === 'invalid_cursor') return 'invalid_cursor';
  if (reason.startsWith('expired_history:')) return 'expired_history';
  return 'unavailable';
}

export class MonitoringStoreError extends Error {
  readonly code: 'invalid_cursor' | 'expired_history' | 'unavailable';
  readonly earliestSequence?: number;
  constructor(reason: string) {
    const code = monitoringErrorCode(reason);
    super(code);
    this.name = 'MonitoringStoreError';
    this.code = code;
    if (code === 'expired_history') this.earliestSequence = Number(reason.split(':')[1]) || 0;
  }
}

export type MonitoringStoreOptions = {
  path: string;
  processInstanceId?: string;
  onFirstFailure?: CaptureFailureObserver;
};
type Stats = Pick<
  MonitoringHealth,
  | 'pruned'
  | 'conflicts'
  | 'dropped'
  | 'acknowledgedSequence'
  | 'lastAcknowledgedAtMs'
  | 'previousShutdownUnclean'
  | 'preference'
>;

/** A bounded observational queue. No caller awaits record(), and I/O never runs on its thread. */
export function createMonitoringStore(options: MonitoringStoreOptions): MonitoringStore {
  const health: MonitoringHealth = {
    state: 'starting',
    reason: 'none',
    pending: 0,
    dropped: 0,
    conflicts: 0,
    pruned: 0,
    acknowledgedSequence: 0,
    lastAcknowledgedAtMs: null,
    processInstanceId: options.processInstanceId ?? randomUUID(),
    preference: null,
    previousShutdownUnclean: false,
  };
  const configurationValid =
    !!options.path &&
    (options.processInstanceId === undefined ||
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(options.processInstanceId));
  const { ready, record, flush, rpc, update, close } = createCaptureStore<
    MonitoringSample,
    MonitoringHealth
  >({
    health,
    storeKind: 'monitoring',
    onFirstFailure: options.onFirstFailure,
    configurationValid,
    unavailableError: 'monitoring_unavailable',
    workerUrl: new URL(
      import.meta.url.endsWith('.ts') ? '../../dist/monitoring/worker.js' : './worker.js',
      import.meta.url,
    ),
    workerData: { path: options.path },
    parseRecord: (input) => MonitoringSampleSchema.parse(input),
    acceptsRecords: () => health.preference?.samplingEnabled === true,
    invalidReason: 'invalid_sample',
    appendInput: (samples, dropped) => ({ samples, dropped }),
    readCommands: ['queryWindow', 'preference'],
    closeDeadlineMs: 2000,
    onDisable: () => {
      health.preference = null;
    },
  });

  return {
    ready,
    record,
    flush,
    async preference(): Promise<MonitoringPreference> {
      await ready;
      const result = (await rpc('preference', {})) as Stats;
      update(result);
      if (!health.preference) throw new MonitoringStoreError('unavailable');
      return { ...health.preference };
    },
    async setPreference(input): Promise<MonitoringPreference> {
      const checked = MonitoringPreferenceInputSchema.parse(input);
      await ready;
      await flush();
      try {
        const result = (await rpc('setPreference', checked, 1000)) as Stats;
        update(result);
        if (!health.preference) throw new Error('unavailable');
        return { ...health.preference };
      } catch (error) {
        throw new MonitoringStoreError(error instanceof Error ? error.message : 'unavailable');
      }
    },
    async queryWindow(window: MonitoringWindow, input = {}): Promise<MonitoringPage> {
      const checked = MonitoringWindowSchema.parse(window);
      await ready;
      let page: Omit<MonitoringPage, 'health'> & { stats: Stats };
      try {
        page = (await rpc('queryWindow', { window: checked, ...input })) as typeof page;
      } catch (error) {
        throw new MonitoringStoreError(error instanceof Error ? error.message : 'unavailable');
      }
      update(page.stats);
      return {
        window: page.window,
        samples: page.samples,
        snapshotSequence: page.snapshotSequence,
        earliestSequence: page.earliestSequence,
        truncated: page.truncated,
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        ...(page.completedCursor ? { completedCursor: page.completedCursor } : {}),
        coverage: page.coverage,
        health: { ...health, preference: health.preference ? { ...health.preference } : null },
      };
    },
    async prune() {
      await ready;
      const stats = await rpc('prune', {});
      update(stats as Stats);
    },
    health() {
      return { ...health, preference: health.preference ? { ...health.preference } : null };
    },
    close,
  };
}
