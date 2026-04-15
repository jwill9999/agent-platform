import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
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
  if (t === 'sse' || t === 'streamable-http') {
    const url = mcp.url?.trim();
    if (!url) {
      throw new McpAdapterError('INVALID_CONFIG', `${t} transport requires url`);
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new McpAdapterError(
        'INVALID_CONFIG',
        `${t} transport requires a valid URL (got: "${url}")`,
      );
    }
    return new StreamableHTTPClientTransport(parsed);
  }
  throw new McpAdapterError(
    'INVALID_CONFIG',
    `Unsupported MCP transport "${mcp.transport}" (use stdio, streamable-http, or sse)`,
  );
}
