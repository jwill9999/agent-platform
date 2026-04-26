'use client';

import type { UIMessage } from 'ai';

import { Message } from '@/components/chat/message';
import type { CriticEvent } from '@/lib/critic-events';

const userMessage = {
  id: 'u-1',
  role: 'user',
  content: 'User message bubble should remain visible.',
  parts: [{ type: 'text', text: 'User message bubble should remain visible.' }],
} as unknown as UIMessage;

const assistantMessage = {
  id: 'a-1',
  role: 'assistant',
  content:
    'A **coding class** is a course where people learn how to write computer programs (coding).\n\n- **Programming basics**\n- **A coding language**\n- **Problem-solving**\n- **Tools**',
  parts: [
    {
      type: 'text',
      text: 'A **coding class** is a course where people learn how to write computer programs (coding).\n\n- **Programming basics**\n- **A coding language**\n- **Problem-solving**\n- **Tools**',
    },
  ],
} as unknown as UIMessage;

const assistantCriticEvents: CriticEvent[] = [
  {
    kind: 'accept',
    iteration: 1,
    reasons: 'Response accepted by critic. Showing feedback block only.',
  },
];

export default function FeedbackOnlyE2ePage() {
  return (
    <main className="p-6">
      <h1 className="text-lg font-semibold mb-4">E2E feedback-only verify</h1>
      <div className="max-w-3xl">
        <Message message={userMessage} />
        <Message
          message={assistantMessage}
          thinking="Placement thinking trace."
          isAwaitingStreamContent
          criticEvents={assistantCriticEvents}
        />
      </div>
    </main>
  );
}
