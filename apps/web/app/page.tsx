'use client';

import { useChat } from '@ai-sdk/react';
import { useCallback } from 'react';
import { Chat } from '../components/chat/chat';

const defaultModel = 'gpt-4o-mini';

export default function HomePage() {
  const { messages, append, status, error } = useChat({
    api: '/api/chat',
    body: { model: defaultModel },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const handleSend = useCallback(
    (text: string) => {
      append({ role: 'user', content: text });
    },
    [append],
  );

  return (
    <>
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg text-sm max-w-md">
          {formatChatError(error)}
        </div>
      )}
      <Chat messages={messages} onSend={handleSend} isLoading={isLoading} />
    </>
  );
}

function formatChatError(error: unknown): string {
  const fallback = 'Request failed';
  if (typeof error === 'string') return error || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}
