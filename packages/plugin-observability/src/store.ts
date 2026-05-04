import { randomUUID } from 'node:crypto';

import type {
  SensorFinding,
  SensorProviderAvailability,
  SensorRuntimeLimitation,
} from '@agent-platform/contracts';

import type { ObservabilityEvent, SensorMcpCapabilityAvailability } from './events.js';

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

export type SensorObservationFilter = Readonly<{
  sessionId: string;
  since?: string | number | Date;
  limit?: number;
}>;

export type ObservedSensorFinding = SensorFinding &
  Readonly<{
    sensorId: string;
    runId: string;
    observedAtMs: number;
  }>;

export type SensorFailurePattern = Readonly<{
  key: string;
  sensorId: string;
  count: number;
  severity?: SensorFinding['severity'];
  ruleId?: string;
  files: readonly string[];
  firstSeenMs: number;
  lastSeenMs: number;
}>;

export type SensorFeedbackCandidate = Readonly<{
  id: string;
  kind:
    | 'beads_issue_proposal'
    | 'memory_candidate'
    | 'instruction_update_proposal'
    | 'linter_test_proposal';
  summary: string;
  evidence: readonly string[];
  reviewRequired: true;
  autoApply: false;
}>;

export type ObservabilityStore = Readonly<{
  record: (event: ObservabilityEvent) => ObservabilityRecord;
  getLogs: (filter: ObservabilityLogFilter) => ObservabilityRecord[];
  getErrors: (filter: ObservabilityErrorFilter) => ObservabilityRecord[];
  getTrace: (filter: ObservabilityTraceFilter) => ObservabilityTrace | undefined;
  getSensorFindings: (filter: SensorObservationFilter) => ObservedSensorFinding[];
  getSensorProviderAvailability: (filter: SensorObservationFilter) => SensorProviderAvailability[];
  getSensorRuntimeLimitations: (filter: SensorObservationFilter) => SensorRuntimeLimitation[];
  getMcpCapabilityAvailability: (
    filter: SensorObservationFilter,
  ) => SensorMcpCapabilityAvailability[];
  getSensorFailurePatterns: (filter: SensorObservationFilter) => SensorFailurePattern[];
  getFeedbackCandidates: (filter: SensorObservationFilter) => SensorFeedbackCandidate[];
}>;

const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_RECORDS = 5_000;

export type ObservabilityStoreOptions = Readonly<{
  /** Maximum number of records retained in memory before oldest entries are evicted. */
  maxRecords?: number;
}>;

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

function normalizeMaxRecords(maxRecords?: number): number {
  if (maxRecords == null) return DEFAULT_MAX_RECORDS;
  if (!Number.isFinite(maxRecords) || maxRecords < 1) {
    throw new TypeError('maxRecords must be a positive number');
  }
  return Math.floor(maxRecords);
}

function toLevel(event: ObservabilityEvent): ObservabilityLevel {
  if (event.kind === 'error') return 'error';
  if (event.kind === 'dod_check' && !event.passed) return 'error';
  if (event.kind === 'sensor_run' && event.results.some((result) => result.status === 'failed')) {
    return 'error';
  }
  if (event.kind === 'task_end' && !event.ok) return 'warn';
  return 'info';
}

function newestFirst(a: ObservabilityRecord, b: ObservabilityRecord): number {
  return b.timestampMs - a.timestampMs;
}

function oldestFirst(a: ObservabilityRecord, b: ObservabilityRecord): number {
  return a.timestampMs - b.timestampMs;
}

const MAX_TEXT_CHARS = 1_000;
const MAX_EVIDENCE_CONTENT_CHARS = 800;
const MAX_TERMINAL_CONTENT_CHARS = 1_200;

