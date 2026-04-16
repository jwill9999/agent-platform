import type { ContextWindow } from '@agent-platform/contracts';
import type { ChatMessage } from './types.js';
import type { TokenCounter } from './tokenCount.js';

// ---------------------------------------------------------------------------
// Context window result
// ---------------------------------------------------------------------------

export interface ContextWindowResult {
  /** Messages to send to the LLM (chronological order). */
  messages: ChatMessage[];
  /** Number of history messages dropped to fit within budget. */
  dropped: number;
  /** Estimated token count of the returned messages. */
  contextTokens: number;
}

// ---------------------------------------------------------------------------
// Windowed context builder
// ---------------------------------------------------------------------------

/**
 * Builds a context window that fits within the token budget.
 *
 * Algorithm:
 * 1. Always include: system prompt + new user message (required)
 * 2. Fill remaining budget with most recent history messages (newest first)
 * 3. Return messages in chronological order
 *
 * @param systemPrompt - The agent's system prompt
 * @param history - Prior messages (oldest first, as returned by DB)
 * @param newMessage - The new user message to append
 * @param config - Context window configuration (budget + strategy)
 * @param counter - Token counter implementation
 */
export function buildWindowedContext(
  systemPrompt: string,
  history: ChatMessage[],
  newMessage: ChatMessage,
  config: ContextWindow,
  counter: TokenCounter,
): ContextWindowResult {
  const systemMsg: ChatMessage = { role: 'system', content: systemPrompt };
  const requiredTokens = counter.countMessages([systemMsg, newMessage]);
  const budget = config.maxInputTokens;

  // If required messages alone exceed budget, return only them
  if (requiredTokens >= budget) {
    return {
      messages: [systemMsg, newMessage],
      dropped: history.length,
      contextTokens: requiredTokens,
    };
  }

  let remainingBudget = budget - requiredTokens;
  const included: ChatMessage[] = [];

  // Walk history from newest to oldest, adding messages while they fit
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]!;
    const msgTokens = counter.countMessages([msg]);
    if (msgTokens > remainingBudget) break;
    included.unshift(msg);
    remainingBudget -= msgTokens;
  }

  const dropped = history.length - included.length;
  const messages: ChatMessage[] = [systemMsg, ...included, newMessage];
  const contextTokens = counter.countMessages(messages);

  return { messages, dropped, contextTokens };
}
