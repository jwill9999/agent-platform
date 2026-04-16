import { describe, expect, it } from 'vitest';
import { mcpToolToContractTool } from '../src/mapTools.js';

describe('mcpToolToContractTool', () => {
  it('namespaces id and preserves MCP metadata in config', () => {
    const t = mcpToolToContractTool('srv-1', {
      name: 'echo',
      description: 'Echo input',
      inputSchema: { type: 'object' },
    });
    expect(t.id).toBe('srv-1:echo');
    expect(t.slug).toBe('srv-1--echo');
    expect(t.name).toBe('echo');
    expect(t.description).toBe('Echo input');
    expect(t.config).toEqual({
      mcpServerId: 'srv-1',
      mcpToolName: 'echo',
      inputSchema: { type: 'object' },
    });
  });
});
