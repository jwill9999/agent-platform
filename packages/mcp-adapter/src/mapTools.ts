import type { Tool as ContractTool } from '@agent-platform/contracts';

/** Single tool entry from MCP `tools/list` (minimal fields we persist in `Tool.config`). */
export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

/** Map one MCP tool to the persisted `Tool` contract (`id` is namespaced per server). */
export function mcpToolToContractTool(mcpServerId: string, tool: McpToolDescriptor): ContractTool {
  const id = `${mcpServerId}:${tool.name}`;
  return {
    id,
    name: tool.name,
    description: tool.description,
    config: {
      mcpServerId,
      mcpToolName: tool.name,
      inputSchema: tool.inputSchema,
    },
  };
}
