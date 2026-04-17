import { describe, expect, it } from 'vitest';

import { parseChatPostBody } from '../lib/chat-post-body';

describe('parseChatPostBody', () => {
  it('accepts useChat-style { messages }', () => {
    const body = { messages: [{ role: 'user', content: 'hi' }] };
    const r = parseChatPostBody(body);
    expect(r).toEqual({
      ok: true,
      value: { messages: body.messages, model: undefined, context: undefined },
    });
  });

  it('accepts legacy { sessionId, message } and maps to a user message', () => {
    const r = parseChatPostBody({
      sessionId: 'c2427cc8-8043-4336-b5f1-0b6998c2ca48',
      message: 'test',
    });
    expect(r).toEqual({
      ok: true,
      value: {
        messages: [{ role: 'user', content: 'test' }],
        model: undefined,
        context: undefined,
      },
    });
  });

  it('rejects empty message in legacy shape', () => {
    const r = parseChatPostBody({ message: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('expected');
    }
  });

  it('rejects unknown shapes', () => {
    const r = parseChatPostBody({ foo: 1 });
    expect(r.ok).toBe(false);
  });
});
