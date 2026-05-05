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
  const approvals = [
    {
      type: 'approval_required' as const,
      approvalRequestId: 'approval-e2e',
      toolName: 'sys_browser_start',
      riskTier: 'medium',
      argsPreview: { url: 'https://www.bbc.co.uk/iplayer', token: '[REDACTED]' },
      message:
        'Tool "sys_browser_start" requires human approval before execution. External domain is not explicitly allowlisted',
      status: 'pending' as const,
    },
    {
      type: 'approval_required' as const,
      approvalRequestId: 'approval-e2e-executed',
      toolName: 'sys_bash',
      riskTier: 'high',
      argsPreview: { command: 'date' },
      status: 'executed' as const,
    },
    {
      type: 'approval_required' as const,
      approvalRequestId: 'approval-e2e-rejected',
      toolName: 'sys_write_file',
      riskTier: 'high',
      argsPreview: { path: '/workspace/app/secret.txt' },
      status: 'rejected' as const,
    },
    {
      type: 'approval_required' as const,
      approvalRequestId: 'approval-e2e-expired',
      toolName: 'sys_bash',
      riskTier: 'critical',
      argsPreview: { command: 'rm -rf /workspace/demo' },
      status: 'expired' as const,
    },
    {
      type: 'approval_required' as const,
      approvalRequestId: 'approval-e2e-failed',
      toolName: 'sys_browser_click',
      riskTier: 'high',
      argsPreview: { selector: 'button[type=submit]' },
      status: 'failed' as const,
      error: 'Approval could not be resumed because the browser session is unavailable.',
    },
  ];

  return (
    <main className="p-6">
      <h1 className="mb-4 text-lg font-semibold">E2E approval-card verify</h1>
      <div className="flex max-w-3xl flex-col gap-4">
        {approvals.map((approval) => (
          <Message
            key={approval.approvalRequestId}
            message={assistantMessage}
            approvals={[approval]}
            onApprovalDecision={() => {}}
          />
        ))}
      </div>
    </main>
  );
}
