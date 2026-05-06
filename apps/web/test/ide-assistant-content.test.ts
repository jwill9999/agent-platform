import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UIMessage } from 'ai';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AssistantContent } from '@/components/ide/ide-with-chat';

beforeAll(() => {
  vi.stubGlobal('React', React);
});

function assistantMessage(text: string): UIMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: text,
    parts: [{ type: 'text', text }],
  };
}

describe('IDE assistant content', () => {
  it('renders tool activity when the assistant has no text response', () => {
    const html = renderToStaticMarkup(
      createElement(AssistantContent, {
        message: assistantMessage(''),
        awaiting: false,
        contextFiles: [],
        activeFile: null,
        onApplyCode: () => {},
        onCreateFile: () => {},
        toolEvents: [{ type: 'status', label: 'Calling tool: Write file...' }],
      }),
    );

    expect(html).toContain('Tool activity');
    expect(html).toContain('Calling tool: Write file...');
    expect(html).not.toContain('No assistant response was returned.');
  });

  it('renders approval cards when an IDE tool call needs human approval', () => {
    const html = renderToStaticMarkup(
      createElement(AssistantContent, {
        message: assistantMessage(''),
        awaiting: false,
        contextFiles: [],
        activeFile: null,
        onApplyCode: () => {},
        onCreateFile: () => {},
        approvals: [
          {
            type: 'approval_required',
            approvalRequestId: 'approval-1',
            toolName: 'sys_write_file',
            riskTier: 'high',
            argsPreview: { path: '/workspace/README.md' },
            status: 'pending',
          },
        ],
      }),
    );

    expect(html).toContain('data-testid="approval-card"');
    expect(html).toContain('Approve');
    expect(html).toContain('Deny');
    expect(html).not.toContain('No assistant response was returned.');
  });
});
