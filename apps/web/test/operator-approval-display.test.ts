import { describe, expect, it } from 'vitest';

import { displayApproval } from '../lib/operator-approval-display';

describe('operator approval display model', () => {
  it('renders approval requests in human-readable terms', () => {
    const display = displayApproval({
      type: 'approval_required',
      approvalRequestId: 'approval-1',
      toolName: 'sys_browser_start',
      riskTier: 'medium',
      argsPreview: { url: 'https://www.bbc.co.uk/iplayer' },
      message:
        'Tool "sys_browser_start" requires human approval before execution. External domain is not explicitly allowlisted',
      status: 'pending',
    });

    expect(display).toMatchObject({
      action: 'Open browser page',
      title: 'Approval required to open browser page',
      target: 'https://www.bbc.co.uk/iplayer',
      reason: 'External domain is not allowlisted',
      riskLabel: 'MEDIUM',
      statusLabel: 'Waiting for approval',
    });
    expect(display.allowText).toContain('Approving allows the agent to open browser page');
    expect(display.denyText).toBe('Denying prevents this action from running.');
  });

  it('keeps raw payloads in redacted technical details', () => {
    const display = displayApproval({
      type: 'approval_required',
      approvalRequestId: 'approval-2',
      toolName: 'sys_bash',
      riskTier: 'high',
      argsPreview: {
        command: 'curl -H "Authorization: Bearer abcdefghijklmnopqrstuvwxyz1234567890"',
      },
      status: 'pending',
    });

    expect(display.target).toContain('[REDACTED:CREDENTIAL]');
    expect(display.details.redacted).toBe(true);
    expect(display.details.payload).toContain('[REDACTED:CREDENTIAL]');
    expect(display.details.payload).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
  });

  it('describes terminal states clearly', () => {
    const approved = displayApproval({
      type: 'approval_required',
      approvalRequestId: 'approval-3',
      toolName: 'sys_bash',
      argsPreview: { command: 'date' },
      status: 'executed',
    });
    const denied = displayApproval({
      type: 'approval_required',
      approvalRequestId: 'approval-4',
      toolName: 'sys_bash',
      argsPreview: { command: 'date' },
      status: 'rejected',
    });

    expect(approved.title).toBe('Run terminal command completed');
    expect(approved.statusLabel).toBe('Approved action completed');
    expect(denied.title).toBe('Run terminal command denied');
    expect(denied.statusLabel).toBe('Denied');
  });
});
