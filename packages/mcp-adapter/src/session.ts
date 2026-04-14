import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool as ContractTool } from '@agent-platform/contracts';
import type { Output } from '@agent-platform/contracts';
import type { McpServer } from '@agent-platform/contracts';
import { getConnectTimeoutMs, getRequestTimeoutMs } from './env.js';
import { callToolResultToOutput } from './callTool.js';
import { McpAdapterError } from './errors.js';
import { mcpToolToContractTool } from './mapTools.js';
import { createTransportForMcpServer } from './transport.js';

const CLIENT_INFO = { name: 'agent-platform-mcp-adapter', version: '0.0.0' };

export type McpSession = {
  /** MCP `tools/list` mapped to persisted-style {@link ContractTool} rows (synthetic ids). */
  listContractTools(): Promise<ContractTool[]>;
  /** `tools/call` mapped to streaming/API `Output` union. */
  callToolAsOutput(mcpToolName: string, args: Record<string, unknown>): Promise<Output>;
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

    async callToolAsOutput(name: string, args: Record<string, unknown>) {
      try {
        const result = await client.callTool({ name, arguments: args }, undefined, {
          timeout: requestMs,
        });
        return callToolResultToOutput(mcp.id, name, result);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { type: 'error', code: 'MCP_CALL_FAILED', message };
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