function redactText(value: string): string {
  return value
    .replaceAll(/sk-(?:proj-|svcacct-)?[A-Za-z0-9_*.-]{20,}/g, '[REDACTED:OpenAI API Key]')
    .replaceAll(/(ghp|gho|ghu|ghs|ghr)_\w{36,}/g, '[REDACTED:GitHub Token]')
    .replaceAll(/Bearer\s+[A-Za-z0-9_\-.~+/]{20,}/g, '[REDACTED:Bearer Token]')
    .replaceAll(/\/Users\/[^/\s]+/g, '/Users/[REDACTED]');
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === 'string') return truncateText(redactText(value), MAX_TEXT_CHARS).content;
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactUnknown(entry)]),
    );
  }
  return value;
}

function truncateText(value: string, maxChars: number): { content: string; truncated: boolean } {
  if (value.length <= maxChars) return { content: value, truncated: false };
  return { content: `${value.slice(0, Math.max(0, maxChars - 12))}\n<truncated>`, truncated: true };
}

function sanitizeFinding(finding: SensorFinding): SensorFinding {
  return {
    ...finding,
    message: truncateText(redactText(finding.message), MAX_TEXT_CHARS).content,
    file: finding.file ? redactText(finding.file) : undefined,
    dedupeKey: finding.dedupeKey ? redactText(finding.dedupeKey) : undefined,
    evidence: finding.evidence.map((evidence) => {
      const content = evidence.content
        ? truncateText(redactText(evidence.content), MAX_EVIDENCE_CONTENT_CHARS)
        : undefined;
      return {
        ...evidence,
        uri: evidence.uri ? redactText(evidence.uri) : undefined,
        file: evidence.file ? redactText(evidence.file) : undefined,
        content: content?.content,
        truncated: evidence.truncated || content?.truncated === true,
        redacted: evidence.redacted || content != null,
      };
    }),
    metadata: redactUnknown(finding.metadata) as Record<string, unknown>,
  };
}

function sanitizeSensorEvent(event: Extract<ObservabilityEvent, { kind: 'sensor_run' }>) {
  return {
    ...event,
    records: event.records.map((record) => ({
      ...record,
      metadata: redactUnknown(record.metadata) as Record<string, unknown>,
      result: record.result ? sanitizeResult(record.result) : undefined,
    })),
    results: event.results.map(sanitizeResult),
    providerAvailability: event.providerAvailability.map((availability) => ({
      ...availability,
      message: availability.message
        ? truncateText(redactText(availability.message), MAX_TEXT_CHARS).content
        : undefined,
    })),
    runtimeLimitations: event.runtimeLimitations.map((limitation) => ({
      ...limitation,
      message: truncateText(redactText(limitation.message), MAX_TEXT_CHARS).content,
      metadata: redactUnknown(limitation.metadata) as Record<string, unknown>,
    })),
    mcpCapabilities: event.mcpCapabilities.map((capability) => ({
      ...capability,
      message: capability.message
        ? truncateText(redactText(capability.message), MAX_TEXT_CHARS).content
        : undefined,
    })),
  };
}

function sanitizeResult(
  result: Extract<ObservabilityEvent, { kind: 'sensor_run' }>['results'][number],
) {
  const summary = truncateText(redactText(result.summary), MAX_TEXT_CHARS);
  return {
    ...result,
    summary: summary.content,
    findings: result.findings.map(sanitizeFinding),
    evidence: result.evidence.map((evidence) => {
      const content = evidence.content
        ? truncateText(redactText(evidence.content), MAX_EVIDENCE_CONTENT_CHARS)
        : undefined;
      return {
        ...evidence,
        uri: evidence.uri ? redactText(evidence.uri) : undefined,
        file: evidence.file ? redactText(evidence.file) : undefined,
        content: content?.content,
        truncated: evidence.truncated || content?.truncated === true,
        redacted: evidence.redacted || content != null,
      };
    }),
    terminalEvidence: result.terminalEvidence.map((evidence) => {
      const content = truncateText(redactText(evidence.content), MAX_TERMINAL_CONTENT_CHARS);
      return {
        ...evidence,
        content: content.content,
        truncated: evidence.truncated || content.truncated,
        redacted: true,
      };
    }),
    providerAvailability: result.providerAvailability
      ? {
          ...result.providerAvailability,
          message: result.providerAvailability.message
            ? truncateText(redactText(result.providerAvailability.message), MAX_TEXT_CHARS).content
            : undefined,
        }
      : undefined,
    runtimeLimitations: result.runtimeLimitations.map((limitation) => ({
      ...limitation,
      message: truncateText(redactText(limitation.message), MAX_TEXT_CHARS).content,
      metadata: redactUnknown(limitation.metadata) as Record<string, unknown>,
    })),
    metadata: redactUnknown(result.metadata) as Record<string, unknown>,
  };
}

