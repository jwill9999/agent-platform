'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UIMessage } from 'ai';

function makeTextParts(text: string): NonNullable<UIMessage['parts']> {
  return [{ type: 'text', text }];
}

function uiMessage(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id,
    role,
    content: text,
    parts: makeTextParts(text),
  };
}

/**
 * Chat against the platform harness via `POST /api/chat` → `POST /v1/chat`
 * (NDJSON stream). Resets messages when `sessionId` changes.
 */
export function useHarnessChat(sessionId: string | null) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<'ready' | 'streaming'>('ready');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [sessionId]);

  const sendMessage = useCallback(
    async (messageForApi: string, displayText?: string) => {
      const trimmed = messageForApi.trim();
      if (!sessionId || !trimmed) return;

      const userVisible = displayText ?? trimmed;
      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();

      const userMsg = uiMessage(userId, 'user', userVisible);

      setMessages((prev) => [...prev, userMsg, uiMessage(assistantId, 'assistant', '')]);
      setStatus('streaming');
      setError(null);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: trimmed }),
        });

        if (!res.ok) {
          let msg = `Chat failed (${res.status})`;
          try {
            const j = (await res.json()) as { error?: { message?: string } };
            if (j.error?.message) msg = j.error.message;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        const applyLine = (line: string) => {
          if (!line.trim()) return;
          let ev: unknown;
          try {
            ev = JSON.parse(line);
          } catch {
            return;
          }
          if (typeof ev !== 'object' || ev === null || !('type' in ev)) return;
          const o = ev as { type: string; content?: string; message?: string; reason?: string };
          if (o.type === 'text' && typeof o.content === 'string') {
            accumulated += o.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? uiMessage(assistantId, 'assistant', accumulated) : m,
              ),
            );
          } else if (o.type === 'error' && typeof o.message === 'string') {
            setError(o.message);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            applyLine(line);
          }
        }
        if (buffer.trim()) {
          applyLine(buffer);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setStatus('ready');
      }
    },
    [sessionId],
  );

  return { messages, sendMessage, status, error, setError };
}
