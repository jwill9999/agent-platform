import { randomUUID } from 'node:crypto';
import { redactArgs, type Output, type RiskTier } from '@agent-platform/contracts';
import { SYSTEM_TOOL_RISK } from '../systemTools.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolAuditEntry {
  id: string;
  toolName: string;
  agentId: string;
  sessionId: string;
  argsJson: string;
  riskTier?: RiskTier;
  status: 'pending' | 'success' | 'error' | 'denied';
  startedAtMs: number;
}

export interface ToolAuditCompletion {
  resultJson: string;
  status: 'success' | 'error' | 'denied';
  completedAtMs: number;
  durationMs: number;
}

/**
 * Storage backend for audit records. Implemented by DB layer.
 */
export interface ToolAuditStore {
  insert(entry: ToolAuditEntry): void;
  complete(id: string, data: ToolAuditCompletion): void;
}

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

export { redactArgs } from '@agent-platform/contracts';

// ---------------------------------------------------------------------------
// Zero-risk check (skip logging for pure compute tools)
// ---------------------------------------------------------------------------

function isZeroRisk(toolName: string): boolean {
  return SYSTEM_TOOL_RISK[toolName] === 'zero';
}

function resolveAuditRiskTier(toolName: string, riskTierOverride?: RiskTier): RiskTier {
  return riskTierOverride ?? SYSTEM_TOOL_RISK[toolName] ?? 'high';
}

const MAX_AUDIT_JSON_LENGTH = 8_192;
const MAX_AUDIT_STRING_LENGTH = 2_048;
const MAX_AUDIT_ARRAY_ITEMS = 50;
const MAX_AUDIT_OBJECT_KEYS = 50;
const MAX_AUDIT_DEPTH = 6;

