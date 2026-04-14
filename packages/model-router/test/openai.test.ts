import { describe, expect, it, vi } from 'vitest';
import { streamOpenAiChat } from '../src/openai.js';

describe('streamOpenAiChat', () => {
  it('returns a stream result without logging the api key', () => {
    const spy = vi.spyOn(console, 'log');
    const result = streamOpenAiChat({
      apiKey: 'sk-secret-do-not-print',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.textStream).toBeDefined();
    const logText = spy.mock.calls.flat().join(' ');
    expect(logText).not.toContain('sk-secret');
    spy.mockRestore();
  });
});
