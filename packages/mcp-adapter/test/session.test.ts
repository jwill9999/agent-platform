import { describe, expect, it, vi } from 'vitest';
import { listContractToolsFromClient } from '../src/session.js';

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
