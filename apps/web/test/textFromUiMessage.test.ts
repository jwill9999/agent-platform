import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';

import { textFromUiMessage } from '../lib/textFromUiMessage.js';

describe('textFromUiMessage', () => {
  it('concatenates text parts', () => {
    const msg = {
      id: '1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
    } as UIMessage;
    expect(textFromUiMessage(msg)).toBe('Hello world');
  });

  it('returns empty string when there are no text parts', () => {
    const msg = { id: '1', role: 'user', parts: [] } as unknown as UIMessage;
    expect(textFromUiMessage(msg)).toBe('');
  });
});
