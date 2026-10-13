/** Safe adapter failure. Never retain server-controlled exception causes or bodies. */
export class McpAdapterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'McpAdapterError';
  }
}

export type McpFailureStage = 'connect' | 'discovery';

/** Classify using bounded status metadata only; arbitrary exception text is discarded. */
export function safeMcpFailure(error: unknown, stage: McpFailureStage): McpAdapterError {
  if (error instanceof McpAdapterError) return error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === 401 || code === 403) {
    return new McpAdapterError(
      'AUTHENTICATION_FAILED',
      'Check the configured MCP credentials. Interactive sign-in is not supported.',
    );
  }
  if (code === 'ENOENT') {
    return new McpAdapterError(
      'MISSING_EXECUTABLE',
      'The MCP executable was not found on the API execution host. Install it there or correct the executable path.',
    );
  }
  if (code === -32001)
    return new McpAdapterError(
      'MCP_TIMEOUT',
      'The MCP request timed out. Check the server before trying again.',
    );
  return new McpAdapterError(
    stage === 'connect' ? 'CONNECT_FAILED' : 'DISCOVERY_FAILED',
    stage === 'connect'
      ? 'MCP connection failed. Check the executable or Streamable HTTP endpoint and server availability.'
      : 'MCP tool discovery failed. Check server compatibility and availability.',
  );
}
