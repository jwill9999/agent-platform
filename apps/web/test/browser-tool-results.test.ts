import { describe, expect, it } from 'vitest';

import { summarizeBrowserToolResult } from '../lib/browser-tool-results';

describe('browser tool result helpers', () => {
  it('summarizes browser action results with bounded artifact links', () => {
    const summary = summarizeBrowserToolResult({
      kind: 'screenshot',
      status: 'succeeded',
      page: { url: 'http://localhost:3001', title: 'Agent Platform' },
      policyDecision: { matchedRule: 'action_allowed' },
      evidence: [
        {
          id: 'artifact-1',
          kind: 'screenshot',
          label: 'Browser screenshot',
          mimeType: 'image/png',
          sizeBytes: 2048,
          truncated: false,
          content: 'raw content must not be copied into the summary',
          metadata: {
            workspaceRelativePath: '.agent-platform/browser/session/artifact-1.png',
          },
        },
      ],
    });

    expect(summary).toMatchObject({
      kind: 'screenshot',
      status: 'succeeded',
      url: 'http://localhost:3001',
      title: 'Agent Platform',
      artifacts: [
        {
          id: 'artifact-1',
          downloadHref:
            '/api/v1/browser/artifacts/download?path=.agent-platform%2Fbrowser%2Fsession%2Fartifact-1.png',
          previewHref:
            '/api/v1/browser/artifacts/download?path=.agent-platform%2Fbrowser%2Fsession%2Fartifact-1.png&disposition=inline',
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain('raw content');
  });

  it('returns null for non-browser-shaped tool data', () => {
    expect(summarizeBrowserToolResult({ stdout: 'ok' })).toBeNull();
  });
});
