import type { ChatMessage } from './types.js';

// ---------------------------------------------------------------------------
// Token counter interface
// ---------------------------------------------------------------------------

export interface TokenCounter {
  /** Estimate token count for a text string. */
  count(text: string): number;
  /** Estimate token count for an array of chat messages. */
  countMessages(messages: ChatMessage[]): number;
}

// ---------------------------------------------------------------------------
// Approximate counter (~4 chars per token, plus per-message overhead)
// ---------------------------------------------------------------------------

const CHARS_PER_TOKEN = 4;
const OVERHEAD_PER_MESSAGE = 4;

/**
 * Creates an approximate token counter using character-based estimation.
 * Suitable for budget enforcement where exact counts aren't critical.
 * Accuracy: within ~10-20% of tiktoken for English text.
 */
export function createApproximateCounter(): TokenCounter {
  return {
    count(text: string): number {
      return Math.ceil(text.length / CHARS_PER_TOKEN);
    },
    countMessages(messages: ChatMessage[]): number {
      let total = 0;
      for (const msg of messages) {
        total += OVERHEAD_PER_MESSAGE;
        total += Math.ceil(msg.content.length / CHARS_PER_TOKEN);
        if (msg.role === 'assistant' && msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            total += Math.ceil(JSON.stringify(tc.args).length / CHARS_PER_TOKEN);
            total += Math.ceil(tc.name.length / CHARS_PER_TOKEN);
          }
        }
      }
      return total;
    },
  };
}
