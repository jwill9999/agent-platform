import { describe, expect, it } from 'vitest';

import { displayToolEvent } from '../lib/operator-tool-event-display';

describe('operator tool event display model', () => {
  it('maps known tool ids to friendly labels and keeps payload details explicit', () => {
    const display = displayToolEvent({
      type: 'result',
      toolId: 'sys_write_file',
      status: 'success',
      data: { written: true, path: '/workspace/app/page.tsx' },
    });

    expect(display).toMatchObject({
      label: 'Write file',
      status: 'completed',
      statusLabel: 'Completed',
      summary: 'Write file completed',
      target: '/workspace/app/page.tsx',
    });
    expect(display.details?.payload).toContain('"toolId": "sys_write_file"');
  });

  it('translates browser approval policy into human copy', () => {
    const display = displayToolEvent({
      type: 'result',
      toolId: 'sys_browser_start',
      status: 'success',
      data: {
        kind: 'start',
        status: 'approval_required',
        page: { title: 'BBC iPlayer', url: 'https://www.bbc.co.uk/iplayer' },
        policyDecision: { matchedRule: 'external_domain_requires_approval' },
      },
    });

    expect(display).toMatchObject({
      label: 'Open browser page',
      status: 'approval_required',
      statusLabel: 'Approval required',
      summary: 'Approval required to open browser page',
      target: 'BBC iPlayer',
      reason: 'External domain is not allowlisted',
    });
  });

  it('redacts credentials in technical details', () => {
    const display = displayToolEvent({
      type: 'result',
      toolId: 'sys_bash',
      status: 'error',
      data: {
        command: 'echo token',
        stderr: 'Bearer abcdefghijklmnopqrstuvwxyz1234567890',
      },
    });

    expect(display.details?.redacted).toBe(true);
    expect(display.details?.payload).toContain('[REDACTED:CREDENTIAL]');
    expect(display.details?.payload).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
  });

  it('uses friendly labels for recoverable tool errors', () => {
    const display = displayToolEvent({
      type: 'error',
      code: 'PATH_ACCESS_DENIED',
      message: 'Path is outside the workspace',
    });

    expect(display).toMatchObject({
      label: 'Path access blocked',
      status: 'failed',
      statusLabel: 'Failed',
      summary: 'Path is outside the workspace',
    });
  });

  it('renders capability recovery metadata for allowlist failures', () => {
    const display = displayToolEvent({
      type: 'error',
      code: 'TOOL_NOT_ALLOWED',
      message: 'Tool "gh_repo_create" is not in the agent allowlist',
      recovery: {
        status: 'capability_missing',
        summary: 'Repository creation needs an approved capability provider.',
        options: [
          { id: 'request-approval', label: 'Request approval', action: 'approve' },
          { id: 'connect-provider', label: 'Connect provider', action: 'connect' },
        ],
      },
    });

    expect(display).toMatchObject({
      label: 'Capability missing',
      status: 'capability_missing',
      statusLabel: 'Capability missing',
      summary: 'Repository creation needs an approved capability provider.',
      recovery: {
        options: [
          { id: 'request-approval', label: 'Request approval', action: 'approve' },
          { id: 'connect-provider', label: 'Connect provider', action: 'connect' },
        ],
      },
    });
    expect(display.summary).not.toContain('allowlist');
  });
});
