import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';

import { uiMessageToOutputs } from '../lib/uiMessageToOutputs';

describe('uiMessageToOutputs', () => {
  it('maps reasoning to thinking output', () => {
    const msg = {
      id: '1',
      role: 'assistant',
      parts: [
        {
          type: 'reasoning',
          reasoning: 'step one',
          details: [{ type: 'text', text: '' }],
        },
      ],
    } as unknown as UIMessage;
    expect(uiMessageToOutputs(msg)).toEqual([{ type: 'thinking', content: 'step one' }]);
  });

  it('falls back to legacy content when parts is empty', () => {
    const msg = {
      id: '1',
      role: 'user',
      parts: [],
      content: 'Hello world',
    } as unknown as UIMessage;
    expect(uiMessageToOutputs(msg)).toEqual([{ type: 'text', content: 'Hello world' }]);
  });

  it('maps tool result to tool_result output', () => {
    const msg = {
      id: '1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'c1',
            toolName: 'myTool',
            args: {},
            result: { ok: true },
          },
        },
      ],
    } as unknown as UIMessage;
    expect(uiMessageToOutputs(msg)).toEqual([
      { type: 'tool_result', toolId: 'myTool', data: { ok: true } },
    ]);
  });
});
