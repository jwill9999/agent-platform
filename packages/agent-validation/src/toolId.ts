/**
 * MCP-backed tools use composite ids `mcpServerId:mcpToolName` (first `:` splits server vs name).
 * Plain registry tools use a single id with no reserved `:` pattern.
 */
export type ParsedToolId =
  | { kind: 'plain'; toolId: string }
  | { kind: 'mcp'; mcpServerId: string; mcpToolName: string };

export function parseToolId(toolId: string): ParsedToolId {
  const idx = toolId.indexOf(':');
  if (idx <= 0) {
    return { kind: 'plain', toolId };
  }
  const mcpServerId = toolId.slice(0, idx);
  const mcpToolName = toolId.slice(idx + 1);
  if (!mcpToolName) {
    return { kind: 'plain', toolId };
  }
  return { kind: 'mcp', mcpServerId, mcpToolName };
}
