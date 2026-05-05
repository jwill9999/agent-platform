import { describe, expect, it } from 'vitest';

import { buildWorkbenchContextDraft } from '@/lib/code-workbench-context';

describe('buildWorkbenchContextDraft', () => {
  it('includes pinned files and auto-includes the active file once', () => {
    const draft = buildWorkbenchContextDraft({
      pinnedFiles: [{ path: '/src/a.ts', name: 'a.ts', content: 'const a = 1;' }],
      activeFile: { path: '/src/b.ts', name: 'b.ts', content: 'const b = 2;', isDirty: true },
      includeActiveFile: true,
    });

    expect(draft.filesForMessage).toEqual([
      { file: '/src/a.ts', code: 'const a = 1;' },
      { file: '/src/b.ts', code: 'const b = 2;' },
    ]);
    expect(draft.entries).toMatchObject([
      { path: '/src/a.ts', source: 'pinned', status: 'included' },
      { path: '/src/b.ts', source: 'active', status: 'included', isDirty: true },
    ]);
    expect(draft.includedCount).toBe(2);
  });

  it('does not auto-include the active file when disabled', () => {
    const draft = buildWorkbenchContextDraft({
      pinnedFiles: [{ path: '/src/a.ts', name: 'a.ts', content: 'const a = 1;' }],
      activeFile: { path: '/src/b.ts', name: 'b.ts', content: 'const b = 2;' },
      includeActiveFile: false,
    });

    expect(draft.filesForMessage).toEqual([{ file: '/src/a.ts', code: 'const a = 1;' }]);
    expect(draft.entries.map((entry) => entry.path)).toEqual(['/src/a.ts']);
  });

  it('marks unsupported files as excluded using the same sanitisation as send', () => {
    const draft = buildWorkbenchContextDraft({
      pinnedFiles: [{ path: '/assets/logo.png', name: 'logo.png', content: 'binary' }],
      activeFile: null,
      includeActiveFile: true,
    });

    expect(draft.sanitisedFiles).toHaveLength(0);
    expect(draft.entries).toMatchObject([{ path: '/assets/logo.png', status: 'excluded' }]);
    expect(draft.warnings[0]).toContain('not an allowed text format');
  });
});
