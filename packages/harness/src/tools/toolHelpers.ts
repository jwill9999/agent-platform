/**
 * Shared helpers for system tool implementations.
 *
 * Centralises common patterns (arg extraction, error formatting, output
 * construction) to reduce code duplication across risk-tier tool modules.
 */

import type { Output, RiskTier } from '@agent-platform/contracts';

export const SYSTEM_TOOL_PREFIX = 'sys_';

export const MAX_OUTPUT_BYTES = 100_000;

/** Safely extract a string argument with a fallback. */
export function stringArg(args: Record<string, unknown>, key: string, fallback = ''): string {
  const val = args[key];
  return typeof val === 'string' ? val : fallback;
}

/** Extract a human-readable message from an unknown error. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Truncate text to `max` characters with an ellipsis note. */
export function truncate(text: string, max: number = MAX_OUTPUT_BYTES): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… (truncated, ${text.length} total chars)`;
}

/** Build a successful tool result output. */
export function toolResult(toolId: string, data: Record<string, unknown>): Output {
  return { type: 'tool_result', toolId, data };
}

/** Build an error output. */
export function toolError(code: string, message: string): Output {
  return { type: 'error', code, message };
}

/** Build a risk-tier map from an ID record. */
export function buildRiskMap(
  ids: Record<string, string>,
  tier: RiskTier,
): Record<string, RiskTier> {
  return Object.fromEntries(Object.values(ids).map((id) => [id, tier]));
}
