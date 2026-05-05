import { describe, expect, it } from 'vitest';

import { artifactViewsFromEvents } from '../lib/operator-artifacts';

describe('operator artifact view model', () => {
  it('maps browser evidence into typed artifact cards', () => {
    const artifacts = artifactViewsFromEvents([
      {
        type: 'result',
        toolId: 'sys_browser_snapshot',
        status: 'success',
        data: {
          kind: 'snapshot',
          status: 'succeeded',
          page: { title: 'Agent Platform', url: 'http://web:3001' },
          evidence: [
            {
              id: 'image-1',
              kind: 'screenshot',
              label: 'Browser screenshot',
              mimeType: 'image/png',
              sizeBytes: 1024,
              truncated: false,
              metadata: {
                workspaceRelativePath: '.agent-platform/browser/session/image.png',
              },
            },
            {
              id: 'text-1',
              kind: 'snapshot',
              label: 'Page snapshot',
              mimeType: 'text/plain',
              sizeBytes: 512,
              truncated: true,
              metadata: {
                workspaceRelativePath: '.agent-platform/browser/session/snapshot.txt',
              },
            },
            {
              id: 'zip-1',
              kind: 'archive',
              label: 'Archive',
              mimeType: 'application/zip',
              sizeBytes: 2048,
              truncated: false,
              metadata: {
                workspaceRelativePath: '.agent-platform/browser/session/archive.zip',
              },
            },
          ],
        },
      },
    ]);

    expect(artifacts).toHaveLength(3);
    expect(artifacts[0]).toMatchObject({
      id: 'image-1',
      viewKind: 'image',
      viewerLabel: 'Inspect image',
      statusLabel: 'Ready',
      sourceLabel: 'Agent Platform',
      sourceUrl: 'http://web:3001',
    });
    expect(artifacts[1]).toMatchObject({
      id: 'text-1',
      viewKind: 'text',
      viewerLabel: 'Inspect text',
      statusLabel: 'Truncated',
    });
    expect(artifacts[2]).toMatchObject({
      id: 'zip-1',
      viewKind: 'download',
      viewerLabel: 'Download file',
      statusLabel: 'Ready',
      previewHref: undefined,
    });
  });

  it('deduplicates repeated artifact ids', () => {
    const artifacts = artifactViewsFromEvents([
      {
        type: 'result',
        toolId: 'sys_browser_screenshot',
        status: 'success',
        data: {
          kind: 'screenshot',
          status: 'succeeded',
          evidence: [
            {
              id: 'same',
              kind: 'screenshot',
              label: 'Browser screenshot',
              mimeType: 'image/png',
              sizeBytes: 1024,
              truncated: false,
            },
            {
              id: 'same',
              kind: 'screenshot',
              label: 'Browser screenshot duplicate',
              mimeType: 'image/png',
              sizeBytes: 1024,
              truncated: false,
            },
          ],
        },
      },
    ]);

    expect(artifacts).toHaveLength(1);
  });
});
