import { describe, expect, it } from 'vitest';

import type { WorkspaceResource } from '@agent-platform/contracts';
import {
  safeWorkspacePreviewUrl,
  workspacePreviewDescriptor,
  workspaceResourceBinaryPreviewUrl,
  workspaceResourceDiffMode,
  workspaceResourceDisplayLabel,
  workspaceResourcePath,
} from '@/lib/workspace-preview';

function resource(
  kind: WorkspaceResource['kind'],
  label: string,
  metadata: Record<string, unknown> = {},
): WorkspaceResource {
  return {
    kind,
    label,
    metadata,
    projectId: 'project-1',
    uri: `workspace://project/project-1/${kind}/${encodeURIComponent(label)}`,
    createdAt: '2026-08-03T20:00:00.000Z',
  };
}

describe('workspacePreviewDescriptor', () => {
  it.each([
    ['README.md', 'text/markdown', 'markdown', 'preview'],
    ['index.html', 'text/html', 'html', 'preview'],
    ['report.pdf', 'application/pdf', 'pdf', 'preview'],
    ['diagram.png', 'image/png', 'image', 'preview'],
    ['src/index.ts', 'text/typescript', 'text', 'source'],
  ] as const)('classifies %s as %s', (label, mimeType, kind, mode) => {
    expect(workspacePreviewDescriptor(resource('file', label, { mimeType }))).toMatchObject({
      kind,
      mode,
      canPreview: true,
    });
  });

  it('uses a relative label rather than exposing a backend path', () => {
    const file = resource('file', '/Users/example/private/README.md', {
      mimeType: 'text/markdown',
      path: '/workspace/client-a/README.md',
      relativePath: 'client-a/README.md',
    });

    expect(workspacePreviewDescriptor(file)).toMatchObject({
      kind: 'markdown',
      label: 'Preview Markdown',
    });
    expect(workspaceResourcePath(file)).toBe('client-a/README.md');
    expect(workspaceResourceDisplayLabel(file)).toBe('client-a/README.md');
    expect(JSON.stringify(workspaceResourceDisplayLabel(file))).not.toContain('/Users');
  });

  it('uses a review mode for diffs and a safe fallback for unsupported files', () => {
    expect(workspacePreviewDescriptor(resource('diff', 'package.zip'))).toMatchObject({
      kind: 'diff',
      mode: 'diff',
      canPreview: true,
    });
    expect(workspacePreviewDescriptor(resource('file', 'archive.zip'))).toMatchObject({
      kind: 'unsupported',
      mode: 'fallback',
      canPreview: false,
    });
    expect(
      workspacePreviewDescriptor(
        resource('file', 'interactive.svg', { mimeType: 'image/svg+xml' }),
      ),
    ).toMatchObject({
      kind: 'unsupported',
      canPreview: false,
    });
  });

  it('builds Project-scoped binary preview URLs without host paths', () => {
    const image = resource('file', 'chart.png', {
      relativePath: 'generated/chart.png',
      mimeType: 'image/png',
    });

    expect(workspaceResourceBinaryPreviewUrl(image)).toBe(
      '/api/v1/projects/project-1/files/preview?path=generated%2Fchart.png',
    );
  });

  it('rejects unsafe paths and preview URLs', () => {
    const unsafe = resource('file', '/Users/example/private.txt', {
      path: '/Users/example/private.txt',
      previewUrl: 'javascript:alert(1)',
    });

    expect(workspaceResourcePath(unsafe)).toBeUndefined();
    expect(workspaceResourceDisplayLabel(unsafe)).toBe('Generated file');
    expect(safeWorkspacePreviewUrl(unsafe)).toBeUndefined();
    expect(workspaceResourceBinaryPreviewUrl(unsafe)).toBeUndefined();
  });

  it('normalizes staged and unstaged diff modes', () => {
    expect(workspaceResourceDiffMode(resource('diff', 'index.ts', { mode: 'staged' }))).toBe(
      'staged',
    );
    expect(workspaceResourceDiffMode(resource('diff', 'index.ts', { mode: 'unexpected' }))).toBe(
      'unstaged',
    );
  });

  it('classifies safe webview URLs as sandboxed HTML previews', () => {
    expect(
      workspacePreviewDescriptor(
        resource('webview', 'Generated app', { previewUrl: 'https://preview.example.test/app' }),
      ),
    ).toMatchObject({
      kind: 'html',
      label: 'Open preview',
      canPreview: true,
    });
  });
});
