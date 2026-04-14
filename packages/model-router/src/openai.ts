import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

/**
 * OpenAI-backed streaming text via Vercel AI SDK (`streamText`).
 * API key must come from env / secret store at the call site — never log it.
 */
export function streamOpenAiChat(options: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}) {
  const provider = createOpenAI({ apiKey: options.apiKey });
  return streamText({
    model: provider(options.model),
    messages: options.messages,
  });
}
