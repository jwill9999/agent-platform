import { randomUUID } from 'node:crypto';

import type { ObservabilityEvent } from './events.js';

export type ObservabilityLevel = 'info' | 'warn' | 'error';

export type ObservabilityRecord = Readonly<{
  id: string;
  sessionId: string;
  traceId: string | null;
  kind: ObservabilityEvent['kind'];
  level: ObservabilityLevel;
  timestamp: string;
  timestampMs: number;
  event: ObservabilityEvent;
}>;

export type ObservabilityLogFilter = Readonly<{
  sessionId: string;
  level?: ObservabilityLevel;
  since?: string | number | Date;
  limit?: number;
}>;

export type ObservabilityErrorFilter = Readonly<{
  sessionId: string;
  since?: string | number | Date;
  limit?: number;
}>;

export type ObservabilityTraceFilter = Readonly<{
  sessionId: string;
  traceId?: string;
  since?: string | number | Date;
}>;

export type ObservabilityTrace = Readonly<{
  traceId: string;
  records: readonly ObservabilityRecord[];
}>;

export type ObservabilityStore = Readonly<{
  record: (event: ObservabilityEvent) => ObservabilityRecord;
  getLogs: (filter: ObservabilityLogFilter) => ObservabilityRecord[];
  getErrors: (filter: ObservabilityErrorFilter) => ObservabilityRecord[];
  getTrace: (filter: ObservabilityTraceFilter) => ObservabilityTrace | undefined;
}>;

const DEFAULT_LIMIT = 20;

function requireSessionId(sessionId: string): string {
  const trimmed = sessionId.trim();
  if (!trimmed) {
    throw new TypeError('sessionId is required');
  }
  return trimmed;
}

function parseSince(since?: string | number | Date): number | undefined {
  if (since == null) return undefined;
  if (since instanceof Date) return since.getTime();
  if (typeof since === 'number') {
    if (!Number.isFinite(since)) throw new TypeError('since must be a finite timestamp');
    return since;
  }
  const parsed = Date.parse(since);
  if (Number.isNaN(parsed)) {
    throw new TypeError('since must be a valid date string');
  }
  return parsed;
}

function normalizeLimit(limit?: number): number {
  if (limit == null) return DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit < 1) {
    throw new TypeError('limit must be a positive number');
  }
  return Math.floor(limit);
}

function toLevel(event: ObservabilityEvent): ObservabilityLevel {
  if (event.kind === 'error') return 'error';
  if (event.kind === 'dod_check' && !event.passed) return 'error';
  if (event.kind === 'task_end' && !event.ok) return 'warn';
  return 'info';
}

function newestFirst(a: ObservabilityRecord, b: ObservabilityRecord): number {
  return b.timestampMs - a.timestampMs;
}

function oldestFirst(a: ObservabilityRecord, b: ObservabilityRecord): number {
  return a.timestampMs - b.timestampMs;
}

export function createObservabilityStore(): ObservabilityStore {
  const records: ObservabilityRecord[] = [];

  return {
    record(event) {
      const timestampMs = Date.now();
      const record: ObservabilityRecord = {
        id: randomUUID(),
        sessionId: requireSessionId(event.sessionId),
        traceId: 'runId' in event ? event.runId : null,
        kind: event.kind,
        level: toLevel(event),
        timestamp: new Date(timestampMs).toISOString(),
        timestampMs,
        event,
      };
      records.push(record);
      return record;
    },

    getLogs(filter) {
      const sessionId = requireSessionId(filter.sessionId);
      const sinceMs = parseSince(filter.since);
      const limit = normalizeLimit(filter.limit);

      return records
        .filter(
          (record) =>
            record.sessionId === sessionId &&
            (filter.level == null || record.level === filter.level) &&
            (sinceMs == null || record.timestampMs >= sinceMs),
        )
        .sort(newestFirst)
        .slice(0, limit);
    },

    getErrors(filter) {
      const sessionId = requireSessionId(filter.sessionId);
      const sinceMs = parseSince(filter.since);
      const limit = normalizeLimit(filter.limit);

      return records
        .filter(
          (record) =>
            record.sessionId === sessionId &&
            record.level === 'error' &&
            (sinceMs == null || record.timestampMs >= sinceMs),
        )
        .sort(newestFirst)
        .slice(0, limit);
    },

    getTrace(filter) {
      const sessionId = requireSessionId(filter.sessionId);
      const sinceMs = parseSince(filter.since);

      let traceId = filter.traceId?.trim();
      if (!traceId) {
        traceId =
          records
            .filter((record) => record.sessionId === sessionId && record.traceId != null)
            .sort(newestFirst)[0]?.traceId ?? undefined;
      }
      if (!traceId) return undefined;

      const traceRecords = records
        .filter(
          (record) =>
            record.sessionId === sessionId &&
            record.traceId === traceId &&
            (sinceMs == null || record.timestampMs >= sinceMs),
        )
        .sort(oldestFirst);

      if (traceRecords.length === 0) return undefined;
      return { traceId, records: traceRecords };
    },
  };
}
