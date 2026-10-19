import type { CaptureFailureObserver } from '@agent-platform/contracts';
import { createCaptureStore } from './captureStore.js';
import { randomUUID } from 'node:crypto';
import {
  DiagnosticEventSchema,
  DiagnosticScopeSchema,
  DiagnosticWindowSchema,
  type DiagnosticWindow,
  type DiagnosticWindowPage,
  type DiagnosticEvent,
  type DiagnosticStore,
  type DiagnosticHealth,
  type DiagnosticPage,
  type DiagnosticScope,
  type DiagnosticStoredEvent,
} from '@agent-platform/contracts';

function diagnosticErrorCode(reason: string): 'invalid_cursor' | 'expired_history' | 'unavailable' {
  if (reason === 'invalid_cursor') return 'invalid_cursor';
  if (reason.startsWith('expired_history:')) return 'expired_history';
  return 'unavailable';
}

export class DiagnosticStoreError extends Error {
  readonly code: 'invalid_cursor' | 'expired_history' | 'unavailable';
  readonly earliestSequence?: number;
  constructor(reason: string) {
    const code = diagnosticErrorCode(reason);
    super(code);
    this.name = 'DiagnosticStoreError';
    this.code = code;
    if (code === 'expired_history') this.earliestSequence = Number(reason.split(':')[1]) || 0;
  }
}

export type DiagnosticStoreOptions = {
  path: string;
  retentionDays?: number;
  maxEvents?: number;
  processInstanceId?: string;
  onFirstFailure?: CaptureFailureObserver;
};
type Stats = Pick<
  DiagnosticHealth,
  | 'pruned'
  | 'conflicts'
  | 'dropped'
  | 'acknowledgedSequence'
  | 'lastAcknowledgedAtMs'
  | 'previousShutdownUnclean'
>;

/** A bounded observational queue. No caller awaits record(), and I/O never runs on its thread. */
export function createDiagnosticStore(options: DiagnosticStoreOptions): DiagnosticStore {
  const health: DiagnosticHealth = {
    state: 'starting',
    reason: 'none',
    pending: 0,
    dropped: 0,
    conflicts: 0,
    pruned: 0,
    acknowledgedSequence: 0,
    lastAcknowledgedAtMs: null,
    processInstanceId: options.processInstanceId ?? randomUUID(),
    previousShutdownUnclean: false,
  };
  const retentionDays = options.retentionDays ?? 7;
  const maxEvents = options.maxEvents ?? 10000;
  const configurationValid =
    !!options.path &&
    (options.processInstanceId === undefined ||
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(options.processInstanceId)) &&
    Number.isInteger(retentionDays) &&
    retentionDays >= 1 &&
    retentionDays <= 90 &&
    Number.isInteger(maxEvents) &&
    maxEvents >= 100 &&
    maxEvents <= 100000;
  const { ready, record, flush, rpc, update, close } = createCaptureStore<
    DiagnosticEvent,
    DiagnosticHealth
  >({
    health,
    storeKind: 'diagnostics',
    onFirstFailure: options.onFirstFailure,
    configurationValid,
    unavailableError: 'diagnostics_unavailable',
    workerUrl: new URL(
      import.meta.url.endsWith('.ts') ? '../../dist/diagnostics/worker.js' : './worker.js',
      import.meta.url,
    ),
    workerData: { path: options.path, retentionDays, maxEvents },
    parseRecord: (input) => DiagnosticEventSchema.parse(input),
    invalidReason: 'invalid_event',
    appendInput: (events, dropped) => ({ events, dropped }),
    readCommands: ['query', 'queryWindow', 'list'],
    closeDeadlineMs: 1000,
  });

  return {
    ready,
    record,
    flush,
    async query(scope: DiagnosticScope, input = {}): Promise<DiagnosticPage> {
      const checked = DiagnosticScopeSchema.parse(scope);
      await ready;
      let page: Omit<DiagnosticPage, 'health'> & { stats: Stats };
      try {
        page = (await rpc('query', { scope: checked, ...input })) as typeof page;
      } catch (error) {
        throw new DiagnosticStoreError(error instanceof Error ? error.message : 'unavailable');
      }
      update(page.stats);
      return {
        scope: page.scope,
        events: page.events,
        snapshotSequence: page.snapshotSequence,
        earliestSequence: page.earliestSequence,
        truncated: page.truncated,
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        health: { ...health },
      };
    },
    async queryWindow(window: DiagnosticWindow, input = {}): Promise<DiagnosticWindowPage> {
      const checked = DiagnosticWindowSchema.parse(window);
      await ready;
      let page: Omit<DiagnosticWindowPage, 'health'> & { stats: Stats };
      try {
        page = (await rpc('queryWindow', { window: checked, ...input })) as typeof page;
      } catch (error) {
        throw new DiagnosticStoreError(error instanceof Error ? error.message : 'unavailable');
      }
      update(page.stats);
      return {
        window: page.window,
        events: page.events,
        snapshotSequence: page.snapshotSequence,
        earliestSequence: page.earliestSequence,
        truncated: page.truncated,
        ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        ...(page.completedCursor ? { completedCursor: page.completedCursor } : {}),
        coverage: page.coverage,
        health: { ...health },
      };
    },
    async listRecent(input = {}): Promise<DiagnosticStoredEvent[]> {
      await ready;
      const result = (await rpc('list', input)) as {
        events: DiagnosticStoredEvent[];
        stats: Stats;
      };
      update(result.stats);
      return result.events;
    },
    async prune() {
      await ready;
      const stats = await rpc('prune', {});
      update(stats as Stats);
    },
    health() {
      return { ...health };
    },
    close,
  };
}
