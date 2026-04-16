'use client';

import type { Output } from '@agent-platform/contracts';

import { CodeBlock } from './CodeBlock';

type Props = Readonly<{
  output: Output;
  /** When false, thinking blocks render as a short placeholder (user setting stub). */
  showThinking: boolean;
}>;

export function OutputRenderer({ output, showThinking }: Props) {
  switch (output.type) {
    case 'text':
      return (
        <div className="output-text" style={{ whiteSpace: 'pre-wrap' }}>
          {output.content}
        </div>
      );
    case 'code':
      return <CodeBlock language={output.language} content={output.content} />;
    case 'tool_result':
      return (
        <div
          className="output-tool-result"
          style={{
            margin: '0.5rem 0',
            padding: '0.75rem',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            fontSize: '0.8125rem',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.35rem', color: '#0f172a' }}>
            Tool result · <code>{output.toolId}</code>
          </div>
          <pre
            style={{
              margin: 0,
              overflow: 'auto',
              maxHeight: '16rem',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {typeof output.data === 'string'
              ? output.data
              : JSON.stringify(output.data, null, 2)}
          </pre>
        </div>
      );
    case 'error':
      return (
        <div
          className="output-error"
          role="alert"
          style={{
            margin: '0.5rem 0',
            padding: '0.75rem',
            borderRadius: 8,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            fontSize: '0.875rem',
          }}
        >
          {output.code ? (
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{output.code}</strong>
          ) : null}
          {output.message}
        </div>
      );
    case 'thinking':
      if (!showThinking) {
        return (
          <p
            style={{
              margin: '0.35rem 0',
              fontSize: '0.8125rem',
              color: '#64748b',
              fontStyle: 'italic',
            }}
          >
            Thinking hidden — enable &quot;Show thinking&quot; to view reasoning.
          </p>
        );
      }
      return (
        <details
          open
          className="output-thinking"
          style={{
            margin: '0.5rem 0',
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            border: '1px dashed #94a3b8',
            background: '#f1f5f9',
            fontSize: '0.8125rem',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155' }}>
            Thinking
          </summary>
          <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', color: '#475569' }}>
            {output.content}
          </div>
        </details>
      );
    default: {
      const _exhaustive: never = output;
      return _exhaustive;
    }
  }
}
