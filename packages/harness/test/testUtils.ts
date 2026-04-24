import { vi } from 'vitest';

import type { GraphNodeFn } from '../src/index.js';
import type { ChatMessage, LlmOutput, OutputEmitter } from '../src/types.js';

export function captureEmitter(): {
  emitter: OutputEmitter;
  events: Array<Record<string, unknown>>;
} {
  const events: Array<Record<string, unknown>> = [];
  return {
    events,
    emitter: {
      emit: async (event) => {
        events.push(event as unknown as Record<string, unknown>);
      },
      end: () => {},
    },
  };
}

export function createIncrementingTextNode(prefix = 'draft'): {
  llmNode: GraphNodeFn;
  getCallCount: () => number;
} {
  let callCount = 0;
  const llmNode: GraphNodeFn = vi.fn(async () => {
    callCount++;
    const content = `${prefix} ${callCount}`;
    return {
      llmOutput: { kind: 'text', content } as LlmOutput,
      messages: [{ role: 'assistant', content }] as ChatMessage[],
    };
  });

  return {
    llmNode,
    getCallCount: () => callCount,
  };
}
