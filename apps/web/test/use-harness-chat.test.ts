import { describe, expect, it } from 'vitest';

import { mergeApprovalEvent, renderStreamEvent } from '../hooks/use-harness-chat';

describe('harness chat stream parser', () => {
  it('keeps approval_required metadata separate from assistant text', () => {
    const result = renderStreamEvent({
      type: 'approval_required',
      approvalRequestId: 'approval-1',
      toolName: 'sys_bash',
      riskTier: 'high',
      argsPreview: { command: 'date' },
      message: 'Tool "sys_bash" requires human approval before execution.',
    });

    expect(result).toEqual({
      approvalRequired: {
        type: 'approval_required',
        approvalRequestId: 'approval-1',
        toolName: 'sys_bash',
        riskTier: 'high',
        argsPreview: { command: 'date' },
        message: 'Tool "sys_bash" requires human approval before execution.',
      },
    });
    expect(result).not.toHaveProperty('text');
  });

  it('renders approval rejection as assistant-visible text', () => {
    const result = renderStreamEvent({
      type: 'error',
      code: 'APPROVAL_REJECTED',
      message: 'Human rejected tool execution.',
    });

    expect(result).toEqual({
      text: '\n\n[APPROVAL_REJECTED] Human rejected tool execution.\n',
    });
  });

  it('deduplicates repeated approval_required events by request id', () => {
    const first = mergeApprovalEvent([], {
      type: 'approval_required',
      approvalRequestId: 'approval-1',
      toolName: 'sys_bash',
      riskTier: 'high',
      argsPreview: { command: 'date' },
    });
    const second = mergeApprovalEvent(first, {
      type: 'approval_required',
      approvalRequestId: 'approval-1',
      toolName: 'sys_bash',
      riskTier: 'high',
      argsPreview: { command: 'pwd' },
    });

    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      approvalRequestId: 'approval-1',
      status: 'pending',
      argsPreview: { command: 'pwd' },
    });
  });
});
