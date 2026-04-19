import { describe, expect, it, vi } from 'vitest';
import { listContractToolsFromClient, rewriteFileArgs } from '../src/session.js';

describe('listContractToolsFromClient', () => {
  it('maps listTools through contract mapper (no real MCP)', async () => {
    const client = {
      listTools: vi.fn().mockResolvedValue({
        tools: [
          { name: 'a', description: 'A' },
          { name: 'b', inputSchema: { type: 'object' } },
        ],
      }),
    };
    const tools = await listContractToolsFromClient(client as never, 'server-x', 5000);
    expect(tools).toHaveLength(2);
    expect(tools[0]?.id).toBe('server-x:a');
    expect(tools[1]?.id).toBe('server-x:b');
    expect(client.listTools).toHaveBeenCalledWith({}, { timeout: 5000 });
  });
});

describe('rewriteFileArgs', () => {
  it('rewrites /app/ paths to writable dir', () => {
    const result = rewriteFileArgs({ filename: '/app/screenshot.png', type: 'png' });
    expect(result.filename).toBe('/tmp/playwright-mcp/screenshot.png');
    expect(result.type).toBe('png');
  });

  it('does not rewrite paths outside /app/', () => {
    const result = rewriteFileArgs({ filename: '/tmp/output.png' });
    expect(result.filename).toBe('/tmp/output.png');
  });

  it('does not touch non-file-path keys', () => {
    const result = rewriteFileArgs({ url: '/app/index.html', filename: '/app/shot.png' });
    expect(result.url).toBe('/app/index.html');
    expect(result.filename).toBe('/tmp/playwright-mcp/shot.png');
  });

  it('handles missing filename gracefully', () => {
    const result = rewriteFileArgs({ text: 'hello' });
    expect(result).toEqual({ text: 'hello' });
  });
});
