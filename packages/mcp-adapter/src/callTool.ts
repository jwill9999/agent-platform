import type { Output } from '@agent-platform/contracts';

type ImageBlock = { type: 'image'; data: string; mimeType: string };

/** Normalize MCP `tools/call` content blocks to a single payload for `tool_result.data`. */
export function summarizeToolContent(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  const texts: string[] = [];
  let hasImages = false;
  for (const block of content) {
    if (typeof block === 'object' && block !== null && 'type' in block) {
      const b = block as { type?: string; text?: string; data?: string; mimeType?: string };
      if (b.type === 'text' && typeof b.text === 'string') {
        texts.push(b.text);
      } else if (b.type === 'image' && typeof b.data === 'string') {
        hasImages = true;
        const mime = typeof b.mimeType === 'string' ? b.mimeType : 'image/png';
        const sizeKb = Math.round((b.data.length * 3) / 4 / 1024);
        texts.push(
          `[Screenshot captured and displayed inline to the user: ${mime}, ~${sizeKb}KB. Do not reference any file paths for this image.]`,
        );
      }
    }
  }
  // Always strip text blocks that are MCP tool local file paths
  // (e.g. MCP Playwright saves snapshots to /.playwright-mcp/page-xxx.yml).
  if (texts.length > 0) {
    const filtered = texts.filter((t) => !isMcpLocalPath(t));
    if (filtered.length > 0) return filtered.join('\n');
    // If all text was file paths and we have images, still return the image placeholders
    if (hasImages) return texts.filter((t) => t.startsWith('[')).join('\n') || texts.join('\n');
  }
  if (texts.length > 0) return texts.join('\n');
  return content;
}

/** Detect MCP tool local file paths that the user can't access (e.g. .playwright-mcp/). */
function isMcpLocalPath(text: string): boolean {
  const trimmed = text.trim();
  // Match paths like /.playwright-mcp/page-xxx.yml, /tmp/playwright-mcp/file.yml,
  // or markdown links containing them: [Snapshot](../tmp/playwright-mcp/page-xxx.yml)
  if (/[./]playwright-mcp\//.test(trimmed)) return true;
  // Generic: a standalone line that's just a file path (no spaces, starts with / or .)
  return /^\/?\.[\w.-]+\/[\w./-]+\.\w+$/.test(trimmed);
}

/** Extract image content blocks as Output events for the stream. */
export function extractImageOutputs(toolId: string, content: unknown): Output[] {
  if (!Array.isArray(content)) return [];
  const images: Output[] = [];
  for (const block of content) {
    if (typeof block === 'object' && block !== null && 'type' in block) {
      const b = block as Partial<ImageBlock & { type: string }>;
      if (b.type === 'image' && typeof b.data === 'string') {
        images.push({
          type: 'image',
          toolId,
          mimeType: typeof b.mimeType === 'string' ? b.mimeType : 'image/png',
          data: b.data,
        });
      }
    }
  }
  return images;
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

/**
 * Like {@link callToolResultToOutput} but also extracts image outputs for streaming.
 * Returns the primary output (tool_result/error) plus any image outputs found in content.
 */
export function callToolResultToOutputs(
  mcpServerId: string,
  mcpToolName: string,
  result: unknown,
): { output: Output; images: Output[] } {
  const r = result as CallToolResultLike;
  const toolId = `${mcpServerId}:${mcpToolName}`;
  if (r.isError) {
    return { output: callToolResultToOutput(mcpServerId, mcpToolName, result), images: [] };
  }
  const images = extractImageOutputs(toolId, r.content);
  const data = r.structuredContent ?? summarizeToolContent(r.content);
  return { output: { type: 'tool_result', toolId, data }, images };
}
