/** Structured adapter failure (not MCP protocol errors — those surface via {@link callToolToOutput}). */
export class McpAdapterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'McpAdapterError';
  }
}
