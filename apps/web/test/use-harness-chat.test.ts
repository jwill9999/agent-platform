import { describe, expect, it } from 'vitest';

import { renderStreamEvent } from '../hooks/use-harness-chat';

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
});
