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

  it('keeps tool results separate from assistant text', () => {
    const result = renderStreamEvent({
      type: 'tool_result',
      toolId: 'sys_write_file',
      data: { written: true, path: '/workspace/scratch/demo-app/src/app.ts' },
    });

    expect(result).toEqual({
      toolTrace: {
        type: 'result',
        toolId: 'sys_write_file',
        data: { written: true, path: '/workspace/scratch/demo-app/src/app.ts' },
        status: 'success',
      },
    });
    expect(result).not.toHaveProperty('text');
  });

  it('keeps recoverable tool errors out of the global chat error', () => {
    const result = renderStreamEvent({
      type: 'error',
      code: 'WRITE_FAILED',
      message: "ENOENT: no such file or directory, open '/workspace/scratch/demo-app/src/app.ts'",
    });

    expect(result).toEqual({
      toolTrace: {
        type: 'error',
        code: 'WRITE_FAILED',
        message: "ENOENT: no such file or directory, open '/workspace/scratch/demo-app/src/app.ts'",
      },
    });
  });

  it('keeps tool-call placeholders separate from assistant text', () => {
    const result = renderStreamEvent({
      type: 'text',
      content: 'Calling tool: Write a file...',
    });

    expect(result).toEqual({
      toolTrace: {
        type: 'status',
        label: 'Calling tool: Write a file...',
      },
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

  it('normalizes internal tool-state provider errors before displaying them', () => {
    const result = renderStreamEvent({
      type: 'error',
      message:
        "Invalid parameter: messages with role 'tool' must be a response to a preceding message with 'tool_calls'.",
    });

    expect(result).toEqual({
      error:
        'The agent could not continue because the conversation tool state is out of sync. Start a new Project chat or retry after preparing Project instructions.',
    });
  });

  it('normalizes missing Project instructions failures before displaying them', () => {
    const result = renderStreamEvent({
      type: 'error',
      message: "ENOENT: no such file or directory, open '/Users/example/project/AGENTS.md'",
    });

    expect(result).toEqual({
      error:
        'Project instructions are missing. Run /init or use Generate AGENTS.md before asking the agent to edit Project files.',
    });
  });

  it('normalizes invalid request body failures before displaying them', () => {
    const result = renderStreamEvent({
      type: 'error',
      message: 'Invalid request body',
    });

    expect(result).toEqual({
      error:
        'The agent request could not be sent because the chat payload was invalid. Retry the message, or start a new Project chat if it persists.',
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
