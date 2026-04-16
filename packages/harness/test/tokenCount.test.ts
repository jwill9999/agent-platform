import { describe, it, expect } from 'vitest';
import { createApproximateCounter } from '../src/tokenCount.js';
import type { ChatMessage } from '../src/types.js';

describe('createApproximateCounter', () => {
  const counter = createApproximateCounter();

  describe('count()', () => {
    it('returns 0 for empty string', () => {
      expect(counter.count('')).toBe(0);
    });

    it('estimates ~4 chars per token', () => {
      // 20 chars / 4 = 5 tokens
      expect(counter.count('abcdefghijklmnopqrst')).toBe(5);
    });

    it('rounds up partial tokens', () => {
      // 5 chars / 4 = 1.25 → ceil = 2
      expect(counter.count('hello')).toBe(2);
    });

    it('handles single character', () => {
      // 1 char / 4 = 0.25 → ceil = 1
      expect(counter.count('a')).toBe(1);
    });
  });

  describe('countMessages()', () => {
    it('returns 0 for empty array', () => {
      expect(counter.countMessages([])).toBe(0);
    });

    it('adds per-message overhead of 4 tokens', () => {
      const msgs: ChatMessage[] = [{ role: 'user', content: '' }];
      // 4 overhead + 0 content = 4
      expect(counter.countMessages(msgs)).toBe(4);
    });

    it('counts content tokens for user messages', () => {
      const msgs: ChatMessage[] = [{ role: 'user', content: 'Hello world!' }];
      // 4 overhead + ceil(12/4) = 4 + 3 = 7
      expect(counter.countMessages(msgs)).toBe(7);
    });

    it('counts multiple messages', () => {
      const msgs: ChatMessage[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ];
      // msg1: 4 + ceil(16/4) = 4 + 4 = 8
      // msg2: 4 + ceil(2/4) = 4 + 1 = 5
      expect(counter.countMessages(msgs)).toBe(13);
    });

    it('counts tool calls in assistant messages', () => {
      const msgs: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'OK',
          toolCalls: [{ id: 'tc1', name: 'search', args: { query: 'test' } }],
        },
      ];
      // 4 overhead + ceil(2/4) content + ceil(16/4) args + ceil(6/4) name
      // = 4 + 1 + 4 + 2 = 11
      const argsStr = JSON.stringify({ query: 'test' }); // '{"query":"test"}'
      const expected = 4 + Math.ceil(2 / 4) + Math.ceil(argsStr.length / 4) + Math.ceil(6 / 4);
      expect(counter.countMessages(msgs)).toBe(expected);
    });

    it('ignores toolCalls on non-assistant messages', () => {
      const msgs: ChatMessage[] = [{ role: 'user', content: 'test' }];
      // 4 + ceil(4/4) = 4 + 1 = 5
      expect(counter.countMessages(msgs)).toBe(5);
    });
  });
});
