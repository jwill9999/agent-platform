import { streamChat } from './streamChat.js';
export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
export function streamOpenAiChat(options: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}): ReturnType<typeof streamChat> {
  return streamChat({ ...options, provider: 'openai' });
}
