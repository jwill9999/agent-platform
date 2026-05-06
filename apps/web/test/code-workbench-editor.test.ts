import { describe, expect, it } from 'vitest';

import { getWorkbenchLanguage, updateWorkbenchTabContent } from '@/lib/code-workbench-editor';

describe('code workbench editor helpers', () => {
  it('maps common filenames to editor languages', () => {
    expect(getWorkbenchLanguage('app.ts')).toBe('typescript');
    expect(getWorkbenchLanguage('page.tsx')).toBe('typescript');
    expect(getWorkbenchLanguage('script.jsx')).toBe('javascript');
    expect(getWorkbenchLanguage('config.json')).toBe('json');
    expect(getWorkbenchLanguage('styles.scss')).toBe('css');
    expect(getWorkbenchLanguage('index.html')).toBe('html');
    expect(getWorkbenchLanguage('README.md')).toBe('markdown');
    expect(getWorkbenchLanguage('task.py')).toBe('python');
    expect(getWorkbenchLanguage('Dockerfile')).toBe('plaintext');
  });

  it('marks the active tab dirty when editor content changes', () => {
    const tabs = [
      { path: '/a.ts', content: 'one', isDirty: false, name: 'a.ts' },
      { path: '/b.ts', content: 'two', isDirty: false, name: 'b.ts' },
    ];

    const updated = updateWorkbenchTabContent(tabs, '/b.ts', 'changed');

    expect(updated).toEqual([
      { path: '/a.ts', content: 'one', isDirty: false, name: 'a.ts' },
      { path: '/b.ts', content: 'changed', isDirty: true, name: 'b.ts' },
    ]);
  });

  it('leaves tabs unchanged when there is no active path', () => {
    const tabs = [{ path: '/a.ts', content: 'one', isDirty: false }];

    expect(updateWorkbenchTabContent(tabs, null, 'changed')).toEqual(tabs);
  });
});
