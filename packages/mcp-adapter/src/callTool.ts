import type { Output } from '@agent-platform/contracts';

/** Normalize MCP `tools/call` content blocks to a single payload for `tool_result.data`. */
export function summarizeToolContent(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  const texts: string[] = [];
  for (const block of content) {
    if (typeof block === 'object' && block !== null && 'type' in block) {
      const b = block as { type?: string; text?: string };
      if (b.type === 'text' && typeof b.text === 'string') {
        texts.push(b.text);
      }
    }
  }
  if (texts.length > 0) return texts.join('\n');
  return content;
}

type CallToolResultLike = {
  isError?: boolean;
  content?: unknown;
  structuredContent?: unknown;
};

/**
 * Map MCP `tools/call` result to the contracts `Output` union (`tool_result` or `error`).
 * Safe for harness: never throws; surfaces MCP errors as `type: error`.
 */
export function callToolResultToOutput(
  mcpServerId: string,
  mcpToolName: string,
  result: unknown,
): Output {
  const r = result as CallToolResultLike;
  const toolId = `${mcpServerId}:${mcpToolName}`;
  if (r.isError) {
    const summarized = summarizeToolContent(r.content);
    const msg = typeof summarized === 'string' ? summarized : 'MCP tool returned isError';
    return { type: 'error', code: 'MCP_TOOL_ERROR', message: msg };
  }
  const data = r.structuredContent ?? summarizeToolContent(r.content);
  return { type: 'tool_result', toolId, data };
}
