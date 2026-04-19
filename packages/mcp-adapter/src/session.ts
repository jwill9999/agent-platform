import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { McpServer, Output, Tool as ContractTool } from '@agent-platform/contracts';
import { getConnectTimeoutMs, getRequestTimeoutMs } from './env.js';
import { callToolResultToOutputs } from './callTool.js';
import { McpAdapterError } from './errors.js';
import { mcpToolToContractTool } from './mapTools.js';
import { createTransportForMcpServer } from './transport.js';

const CLIENT_INFO = { name: 'agent-platform-mcp-adapter', version: '0.0.0' };

/** Known writable directory for MCP tool file output inside containers. */
const MCP_OUTPUT_DIR = '/tmp/playwright-mcp';

/** File-path arg keys that LLMs commonly populate with non-writable paths. */
const FILE_ARG_KEYS = new Set(['filename', 'path', 'outputPath', 'filePath']);

/**
 * Rewrite file-path arguments that point to read-only container paths (e.g. /app/).
 * Redirects them to the writable MCP output directory so the tool doesn't EACCES.
 */
export function rewriteFileArgs(args: Record<string, unknown>): Record<string, unknown> {
  const result = { ...args };
  for (const key of FILE_ARG_KEYS) {
    const val = result[key];
    if (typeof val === 'string' && val.startsWith('/app/')) {
      const basename = val.split('/').pop() ?? 'output.png';
      result[key] = `${MCP_OUTPUT_DIR}/${basename}`;
    }
  }
  return result;
}

export type McpToolResult = { output: Output; images: Output[] };

export type McpSession = {
  /** MCP `tools/list` mapped to persisted-style {@link ContractTool} rows (synthetic ids). */
  listContractTools(): Promise<ContractTool[]>;
  /** `tools/call` mapped to streaming/API `Output` union, with extracted images for the stream. */
  callToolAsOutput(
    mcpToolName: string,
    args: Record<string, unknown>,
    options?: { timeoutMs?: number },
  ): Promise<McpToolResult>;
  close(): Promise<void>;
};

/**
 * Connect to an MCP server using persisted registry config, then expose list/call helpers.
 * Callers must {@link McpSession.close} when done to release transports/processes.
 */
export async function openMcpSession(mcp: McpServer): Promise<McpSession> {
  const transport = createTransportForMcpServer(mcp);
  const client = new Client(CLIENT_INFO);
  const connectMs = getConnectTimeoutMs();
  const requestMs = getRequestTimeoutMs();

  try {
    await client.connect(transport, { timeout: connectMs });
  } catch (e) {
    await transport.close().catch(() => {});
    throw new McpAdapterError('CONNECT_FAILED', `MCP connect failed for server "${mcp.id}"`, e);
  }

  return {
    async listContractTools() {
      const result = await client.listTools({}, { timeout: requestMs });
      return result.tools.map((t) => mcpToolToContractTool(mcp.id, t));
    },

    async callToolAsOutput(
      name: string,
      args: Record<string, unknown>,
      options?: { timeoutMs?: number },
    ) {
      try {
        const sanitizedArgs = rewriteFileArgs(args);
        const result = await client.callTool({ name, arguments: sanitizedArgs }, undefined, {
          timeout: options?.timeoutMs ?? requestMs,
        });
        return callToolResultToOutputs(mcp.id, name, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { output: { type: 'error' as const, code: 'MCP_CALL_FAILED', message }, images: [] };
      }
    },

    async close() {
      await transport.close();
    },
  };
}

/** List tools using an already-constructed client (for tests). */
export async function listContractToolsFromClient(
  client: Pick<Client, 'listTools'>,
  mcpServerId: string,
  requestTimeoutMs: number,
): Promise<ContractTool[]> {
  const result = await client.listTools({}, { timeout: requestTimeoutMs });
  return result.tools.map((t) => mcpToolToContractTool(mcpServerId, t));
}
