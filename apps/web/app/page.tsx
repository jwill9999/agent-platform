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

  const busy = status === 'streaming' || status === 'submitted';

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Chat</h1>
      <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.75rem' }}>
        Uses the same OpenAI streaming stack as the API (<code>/v1/chat/stream</code>). Set{' '}
        <code>OPENAI_API_KEY</code> for this Next.js server (see <code>apps/web/.env.example</code>
        ).
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
        />
        Show thinking (stored in this browser)
      </label>

      {error ? (
        <OutputRenderer
          showThinking={showThinking}
          output={{ type: 'error', message: error.message ?? 'Request failed' }}
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
                    <OutputRenderer key={i} output={o} showThinking={showThinking} />
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
