import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServer } from '@agent-platform/contracts';
import { McpAdapterError } from './errors.js';

function normalizeTransport(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Build MCP SDK transport from persisted `McpServer` row. */
export function createTransportForMcpServer(mcp: McpServer): Transport {
  const t = normalizeTransport(mcp.transport);
  if (t === 'stdio') {
    const command = mcp.command?.trim();
    if (!command) {
      throw new McpAdapterError('INVALID_CONFIG', 'stdio transport requires non-empty command');
    }
    return new StdioClientTransport({
      command,
      args: mcp.args ?? [],
    });
  }
  if (t === 'sse') {
    const url = mcp.url?.trim();
    if (!url) {
      throw new McpAdapterError('INVALID_CONFIG', 'sse transport requires url');
    }
    return new SSEClientTransport(new URL(url));
  }
  throw new McpAdapterError(
    'INVALID_CONFIG',
    `Unsupported MCP transport "${mcp.transport}" (use stdio or sse)`,
  );
}
