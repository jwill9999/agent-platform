import { describe, expect, it } from 'vitest';

import {
  hasBlockingApprovalEvents,
  mergeApprovalEvent,
  renderStreamEvent,
} from '../hooks/use-harness-chat';

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

  it('renders DoD cap failures as critic status instead of user-facing errors', () => {
    const result = renderStreamEvent({
      type: 'error',
      code: 'DOD_FAILED',
      message: 'Definition of Done failed after 3 revision attempt(s).',
    });

    expect(result).toEqual({
      critic: {
        kind: 'cap_reached',
        reasons: 'Definition of Done failed after 3 revision attempt(s).',
      },
    });
  });

  it('redacts API keys from streamed error messages', () => {
    const openAiKey = ['sk-proj-', 'abcdefghijklmnopqrstuvwxyz1234567890'].join('');
    const result = renderStreamEvent({
      type: 'error',
      message: `Incorrect API key provided: ${openAiKey}`,
    });

    expect(result).toEqual({
      error: 'Incorrect API key provided: [REDACTED:CREDENTIAL]',
    });
  });

  it('redacts masked API keys from streamed error messages', () => {
    const masked = ['sk-proj-', '*'.repeat(32), 'abcd'].join('');
    const result = renderStreamEvent({
      type: 'error',
      message: `Incorrect API key provided: ${masked}`,
    });

    expect(result).toEqual({
      error: 'Incorrect API key provided: [REDACTED:CREDENTIAL]',
    });
  });

  it('renders model auth failures as global errors without raw credentials', () => {
    const result = renderStreamEvent({
      type: 'error',
      code: 'MODEL_AUTH_FAILED',
      message:
        'The model provider rejected the configured API key. Check the selected model config or server environment key.',
    });

    expect(result).toEqual({
      error:
        'The model provider rejected the configured API key. Check the selected model config or server environment key.',
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

  it('treats unresolved approval cards as send blockers', () => {
    expect(
      hasBlockingApprovalEvents({
        'message-1': [
          {
            type: 'approval_required',
            approvalRequestId: 'approval-1',
            toolName: 'sys_bash',
            riskTier: 'high',
            argsPreview: { command: 'date' },
            status: 'pending',
          },
        ],
      }),
    ).toBe(true);

    expect(
      hasBlockingApprovalEvents({
        'message-1': [
          {
            type: 'approval_required',
            approvalRequestId: 'approval-1',
            toolName: 'sys_bash',
            riskTier: 'high',
            argsPreview: { command: 'date' },
            status: 'executed',
          },
        ],
      }),
    ).toBe(false);
  });
});
