import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  McpConnectionConfigSchema,
  McpCredentialChangesSchema,
  type ResolvedMcpConnection,
} from '@agent-platform/contracts';
import { McpAdapterError } from './errors.js';

function validateValues(values: Record<string, string> | undefined, kind: 'env' | 'headers'): void {
  const parsed = McpCredentialChangesSchema.safeParse({ [kind]: values });
  if (!parsed.success || Object.values(values ?? {}).some((value) => typeof value !== 'string')) {
    throw new McpAdapterError(
      'INVALID_CONFIG',
      'MCP environment or header configuration is invalid.',
    );
  }
}

/** Only resolved, validated credentials are consumed; arbitrary persisted metadata is ignored. */
export function createTransportForMcpServer(mcp: ResolvedMcpConnection): Transport {
  const parsed = McpConnectionConfigSchema.safeParse({
    name: mcp.name,
    transport: mcp.transport,
    command: mcp.command,
    args: mcp.args,
    url: mcp.url,
  });
  if (!parsed.success)
    throw new McpAdapterError(
      'INVALID_CONFIG',
      'Check the MCP transport, executable arguments and endpoint.',
    );
  const config = parsed.data;
  validateValues(mcp.env, 'env');
  validateValues(mcp.headers, 'headers');
  if (config.transport === 'stdio') {
    if (Object.keys(mcp.headers ?? {}).length)
      throw new McpAdapterError('INVALID_CONFIG', 'HTTP headers cannot be used with stdio.');
    return new StdioClientTransport({
      command: config.command!,
      args: config.args ?? [],
      env: mcp.env,
      stderr: 'ignore',
    });
  }
  if (Object.keys(mcp.env ?? {}).length)
    throw new McpAdapterError('INVALID_CONFIG', 'Environment variables cannot be used with HTTP.');
  return new StreamableHTTPClientTransport(new URL(config.url!), {
    requestInit: { headers: mcp.headers },
    // Never follow even same-origin redirects. Credentials are only sent to the saved endpoint.
    fetch: (input, init) => fetch(input, { ...init, redirect: 'error' }),
    // The adapter must not resume/replay a potentially effectful request after a lost response.
    reconnectionOptions: {
      maxRetries: 0,
      initialReconnectionDelay: 1000,
      maxReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1,
    },
  });
}
