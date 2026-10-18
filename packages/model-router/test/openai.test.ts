import { describe, expect, it, vi } from 'vitest';
import { streamOpenAiChat } from '../src/openai.js';
const streamMock = vi.hoisted(() => vi.fn(() => ({ fullStream: new ReadableStream() })));
vi.mock('ai', () => ({ streamText: streamMock }));
describe('streamOpenAiChat', () => {
  it('uses the shared Responses configuration without sending a live request or logging keys', () => {
    const spy = vi.spyOn(console, 'log');
    const result = streamOpenAiChat({
      apiKey: 'sk-secret-do-not-print',
      model: 'gpt-6.1-sol',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.textStream).toBeDefined();
    expect(streamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 0,
        providerOptions: { openai: { store: false, include: ['reasoning.encrypted_content'] } },
      }),
    );
    expect(spy.mock.calls.flat().join(' ')).not.toContain('sk-secret');
    spy.mockRestore();
  });
});
