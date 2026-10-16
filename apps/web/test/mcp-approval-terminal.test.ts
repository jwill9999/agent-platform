import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ApprovalCard } from '@/components/chat/approval-card';
import {
  mcpApprovalHaltMessage,
  hasBlockingApprovalEvents,
  renderStreamEvent,
} from '@/hooks/use-harness-chat';
import { displayApproval } from '@/lib/operator-approval-display';

beforeAll(() => vi.stubGlobal('React', React));

describe('terminal action approval feedback', () => {
  it.each([
    'MCP_OUTCOME_UNKNOWN',
    'MCP_APPROVAL_STALE',
    'COMMAND_OUTCOME_UNKNOWN',
    'HTTP_OUTCOME_UNKNOWN',
    'DOWNLOAD_OUTCOME_UNKNOWN',
  ])('renders %s without claiming completion or permitting replay', (code) => {
    const rendered = renderStreamEvent({
      type: 'error',
      code,
      message: 'Synthetic server detail',
    });
    expect(rendered && 'toolTrace' in rendered).toBe(true);
    if (!rendered || !('toolTrace' in rendered)) throw new Error('Missing terminal trace');
    const message = mcpApprovalHaltMessage(rendered.toolTrace);
    expect(message).not.toBeNull();
    expect(message).not.toContain('Synthetic server detail');
    const approval = {
      type: 'approval_required' as const,
      approvalRequestId: 'owned-approval',
      toolName: 'server:fixture_effect',
      argsPreview: {},
      status: 'not_completed' as const,
      error: message!,
    };
    const display = displayApproval(approval);
    expect(display.title).toBe('Use connected tool needs attention');
    expect(display.statusLabel).toBe('Action needs attention');
    const html = renderToStaticMarkup(
      React.createElement(ApprovalCard, { approval, onDecision: vi.fn() }),
    );
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Approved action completed');
    expect(html).not.toContain('Use connected tool completed');
    expect(hasBlockingApprovalEvents({ message: [approval] })).toBe(false);
    expect(message).toContain(
      code === 'MCP_APPROVAL_STALE' ? 'was not run' : 'may have taken effect',
    );
  });
  it('does not change successful tool events or unrelated recoverable errors', () => {
    expect(
      mcpApprovalHaltMessage({
        type: 'result',
        toolId: 'server:tool',
        data: { ok: true },
        status: 'success',
      }),
    ).toBeNull();
    expect(
      mcpApprovalHaltMessage({
        type: 'error',
        code: 'MCP_SESSION_NOT_FOUND',
        message: 'Unavailable',
      }),
    ).toBeNull();
  });
});
