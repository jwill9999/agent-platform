import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { WorkspaceDashboard } from '@/components/config/workspace-dashboard';

beforeAll(() => {
  vi.stubGlobal('React', React);
});

describe('WorkspaceDashboard', () => {
  it('shows loading without inventing saved permission defaults', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceDashboard));

    expect(html).toContain('Execution policy');
    expect(html).toContain('Loading execution policy');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('Ask approval');
    expect(html).toContain('Destructive host actions are always blocked');
  });
});
