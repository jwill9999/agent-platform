import type { Output, Tool as ContractTool } from '@agent-platform/contracts';

import { SYSTEM_TOOL_PREFIX, buildRiskMap, toolError, toolResult } from './toolHelpers.js';

type ObservabilityEventRecord = Readonly<{
  kind: string;
}> &
  Readonly<Record<string, unknown>>;

type ObservabilityLevel = 'info' | 'warn' | 'error';

type ObservabilityRecord = Readonly<{
  id: string;
  sessionId: string;
  traceId: string | null;
  kind: string;
  level: ObservabilityLevel;
  timestamp: string;
  timestampMs: number;
  event: ObservabilityEventRecord;
}>;

type ObservabilityStore = Readonly<{
  getLogs: (filter: {
    sessionId: string;
    level?: ObservabilityLevel;
    since?: string;
    limit?: number;
  }) => ObservabilityRecord[];
  getErrors: (filter: {
    sessionId: string;
    since?: string;
    limit?: number;
  }) => ObservabilityRecord[];
  getTrace: (filter: {
    sessionId: string;
    traceId?: string;
  }) => { traceId: string; records: readonly ObservabilityRecord[] } | undefined;
}>;

export type ObservabilityToolContext = Readonly<{
  store: ObservabilityStore;
  sessionId: string;
  traceId: string;
}>;

export const OBSERVABILITY_IDS = {
  queryLogs: `${SYSTEM_TOOL_PREFIX}query_logs`,
  queryRecentErrors: `${SYSTEM_TOOL_PREFIX}query_recent_errors`,
  inspectTrace: `${SYSTEM_TOOL_PREFIX}inspect_trace`,
} as const;

export const OBSERVABILITY_MAP = buildRiskMap(OBSERVABILITY_IDS, 'zero');

export const OBSERVABILITY_TOOLS: readonly ContractTool[] = [
  {
    id: OBSERVABILITY_IDS.queryLogs,
    slug: 'sys-query-logs',
    name: 'query_logs',
    description: 'Query recent observability log records for the current session only.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: ['info', 'warn', 'error'],
            description: 'Optional log level filter.',
          },
          since: {
            type: 'string',
            description: 'Optional ISO-8601 timestamp cursor.',
          },
          limit: {
            type: 'number',
            description: 'Maximum records to return (1-50, default 20).',
          },
        },
      },
    },
  },
  {
    id: OBSERVABILITY_IDS.queryRecentErrors,
    slug: 'sys-query-recent-errors',
    name: 'query_recent_errors',
    description: 'Query recent error records and DoD failures for the current session only.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum error records to return (1-50, default 10).',
          },
        },
      },
    },
  },
  {
    id: OBSERVABILITY_IDS.inspectTrace,
    slug: 'sys-inspect-trace',
    name: 'inspect_trace',
    description: 'Inspect the ordered event list for a trace in the current session.',
    riskTier: 'zero',
    config: {
      inputSchema: {
        type: 'object',
        properties: {
          traceId: {
            type: 'string',
            description: 'Trace ID to inspect. Defaults to the current run.',
          },
        },
      },
    },
  },
];

const DEFAULT_LOG_LIMIT = 20;
const DEFAULT_ERROR_LIMIT = 10;
const MAX_RESULT_RECORDS = 50;
const MAX_RESULT_BYTES = 16 * 1024;

function parseLimit(args: Record<string, unknown>, fallback: number): number | Output {
  const raw = args.limit;
  if (raw == null) return fallback;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) {
    return toolError('INVALID_ARGS', 'limit must be a positive number');
  }
  return Math.min(Math.floor(raw), MAX_RESULT_RECORDS);
}

function parseSince(args: Record<string, unknown>): string | undefined | Output {
  const raw = args.since;
  if (raw == null) return undefined;
  if (typeof raw !== 'string' || !raw.trim()) {
    return toolError('INVALID_ARGS', 'since must be a non-empty ISO timestamp');
  }
  if (Number.isNaN(Date.parse(raw))) {
    return toolError('INVALID_ARGS', 'since must be a valid ISO timestamp');
  }
  return raw;
}

