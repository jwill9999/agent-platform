import { describe, expect, it } from 'vitest';
import { parseToolId } from '../src/toolId.js';

describe('parseToolId', () => {
  it('treats ids without colon as plain', () => {
    expect(parseToolId('echo')).toEqual({ kind: 'plain', toolId: 'echo' });
  });

  it('splits first colon into MCP server + tool name', () => {
    expect(parseToolId('srv1:echo')).toEqual({
      kind: 'mcp',
      mcpServerId: 'srv1',
      mcpToolName: 'echo',
    });
  });

  it('treats trailing-only colon as plain', () => {
    expect(parseToolId('bad:')).toEqual({ kind: 'plain', toolId: 'bad:' });
  });
});
