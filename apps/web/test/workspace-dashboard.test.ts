import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { WorkspaceDashboard } from '@/components/config/workspace-dashboard';

beforeAll(() => {
  vi.stubGlobal('React', React);
});

describe('WorkspaceDashboard', () => {
  it('renders execution policy controls with conservative defaults', () => {
    const html = renderToStaticMarkup(createElement(WorkspaceDashboard));

    expect(html).toContain('Execution policy');
    expect(html).toContain('Unknown commands');
    expect(html).toContain('Ask approval');
    expect(html).toContain('Package and script commands');
    expect(html).toContain('Git mutations');
    expect(html).toContain('Destructive host actions are always blocked');
  });
});