function parseLevel(args: Record<string, unknown>): ObservabilityLevel | undefined | Output {
  const raw = args.level;
  if (raw == null) return undefined;
  if (raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return toolError('INVALID_ARGS', 'level must be one of: info, warn, error');
}

function truncateRecords(records: readonly ObservabilityRecord[], limit: number) {
  const total = records.length;
  let selected = records.slice(0, limit);
  let truncated = selected.length < total;

  while (selected.length > 0) {
    const size = Buffer.byteLength(JSON.stringify(selected), 'utf-8');
    if (size <= MAX_RESULT_BYTES) break;
    selected = selected.slice(0, -1);
    truncated = true;
  }

  return {
    total,
    truncated,
    records: selected,
  };
}

function requireContext(context?: ObservabilityToolContext): ObservabilityToolContext | Output {
  if (context) return context;
  return toolError(
    'OBSERVABILITY_UNAVAILABLE',
    'Observability tools are unavailable outside a session-bound harness run',
  );
}

function handleQueryLogs(
  toolId: string,
  args: Record<string, unknown>,
  context: ObservabilityToolContext,
): Output {
  const level = parseLevel(args);
  if (typeof level === 'object' && 'type' in level) return level;

  const since = parseSince(args);
  if (typeof since === 'object' && 'type' in since) return since;

  const limit = parseLimit(args, DEFAULT_LOG_LIMIT);
  if (typeof limit === 'object' && 'type' in limit) return limit;

  const records = context.store.getLogs({
    sessionId: context.sessionId,
    level,
    since,
    limit: Number.MAX_SAFE_INTEGER,
  });

  return toolResult(toolId, truncateRecords(records, limit));
}

function handleQueryRecentErrors(
  toolId: string,
  args: Record<string, unknown>,
  context: ObservabilityToolContext,
): Output {
  const limit = parseLimit(args, DEFAULT_ERROR_LIMIT);
  if (typeof limit === 'object' && 'type' in limit) return limit;

  const records = context.store.getErrors({
    sessionId: context.sessionId,
    limit: Number.MAX_SAFE_INTEGER,
  });

  return toolResult(toolId, truncateRecords(records, limit));
}

function resolveTraceId(
  args: Record<string, unknown>,
  context: ObservabilityToolContext,
): string | Output {
  const traceIdArg = args.traceId;
  if (traceIdArg != null && (typeof traceIdArg !== 'string' || !traceIdArg.trim())) {
    return toolError('INVALID_ARGS', 'traceId must be a non-empty string when provided');
  }

  return typeof traceIdArg === 'string' ? traceIdArg : context.traceId;
}

function handleInspectTrace(
  toolId: string,
  args: Record<string, unknown>,
  context: ObservabilityToolContext,
): Output {
  const traceId = resolveTraceId(args, context);
  if (typeof traceId === 'object' && 'type' in traceId) return traceId;

  const trace = context.store.getTrace({
    sessionId: context.sessionId,
    traceId,
  });
  if (!trace) {
    return toolError('TRACE_NOT_FOUND', `Trace '${traceId}' was not found in the current session`);
  }

  const envelope = truncateRecords(trace.records, MAX_RESULT_RECORDS);
  return toolResult(toolId, {
    traceId: trace.traceId,
    total: envelope.total,
    truncated: envelope.truncated,
    events: envelope.records,
  });
}

export async function executeObservabilityTool(
  toolId: string,
  args: Record<string, unknown>,
  context?: ObservabilityToolContext,
): Promise<Output> {
  const resolvedContext = requireContext(context);
  if ('type' in resolvedContext) return resolvedContext;

  if (toolId === OBSERVABILITY_IDS.queryLogs) {
    return handleQueryLogs(toolId, args, resolvedContext);
  }

  if (toolId === OBSERVABILITY_IDS.queryRecentErrors) {
    return handleQueryRecentErrors(toolId, args, resolvedContext);
  }

  if (toolId === OBSERVABILITY_IDS.inspectTrace) {
    return handleInspectTrace(toolId, args, resolvedContext);
  }

  return toolError('TOOL_NOT_FOUND', `Unknown observability tool '${toolId}'`);
}
