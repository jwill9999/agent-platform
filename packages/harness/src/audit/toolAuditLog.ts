import { randomUUID } from 'node:crypto';
import type { Output, RiskTier } from '@agent-platform/contracts';
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

const REDACT_KEYS = new Set([
  'key',
  'token',
  'password',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'credentials',
  'access_token',
  'refresh_token',
  'private_key',
]);

export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      result[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      result[k] = redactArgs(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

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

      const status = output.type === 'error' ? 'error' : 'success';
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
  };
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
  };
}
