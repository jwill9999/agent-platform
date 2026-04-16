import { describe, it, expect } from 'vitest';
import { buildWindowedContext } from '../src/contextBuilder.js';
import { createApproximateCounter } from '../src/tokenCount.js';
import type { ChatMessage } from '../src/types.js';
import type { ContextWindow } from '@agent-platform/contracts';

const counter = createApproximateCounter();

function makeMsg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { role, content };
}

describe('buildWindowedContext', () => {
  const defaultConfig: ContextWindow = { maxInputTokens: 8000, strategy: 'truncate' };

  it('returns system + user with empty history', () => {
    const result = buildWindowedContext(
      'Be helpful.',
      [],
      makeMsg('user', 'Hi'),
      defaultConfig,
      counter,
    );
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual({ role: 'system', content: 'Be helpful.' });
    expect(result.messages[1]).toEqual({ role: 'user', content: 'Hi' });
    expect(result.dropped).toBe(0);
    expect(result.contextTokens).toBeGreaterThan(0);
  });

  it('includes all history when budget is large', () => {
    const history = [makeMsg('user', 'one'), makeMsg('assistant', 'two'), makeMsg('user', 'three')];
    const result = buildWindowedContext(
      'System',
      history,
      makeMsg('user', 'four'),
      defaultConfig,
      counter,
    );
    // system + 3 history + new user = 5
    expect(result.messages).toHaveLength(5);
    expect(result.dropped).toBe(0);
  });

  it('drops oldest messages when budget is tight', () => {
    // Create a very tight budget
    const tightConfig: ContextWindow = { maxInputTokens: 50, strategy: 'truncate' };
    const history: ChatMessage[] = [];
    for (let i = 0; i < 20; i++) {
      history.push(makeMsg('user', `Message number ${i} with some extra padding text`));
    }

    const result = buildWindowedContext(
      'System.',
      history,
      makeMsg('user', 'latest'),
      tightConfig,
      counter,
    );
    expect(result.dropped).toBeGreaterThan(0);
    // First message is always system, last is always the new user message
    expect(result.messages[0]?.role).toBe('system');
    expect(result.messages[result.messages.length - 1]?.content).toBe('latest');
  });

  it('always includes system + new user even if they exceed budget', () => {
    const tinyConfig: ContextWindow = { maxInputTokens: 1, strategy: 'truncate' };
    const history = [makeMsg('user', 'old'), makeMsg('assistant', 'reply')];

    const result = buildWindowedContext(
      'Very long system prompt',
      history,
      makeMsg('user', 'new'),
      tinyConfig,
      counter,
    );
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.role).toBe('system');
    expect(result.messages[1]?.role).toBe('user');
    expect(result.dropped).toBe(2);
  });

  it('keeps messages in chronological order', () => {
    const config: ContextWindow = { maxInputTokens: 200, strategy: 'truncate' };
    const history = [
      makeMsg('user', 'first'),
      makeMsg('assistant', 'second'),
      makeMsg('user', 'third'),
      makeMsg('assistant', 'fourth'),
    ];

    const result = buildWindowedContext('S', history, makeMsg('user', 'fifth'), config, counter);
    const contents = result.messages.map((m) => m.content);
    // Should be chronological: system, then some history (oldest to newest), then new user
    expect(contents[0]).toBe('S');
    expect(contents[contents.length - 1]).toBe('fifth');

    // History portion should be in order
    const historyContents = contents.slice(1, -1);
    const originalOrder = ['first', 'second', 'third', 'fourth'];
    for (let i = 1; i < historyContents.length; i++) {
      const prevIdx = originalOrder.indexOf(historyContents[i - 1]!);
      const currIdx = originalOrder.indexOf(historyContents[i]!);
      expect(currIdx).toBeGreaterThan(prevIdx);
    }
  });

  it('contextTokens matches recounted messages', () => {
    const history = [makeMsg('user', 'one'), makeMsg('assistant', 'two')];
    const result = buildWindowedContext(
      'Sys',
      history,
      makeMsg('user', 'new'),
      defaultConfig,
      counter,
    );
    const recounted = counter.countMessages(result.messages);
    expect(result.contextTokens).toBe(recounted);
  });
});
