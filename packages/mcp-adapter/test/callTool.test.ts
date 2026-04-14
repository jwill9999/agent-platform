import { describe, expect, it } from 'vitest';
import { callToolResultToOutput } from '../src/callTool.js';

describe('callToolResultToOutput', () => {
  it('maps success to tool_result', () => {
    const o = callToolResultToOutput('srv', 'add', {
      structuredContent: { sum: 3 },
    });
    expect(o).toEqual({ type: 'tool_result', toolId: 'srv:add', data: { sum: 3 } });
  });

  it('maps isError to error output', () => {
    const o = callToolResultToOutput('srv', 'bad', {
      isError: true,
      content: [{ type: 'text', text: 'nope' }],
    });
    expect(o).toEqual({ type: 'error', code: 'MCP_TOOL_ERROR', message: 'nope' });
  });
});
