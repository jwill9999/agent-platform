'use client';

import { useChat } from '@ai-sdk/react';

import { OutputRenderer } from '../components/OutputRenderer';
import { uiMessageToOutputs } from '../lib/uiMessageToOutputs';
import { useShowThinkingSetting } from '../lib/useShowThinkingSetting';

const defaultModel = 'gpt-4o-mini';

export default function HomePage() {
  const [showThinking, setShowThinking] = useShowThinkingSetting();
  const { messages, input, handleInputChange, handleSubmit, status, error } = useChat({
    api: '/api/chat',
    body: { model: defaultModel },
  });
  const errorMessage = formatChatError(error);

  const busy = status === 'streaming' || status === 'submitted';

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Chat</h1>
      <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.75rem' }}>
        Uses the same OpenAI streaming stack as the API (<code>/v1/chat/stream</code>). Set{' '}
        <code>NEXT_OPENAI_API_KEY</code> for this Next.js server (see{' '}
        <code>apps/web/.env.example</code>).
      </p>

      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.875rem',
          marginBottom: '1rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={showThinking}
          onChange={(e) => setShowThinking(e.target.checked)}
        />{' '}
        Show thinking (stored in this browser)
      </label>

      {error ? (
        <OutputRenderer
          showThinking={showThinking}
          output={{ type: 'error', message: errorMessage }}
        />
      ) : null}

      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          minHeight: '12rem',
          background: '#fff',
          marginBottom: '1rem',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: '#64748b', margin: 0 }}>Send a message to start.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {messages.map((m) => (
              <li key={m.id} style={{ marginBottom: '1rem' }}>
                <div style={{ marginBottom: '0.35rem' }}>
                  <strong>{m.role}:</strong>
                </div>
                <div>
                  {uiMessageToOutputs(m).map((o, i) => (
                    <OutputRenderer key={`${m.id}-${i}`} output={o} showThinking={showThinking} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          name="prompt"
          value={input}
          onChange={handleInputChange}
          rows={3}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            marginBottom: '0.5rem',
          }}
          placeholder="Message…"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            background: '#0f172a',
            color: '#fff',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}

function formatChatError(error: unknown): string {
  const fallback = 'Request failed';
  if (typeof error === 'string') {
    return error || fallback;
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message || fallback;
  }
  if (!(error instanceof Error)) {
    return fallback;
  }

  // ai-sdk wraps API error metadata in `cause` where available.
  const cause = error.cause as
    | {
        statusCode?: number;
        body?: unknown;
      }
    | undefined;

  const statusPart = cause?.statusCode ? `HTTP ${cause.statusCode}` : '';
  const bodyMessage = extractErrorMessage(cause?.body);
  const baseMessage =
    bodyMessage ||
    (error.message && error.message !== 'An error occurred.' ? error.message : fallback);

  return statusPart ? `${baseMessage} (${statusPart})` : baseMessage;
}

function extractFromErrorObject(err: { code?: unknown; message?: unknown }): string | null {
  const msg = typeof err.message === 'string' ? err.message : '';
  const code = typeof err.code === 'string' ? err.code : '';
  if (msg && code) return `${code}: ${msg}`;
  return msg || code || null;
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const payload = body as { error?: unknown; message?: unknown };
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  if (payload.error && typeof payload.error === 'object') {
    return extractFromErrorObject(payload.error as { code?: unknown; message?: unknown });
  }
  return null;
}