function sanitizeEvent(event: ObservabilityEvent): ObservabilityEvent {
  if (event.kind === 'error') {
    return { ...event, message: truncateText(redactText(event.message), MAX_TEXT_CHARS).content };
  }
  if (event.kind === 'task_end' && event.detail) {
    return { ...event, detail: truncateText(redactText(event.detail), MAX_TEXT_CHARS).content };
  }
  if (event.kind === 'sensor_run') return sanitizeSensorEvent(event);
  return event;
}

function sensorRecords(
  records: readonly ObservabilityRecord[],
  filter: SensorObservationFilter,
): ObservabilityRecord[] {
  const sessionId = requireSessionId(filter.sessionId);
  const sinceMs = parseSince(filter.since);
  const limit = normalizeLimit(filter.limit);
  return records
    .filter(
      (record) =>
        record.sessionId === sessionId &&
        record.kind === 'sensor_run' &&
        (sinceMs == null || record.timestampMs >= sinceMs),
    )
    .sort(newestFirst)
    .slice(0, limit);
}

function findingKey(finding: ObservedSensorFinding): string {
  return (
    finding.dedupeKey ??
    [finding.source, finding.ruleId, finding.file, finding.line, finding.message]
      .filter(Boolean)
      .join(':')
  );
}

function severityRank(severity?: SensorFinding['severity']): number {
  if (severity === 'critical') return 5;
  if (severity === 'high') return 4;
  if (severity === 'medium') return 3;
  if (severity === 'low') return 2;
  if (severity === 'info') return 1;
  return 0;
}

function strongerSeverity(
  left?: SensorFinding['severity'],
  right?: SensorFinding['severity'],
): SensorFinding['severity'] | undefined {
  return severityRank(right) > severityRank(left) ? right : left;
}

function observedFindingsFromRecords(
  records: readonly ObservabilityRecord[],
  filter: SensorObservationFilter,
): ObservedSensorFinding[] {
  const findings: ObservedSensorFinding[] = [];
  for (const record of sensorRecords(records, filter)) {
    if (record.event.kind !== 'sensor_run') continue;
    for (const result of record.event.results) {
      for (const finding of result.findings) {
        findings.push({
          ...finding,
          sensorId: result.sensorId,
          runId: record.event.runId,
          observedAtMs: record.timestampMs,
        });
      }
    }
  }
  return findings;
}

