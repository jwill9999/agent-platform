import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { WorkspaceEvent, WorkspaceResource } from '@agent-platform/contracts';
import {
  WorkspaceResourceCards,
  WorkspaceResourceViewer,
} from '@/components/chat/workspace-resource-cards';

function resource(
  kind: WorkspaceResource['kind'],
  label: string,
  metadata: Record<string, unknown>,
): WorkspaceResource {
  return {
    kind,
    label,
    metadata,
    projectId: 'project-1',
    uri: `workspace://project/project-1/${kind}/generated/output`,
    createdAt: '2026-08-04T09:00:00.000Z',
  };
}

describe('WorkspaceResourceCards', () => {
  it('renders the full card as a clickable control without exposing host paths', () => {
    const file = resource('file', '/Users/example/private/report.md', {
      path: '/workspace/generated/report.md',
      relativePath: 'generated/report.md',
      mimeType: 'text/markdown',
    });
    const events: WorkspaceEvent[] = [{ type: 'resource_created', resource: file, metadata: {} }];

    const html = renderToStaticMarkup(createElement(WorkspaceResourceCards, { events }));

    expect(html).toContain('<button');
    expect(html).toContain('Preview Markdown: generated/report.md');
    expect(html).toContain('generated/report.md');
    expect(html).not.toContain('/workspace');
    expect(html).not.toContain('/Users/example');
  });

  it('renders generated HTML in a restricted iframe boundary', () => {
    const file = resource('file', 'app.html', {
      relativePath: 'generated/app.html',
      mimeType: 'text/html',
      content: '<script>document.body.textContent = "app"</script>',
    });

    const html = renderToStaticMarkup(
      createElement(WorkspaceResourceViewer, { resource: file, onClose: () => undefined }),
    );

    expect(html).toContain('data-testid="workspace-resource-html-preview"');
    expect(html).toContain('<dialog');
    expect(html).toContain('open=""');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('sandbox="allow-forms allow-modals allow-popups allow-scripts"');
    expect(html).not.toContain('allow-same-origin');
    expect(html).toContain('generated/app.html');
    expect(html).toContain('Download');
    expect(html).toContain('/resources/export?uri=');
  });

  it('keeps unsupported files in a safe non-mutating fallback state', () => {
    const file = resource('file', 'archive.zip', { relativePath: 'generated/archive.zip' });

    const html = renderToStaticMarkup(
      createElement(WorkspaceResourceViewer, { resource: file, onClose: () => undefined }),
    );

    expect(html).toContain('This file cannot be previewed in the application.');
    expect(html).not.toContain('Stage');
    expect(html).not.toContain('Commit');
    expect(html).not.toContain('Push');
  });

  it('exposes linked tab and panel semantics with accessible close controls', () => {
    const first = resource('file', 'first.txt', {
      relativePath: 'generated/first.txt',
      mimeType: 'text/plain',
      content: 'First',
    });
    const second = {
      ...resource('file', 'second.txt', {
        relativePath: 'generated/second.txt',
        mimeType: 'text/plain',
        content: 'Second',
      }),
      uri: 'workspace://project/project-1/file/generated/second.txt',
    } as WorkspaceResource;

    const html = renderToStaticMarkup(
      createElement(WorkspaceResourceViewer, {
        resource: second,
        resources: [first, second],
        onActivate: () => undefined,
        onClose: () => undefined,
        onCloseTab: () => undefined,
        onMinimize: () => undefined,
      }),
    );

    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/gu)).toHaveLength(2);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-label="Close preview generated/second.txt"');
    expect(html).toContain('aria-label="Minimize previews"');
  });
});
