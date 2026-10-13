import { createHash } from 'node:crypto';
import type { Tool } from '@agent-platform/contracts';

/** Binds a human decision to the exact connection and eligible tool they reviewed. */
export type McpApprovalBinding = {
  serverId: string;
  configurationRevision: number;
  toolRevision: string;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function mcpToolRevision(tool: Tool): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(tool)))
    .digest('hex');
}

export function sameMcpApprovalBinding(
  a: McpApprovalBinding | undefined,
  b: McpApprovalBinding | undefined,
): boolean {
  return (
    !!a &&
    !!b &&
    a.serverId === b.serverId &&
    a.configurationRevision === b.configurationRevision &&
    a.toolRevision === b.toolRevision
  );
}