function truncateAuditString(value: string): string {
  if (value.length <= MAX_AUDIT_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_AUDIT_STRING_LENGTH)}[TRUNCATED ${value.length - MAX_AUDIT_STRING_LENGTH} chars]`;
}

function boundAuditValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return truncateAuditString(value);
  if (typeof value !== 'object' || value === null) return value;
  if (depth >= MAX_AUDIT_DEPTH) return '[TRUNCATED depth]';
  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_AUDIT_ARRAY_ITEMS)
      .map((item) => boundAuditValue(item, depth + 1));
    if (value.length > MAX_AUDIT_ARRAY_ITEMS) {
      items.push(`[TRUNCATED ${value.length - MAX_AUDIT_ARRAY_ITEMS} items]`);
    }
    return items;
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value);
  for (const [key, nested] of entries.slice(0, MAX_AUDIT_OBJECT_KEYS)) {
    result[key] = boundAuditValue(nested, depth + 1);
  }
  if (entries.length > MAX_AUDIT_OBJECT_KEYS) {
    result._truncated = `${entries.length - MAX_AUDIT_OBJECT_KEYS} keys`;
  }
  return result;
}

function stringifyAuditPayload(value: unknown): string {
  const bounded = boundAuditValue(value);
  const json = JSON.stringify(bounded);
  if (json.length <= MAX_AUDIT_JSON_LENGTH) return json;
  return JSON.stringify({
    truncated: true,
    preview: `${json.slice(0, MAX_AUDIT_JSON_LENGTH - 128)}[TRUNCATED ${json.length - MAX_AUDIT_JSON_LENGTH + 128} chars]`,
  });
}

function redactAndStringifyArgs(args: Record<string, unknown>): string {
  return stringifyAuditPayload(redactArgs(args));
}

// ---------------------------------------------------------------------------
// Audit logger
// ---------------------------------------------------------------------------

export interface ToolAuditLogger {
  /** Log the start of a tool execution. Returns the audit entry ID (null if skipped). */
  logStart(
    toolName: string,
    args: Record<string, unknown>,
    agentId: string,
    sessionId: string,
    riskTier?: RiskTier,
  ): string | null;

  /** Log completion of a tool execution. */
  logComplete(id: string, output: Output): void;

  /** Log a denied execution (PathJail, bash guard, etc). */
  logDenied(
    toolName: string,
    args: Record<string, unknown>,
    agentId: string,
    sessionId: string,
    reason: string,
    riskTier?: RiskTier,
  ): void;

  /** Log a tool call that is pending human approval. */
  logPendingApproval(
    toolName: string,
    args: Record<string, unknown>,
    agentId: string,
    sessionId: string,
    riskTier?: RiskTier,
  ): string | null;

  /** Log a human-rejected approval request. */
  logRejectedApproval(
    toolName: string,
    args: Record<string, unknown>,
    agentId: string,
    sessionId: string,
    reason: string,
    riskTier?: RiskTier,
  ): void;
}

export function createToolAuditLogger(store: ToolAuditStore): ToolAuditLogger {
  const startTimes = new Map<string, number>();

  return {
    logStart(toolName, args, agentId, sessionId, riskTierOverride) {
      const riskTier = resolveAuditRiskTier(toolName, riskTierOverride);
      if (riskTier === 'zero' || (!riskTierOverride && isZeroRisk(toolName))) return null;

      const id = randomUUID();
      const now = Date.now();

      startTimes.set(id, now);

      store.insert({
        id,
        toolName,
        agentId,
        sessionId,
        argsJson: redactAndStringifyArgs(args),
        riskTier,
        status: 'pending',
        startedAtMs: now,
      });

      return id;
    },

    logComplete(id, output) {
      const now = Date.now();
      const startMs = startTimes.get(id) ?? now;
      startTimes.delete(id);

      const status = outputToAuditStatus(output);
      const resultJson = stringifyAuditPayload(
        output.type === 'tool_result' ? output.data : output,
      );

      store.complete(id, {
        resultJson,
        status,
        completedAtMs: now,
        durationMs: now - startMs,
      });
    },

    logDenied(toolName, args, agentId, sessionId, reason, riskTierOverride) {
      const riskTier = resolveAuditRiskTier(toolName, riskTierOverride);
      if (riskTier === 'zero' || (!riskTierOverride && isZeroRisk(toolName))) return;

      const id = randomUUID();
      const now = Date.now();

      store.insert({
        id,
        toolName,
        agentId,
        sessionId,
        argsJson: redactAndStringifyArgs(args),
        riskTier,
        status: 'denied',
        startedAtMs: now,
      });

      store.complete(id, {
        resultJson: stringifyAuditPayload({ denied: true, reason }),
        status: 'denied',
        completedAtMs: now,
        durationMs: 0,
      });
    },

    logPendingApproval(toolName, args, agentId, sessionId, riskTierOverride) {
      const riskTier = resolveAuditRiskTier(toolName, riskTierOverride);
      if (riskTier === 'zero' || (!riskTierOverride && isZeroRisk(toolName))) return null;

      const id = randomUUID();
      const now = Date.now();

      store.insert({
        id,
        toolName,
        agentId,
        sessionId,
        argsJson: redactAndStringifyArgs(args),
        riskTier,
        status: 'pending',
        startedAtMs: now,
      });

      return id;
    },

    logRejectedApproval(toolName, args, agentId, sessionId, reason, riskTierOverride) {
      const riskTier = resolveAuditRiskTier(toolName, riskTierOverride);
      if (riskTier === 'zero' || (!riskTierOverride && isZeroRisk(toolName))) return;

      const id = randomUUID();
      const now = Date.now();

      store.insert({
        id,
        toolName,
        agentId,
        sessionId,
        argsJson: redactAndStringifyArgs(args),
        riskTier,
        status: 'denied',
        startedAtMs: now,
      });

      store.complete(id, {
        resultJson: stringifyAuditPayload({ rejected: true, reason }),
        status: 'denied',
        completedAtMs: now,
        durationMs: 0,
      });
    },
  };
}

function outputToAuditStatus(output: Output): 'success' | 'error' | 'denied' {
  if (output.type === 'error') return 'error';
  if (
    output.type === 'tool_result' &&
    typeof output.data === 'object' &&
    output.data !== null &&
    !Array.isArray(output.data)
  ) {
    const data = output.data as {
      ok?: unknown;
      evidence?: { status?: unknown };
      exitCode?: unknown;
    };
    if (typeof data.exitCode === 'number' && data.exitCode !== 0) return 'error';
    if (data.ok !== false) return 'success';
    const evidence = data.evidence;
    return evidence?.status === 'denied' ? 'denied' : 'error';
  }
  return 'success';
}

/**
 * No-op logger for tests or when audit logging is disabled.
 */
export function createNoopAuditLogger(): ToolAuditLogger {
  return {
    logStart() {
      return null;
    },
    logComplete() {},
    logDenied() {},
    logPendingApproval() {
      return null;
    },
    logRejectedApproval() {},
  };
}
