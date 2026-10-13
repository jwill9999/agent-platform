import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  ResolvedMcpConnection,
  Output,
  Tool as ContractTool,
} from '@agent-platform/contracts';
import { getConnectTimeoutMs, getRequestTimeoutMs } from './env.js';
import { callToolResultToOutputs } from './callTool.js';
import { McpAdapterError, safeMcpFailure } from './errors.js';
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
export type McpOperationOptions = { signal?: AbortSignal };

export type McpSession = {
  listContractTools(options?: McpOperationOptions): Promise<ContractTool[]>;
  callToolAsOutput(
    mcpToolName: string,
    args: Record<string, unknown>,
    options?: McpOperationOptions & { timeoutMs?: number },
  ): Promise<McpToolResult>;
  close(): Promise<void>;
};

function combinedSignal(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  const signals = [a, b].filter((s): s is AbortSignal => s !== undefined);
  return signals.length ? AbortSignal.any(signals) : undefined;
}

/** Include transport startup and initialized notifications in the deadline, not only SDK requests. */
async function bounded<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeout: number,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let rejectInterruption: (reason: McpAdapterError) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    rejectInterruption = reject;
  });
  const interrupt = (code: string, message: string) => {
    controller.abort();
    rejectInterruption(new McpAdapterError(code, message));
  };
  const onAbort = () => interrupt('MCP_INTERRUPTED', 'The MCP operation was interrupted.');
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(
    () =>
      interrupt(
        'MCP_TIMEOUT',
        'The MCP operation timed out. Check the server before trying again.',
      ),
    timeout,
  );
  try {
    if (signal?.aborted) onAbort();
    return await Promise.race([
      interrupted,
      controller.signal.aborted ? interrupted : operation(controller.signal),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Request-scoped connection. Its owner must close it; cancellation also releases the transport. */
export async function openMcpSession(
  mcp: ResolvedMcpConnection,
  options: McpOperationOptions = {},
): Promise<McpSession> {
  if (options.signal?.aborted)
    throw new McpAdapterError('MCP_INTERRUPTED', 'The MCP operation was interrupted.');
  const transport = createTransportForMcpServer(mcp);
  const client = new Client(CLIENT_INFO);
  const requestMs = getRequestTimeoutMs();
  let closed = false;
  let closePromise: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closed = true;
    options.signal?.removeEventListener('abort', onAbort);
    closePromise ??= transport.close().catch(() => {});
    return closePromise;
  };
  const onAbort = () => {
    void close();
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });
  client.onclose = () => {
    closed = true;
  };

  try {
    await bounded(
      (signal) => client.connect(transport, { timeout: getConnectTimeoutMs(), signal }),
      getConnectTimeoutMs(),
      options.signal,
    );
    if (closed || options.signal?.aborted)
      throw new McpAdapterError('MCP_INTERRUPTED', 'The MCP operation was interrupted.');
  } catch (error) {
    await close();
    throw safeMcpFailure(error, 'connect');
  }

  return {
    async listContractTools(callOptions = {}) {
      try {
        if (closed) throw new McpAdapterError('DISCOVERY_FAILED', 'The MCP connection is closed.');
        const result = await bounded(
          (signal) => client.listTools({}, { timeout: requestMs, signal }),
          requestMs,
          combinedSignal(options.signal, callOptions.signal),
        );
        if (result.nextCursor)
          throw new McpAdapterError(
            'CATALOG_UNSUPPORTED',
            'This server uses a paginated tool catalog. Select a smaller server catalog for this MVP.',
          );
        return result.tools.map((tool) => mcpToolToContractTool(mcp.id, tool));
      } catch (error) {
        await close();
        throw safeMcpFailure(error, 'discovery');
      }
    },
    async callToolAsOutput(name, args, callOptions = {}) {
      const signal = combinedSignal(options.signal, callOptions.signal);
      if (closed || signal?.aborted)
        return {
          output: {
            type: 'error',
            code: 'MCP_CALL_NOT_STARTED',
            message:
              'The MCP call was not started because the connection is closed or the request was cancelled.',
          },
          images: [],
        };
      try {
        const timeout = callOptions.timeoutMs ?? requestMs;
        const result = await bounded(
          (callSignal) =>
            client.callTool({ name, arguments: rewriteFileArgs(args) }, undefined, {
              timeout,
              signal: callSignal,
            }),
          timeout,
          signal,
        );
        return callToolResultToOutputs(mcp.id, name, result);
      } catch {
        await close();
        return {
          output: {
            type: 'error',
            code: 'MCP_OUTCOME_UNKNOWN',
            message:
              'The MCP call may have taken effect, but its result could not be confirmed. Inspect the server before starting a new request. This turn will not retry the action.',
          },
          images: [],
        };
      }
    },
    close,
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
