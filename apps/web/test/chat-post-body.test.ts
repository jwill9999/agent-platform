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

  it('rejects { sessionId, message } (use { messages } from useChat instead)', () => {
    const r = parseChatPostBody({
      sessionId: 'c2427cc8-8043-4336-b5f1-0b6998c2ca48',
      message: 'test',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('messages');
    }
  });

  it('rejects unknown shapes', () => {
    const r = parseChatPostBody({ foo: 1 });
    expect(r.ok).toBe(false);
  });
});
