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
          const raw = await res.text();
          try {
            const j = JSON.parse(raw) as { error?: { message?: string } };
            if (j.error?.message) msg = j.error.message;
          } catch {
            if (raw.trim()) msg = raw.slice(0, 500);
          }
          throw new Error(msg);
        }

        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        const appendAssistantText = (chunk: string) => {
          if (!chunk) return;
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? uiMessage(assistantId, 'assistant', accumulated) : m,
            ),
          );
        };

        const formatToolResultPreview = (data: unknown, maxLen = 6000): string => {
          if (typeof data === 'string')
            return data.length > maxLen ? `${data.slice(0, maxLen)}…` : data;
          try {
            const s = JSON.stringify(data, null, 2);
            return s.length > maxLen ? `${s.slice(0, maxLen)}\n… (truncated)` : s;
          } catch {
            return String(data);
          }
        };

        const applyLine = (line: string) => {
          if (!line.trim()) return;
          let ev: unknown;
          try {
            ev = JSON.parse(line);
          } catch {
            return;
          }
          if (typeof ev !== 'object' || ev === null || !('type' in ev)) return;
          const o = ev as {
            type: string;
            /** NDJSON text delta (harness contract). */
            content?: string;
            /** Alternate key some streams use for the same payload. */
            text?: string;
            message?: string;
            reason?: string;
            toolId?: string;
            data?: unknown;
            language?: string;
            code?: string;
            mimeType?: string;
          };
          if (o.type === 'text') {
            const delta =
              typeof o.content === 'string' ? o.content : typeof o.text === 'string' ? o.text : '';
            appendAssistantText(delta);
          } else if (o.type === 'thinking' && typeof o.content === 'string') {
            appendAssistantText(o.content);
          } else if (o.type === 'code' && typeof o.content === 'string') {
            const lang = typeof o.language === 'string' && o.language ? o.language : '';
            appendAssistantText(`\n\`\`\`${lang}\n${o.content}\n\`\`\`\n`);
          } else if (
            o.type === 'image' &&
            typeof o.data === 'string' &&
            typeof o.mimeType === 'string'
          ) {
            appendAssistantText(`\n\n![screenshot](data:${o.mimeType};base64,${o.data})\n\n`);
          } else if (o.type === 'tool_result' && typeof o.toolId === 'string') {
            const body = formatToolResultPreview(o.data);
            appendAssistantText(`\n\n**${o.toolId}**\n\`\`\`json\n${body}\n\`\`\`\n`);
          } else if (o.type === 'error' && typeof o.message === 'string') {
            const code = o.code;
            const inlineToolish =
              typeof code === 'string' &&
              (code.startsWith('TOOL_') || code.startsWith('MCP_') || code.startsWith('NATIVE_'));
            if (inlineToolish) {
              appendAssistantText(`\n\n[${code}] ${o.message}\n`);
            } else {
              setError(o.message);
            }
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
