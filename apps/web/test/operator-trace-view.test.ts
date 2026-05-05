import { describe, expect, it } from 'vitest';

import { createTraceEntries, traceSummary } from '../lib/operator-trace-view';

describe('operator trace view model', () => {
  it('builds trace entries from tool status, result, and error events', () => {
    const entries = createTraceEntries([
      { type: 'status', label: 'Calling tool: Capture screenshot' },
      {
        type: 'result',
        toolId: 'sys_browser_screenshot',
        status: 'success',
        data: {
          kind: 'screenshot',
          status: 'succeeded',
          traceId: 'trace-123',
          page: { title: 'Agent Platform', url: 'http://web:3001' },
          policyDecision: { matchedRule: 'action_allowed' },
          evidence: [
            {
              id: 'artifact-1',
              kind: 'screenshot',
              label: 'Browser screenshot',
              mimeType: 'image/png',
              sizeBytes: 1024,
              truncated: false,
            },
          ],
        },
      },
      { type: 'error', code: 'TOOL_FAILED', message: 'Screenshot failed' },
    ]);

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      sequence: 1,
      kind: 'status',
      label: 'Running tool actions',
      status: 'running',
    });
    expect(entries[1]).toMatchObject({
      sequence: 2,
      kind: 'result',
      label: 'Capture screenshot',
      status: 'completed',
      target: 'Agent Platform',
      toolId: 'sys_browser_screenshot',
      traceId: 'trace-123',
      policy: 'action_allowed',
      artifactCount: 1,
    });
    expect(entries[2]).toMatchObject({
      sequence: 3,
      kind: 'error',
      label: 'Tool action failed',
      status: 'failed',
      errorCode: 'TOOL_FAILED',
      errorMessage: 'Screenshot failed',
    });
  });

  it('summarizes failures, gated actions, and artifacts', () => {
    const entries = createTraceEntries([
      {
        type: 'result',
        toolId: 'sys_browser_start',
        status: 'success',
        data: {
          kind: 'start',
          status: 'approval_required',
          policyDecision: { matchedRule: 'external_domain_requires_approval' },
          evidence: [
            {
              id: 'artifact-1',
              kind: 'snapshot',
              label: 'Page snapshot',
              mimeType: 'text/plain',
              sizeBytes: 100,
              truncated: false,
            },
          ],
        },
      },
      { type: 'error', code: 'NATIVE_TOOL_FAILED', message: 'Native tool failed' },
    ]);

    expect(traceSummary(entries)).toBe('2 events · 1 failed · 1 gated · 1 artifact');
    expect(traceSummary([])).toBe('No trace events captured');
  });

  it('keeps sensitive payloads redacted', () => {
    const [entry] = createTraceEntries([
      {
        type: 'result',
        toolId: 'sys_bash',
        status: 'error',
        data: {
          command: 'curl',
          stderr: 'Bearer abcdefghijklmnopqrstuvwxyz1234567890',
        },
      },
    ]);

    expect(entry?.redacted).toBe(true);
    expect(entry?.payload).toContain('[REDACTED:CREDENTIAL]');
    expect(entry?.payload).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
  });
});
