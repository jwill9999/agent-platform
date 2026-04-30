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
}

export function createToolAuditLogger(store: ToolAuditStore): ToolAuditLogger {
  const startTimes = new Map<string, number>();

  return {
    logStart(toolName, args, agentId, sessionId, riskTierOverride) {
      const riskTier = resolveAuditRiskTier(toolName, riskTierOverride);
      if (riskTier === 'zero' || (!riskTierOverride && isZeroRisk(toolName))) return null;

      const id = randomUUID();
      const redacted = redactArgs(args);
      const now = Date.now();

      startTimes.set(id, now);

      store.insert({
        id,
        toolName,
        agentId,
        sessionId,
        argsJson: JSON.stringify(redacted),
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
      const resultJson = JSON.stringify(output.type === 'tool_result' ? output.data : output);

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
      const redacted = redactArgs(args);
      const now = Date.now();

      store.insert({
        id,
        toolName,
        agentId,
        sessionId,
        argsJson: JSON.stringify(redacted),
        riskTier,
        status: 'denied',
        startedAtMs: now,
      });

      store.complete(id, {
        resultJson: JSON.stringify({ denied: true, reason }),
        status: 'denied',
        completedAtMs: now,
        durationMs: 0,
      });
    },

    logPendingApproval(toolName, args, agentId, sessionId, riskTierOverride) {
      const riskTier = resolveAuditRiskTier(toolName, riskTierOverride);
      if (riskTier === 'zero' || (!riskTierOverride && isZeroRisk(toolName))) return null;

      const id = randomUUID();
      const redacted = redactArgs(args);
      const now = Date.now();

      store.insert({
        id,
        toolName,
        agentId,
        sessionId,
        argsJson: JSON.stringify(redacted),
        riskTier,
        status: 'pending',
        startedAtMs: now,
      });

      return id;
    },
  };
}

function outputToAuditStatus(output: Output): 'success' | 'error' | 'denied' {
  if (output.type === 'error') return 'error';
  if (
    output.type === 'tool_result' &&
    typeof output.data === 'object' &&
    output.data !== null &&
    !Array.isArray(output.data) &&
    (output.data as { ok?: unknown }).ok === false
  ) {
    const evidence = (output.data as { evidence?: { status?: unknown } }).evidence;
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
  };
}
