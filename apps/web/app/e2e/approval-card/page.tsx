'use client';

import type { UIMessage } from 'ai';

import { Message } from '@/components/chat/message';

const assistantMessage = {
  id: 'approval-assistant',
  role: 'assistant',
  content: '',
  parts: [{ type: 'text', text: '' }],
} as unknown as UIMessage;

export default function ApprovalCardE2ePage() {
  return (
    <main className="p-6">
      <h1 className="mb-4 text-lg font-semibold">E2E approval-card verify</h1>
      <div className="max-w-3xl">
        <Message
          message={assistantMessage}
          approvals={[
            {
              type: 'approval_required',
              approvalRequestId: 'approval-e2e',
              toolName: 'sys_bash',
              riskTier: 'high',
              argsPreview: { command: 'date', token: '[REDACTED]' },
              message: 'Tool "sys_bash" requires human approval before execution.',
              status: 'pending',
            },
          ]}
          onApprovalDecision={() => {}}
        />
        <Message
          message={assistantMessage}
          approvals={[
            {
              type: 'approval_required',
              approvalRequestId: 'approval-e2e-executed',
              toolName: 'sys_bash',
              riskTier: 'high',
              argsPreview: { command: 'date' },
              status: 'executed',
            },
          ]}
        />
      </div>
    </main>
  );
}
