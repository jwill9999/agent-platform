import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { IDEMarkdown } from '@/components/ide/ide-markdown';

describe('IDEMarkdown file references', () => {
  it('renders inline file references as openable workbench actions', () => {
    const html = renderToStaticMarkup(
      createElement(IDEMarkdown, {
        content: 'Open `/src/app.ts`.',
        getFileReferenceAction: (reference) => ({
          path: reference,
          status: 'available',
          label: `Open ${reference} in workbench`,
          open: () => {},
        }),
      }),
    );

    expect(html).toContain('Open /src/app.ts in workbench');
    expect(html).toContain('/src/app.ts');
    expect(html).not.toContain('disabled=""');
  });

  it('renders unavailable file references with an explicit disabled state', () => {
    const html = renderToStaticMarkup(
      createElement(IDEMarkdown, {
        content: 'Open `/missing.ts`.',
        getFileReferenceAction: (reference) => ({
          path: reference,
          status: 'not_found',
          label: 'This file was not found in the active workspace',
        }),
      }),
    );

    expect(html).toContain('This file was not found in the active workspace');
    expect(html).toContain('disabled=""');
  });
});