function dedupeObservedFindings(findings: readonly ObservedSensorFinding[]) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.runId}:${finding.sensorId}:${findingKey(finding)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function failurePatternsFromFindings(
  findings: readonly ObservedSensorFinding[],
): SensorFailurePattern[] {
  const patterns = new Map<string, SensorFailurePattern>();
  for (const finding of findings) {
    if (finding.status !== 'open') continue;
    const key = `${finding.sensorId}:${findingKey(finding)}`;
    const existing = patterns.get(key);
    const file = finding.file ? [finding.file] : [];
    if (!existing) {
      patterns.set(key, {
        key,
        sensorId: finding.sensorId,
        count: 1,
        severity: finding.severity,
        ruleId: finding.ruleId,
        files: file,
        firstSeenMs: finding.observedAtMs,
        lastSeenMs: finding.observedAtMs,
      });
      continue;
    }
    patterns.set(key, {
      ...existing,
      count: existing.count + 1,
      severity: strongerSeverity(existing.severity, finding.severity),
      files: [...new Set([...existing.files, ...file])],
      firstSeenMs: Math.min(existing.firstSeenMs, finding.observedAtMs),
      lastSeenMs: Math.max(existing.lastSeenMs, finding.observedAtMs),
    });
  }
  return [...patterns.values()].sort((left, right) => {
    const countDiff = right.count - left.count;
    return countDiff === 0 ? right.lastSeenMs - left.lastSeenMs : countDiff;
  });
}

function candidatesFromPatterns(
  patterns: readonly SensorFailurePattern[],
): SensorFeedbackCandidate[] {
  return patterns
    .filter((pattern) => pattern.count >= 2)
    .flatMap((pattern): SensorFeedbackCandidate[] => [
      {
        id: `memory:${pattern.key}`,
        kind: 'memory_candidate',
        summary: `Remember recurring ${pattern.sensorId} failure pattern for future repair planning.`,
        evidence: pattern.files,
        reviewRequired: true,
        autoApply: false,
      },
      {
        id: `beads:${pattern.key}`,
        kind: 'beads_issue_proposal',
        summary: `Review repeated ${pattern.sensorId} failures and decide whether a follow-up task is needed.`,
        evidence: pattern.files,
        reviewRequired: true,
        autoApply: false,
      },
    ]);
}

export function createObservabilityStore(
  options: ObservabilityStoreOptions = {},
): ObservabilityStore {
  const maxRecords = normalizeMaxRecords(options.maxRecords);
  const records: ObservabilityRecord[] = [];

  return {
    record(event) {
      const timestampMs = Date.now();
      const sanitizedEvent = sanitizeEvent(event);
      const record: ObservabilityRecord = {
        id: randomUUID(),
        sessionId: requireSessionId(sanitizedEvent.sessionId),
        traceId: 'runId' in sanitizedEvent ? sanitizedEvent.runId : null,
        kind: sanitizedEvent.kind,
        level: toLevel(sanitizedEvent),
        timestamp: new Date(timestampMs).toISOString(),
        timestampMs,
        event: sanitizedEvent,
      };
      records.push(record);
      if (records.length > maxRecords) {
        records.splice(0, records.length - maxRecords);
      }
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

    getSensorFindings(filter) {
      return dedupeObservedFindings(observedFindingsFromRecords(records, filter));
    },

    getSensorProviderAvailability(filter) {
      const availability: SensorProviderAvailability[] = [];
      const seen = new Set<string>();
      for (const record of sensorRecords(records, filter)) {
        if (record.event.kind !== 'sensor_run') continue;
        for (const item of record.event.providerAvailability) {
          const key = `${item.provider}:${item.capability}`;
          if (seen.has(key)) continue;
          seen.add(key);
          availability.push(item);
        }
      }
      return availability;
    },

    getSensorRuntimeLimitations(filter) {
      const limitations: SensorRuntimeLimitation[] = [];
      const seen = new Set<string>();
      for (const record of sensorRecords(records, filter)) {
        if (record.event.kind !== 'sensor_run') continue;
        for (const limitation of record.event.runtimeLimitations) {
          const key = `${limitation.kind}:${limitation.message}`;
          if (seen.has(key)) continue;
          seen.add(key);
          limitations.push(limitation);
        }
      }
      return limitations;
    },

    getMcpCapabilityAvailability(filter) {
      const capabilities: SensorMcpCapabilityAvailability[] = [];
      const seen = new Set<string>();
      for (const record of sensorRecords(records, filter)) {
        if (record.event.kind !== 'sensor_run') continue;
        for (const capability of record.event.mcpCapabilities) {
          const key = `${capability.serverId}:${capability.capability}`;
          if (seen.has(key)) continue;
          seen.add(key);
          capabilities.push(capability);
        }
      }
      return capabilities;
    },

    getSensorFailurePatterns(filter) {
      return failurePatternsFromFindings(
        dedupeObservedFindings(
          observedFindingsFromRecords(records, { ...filter, limit: Number.MAX_SAFE_INTEGER }),
        ),
      );
    },

    getFeedbackCandidates(filter) {
      return candidatesFromPatterns(
        failurePatternsFromFindings(
          dedupeObservedFindings(
            observedFindingsFromRecords(records, { ...filter, limit: Number.MAX_SAFE_INTEGER }),
          ),
        ),
      );
    },
  };
}
