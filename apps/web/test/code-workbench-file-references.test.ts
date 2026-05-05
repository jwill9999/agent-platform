import { describe, expect, it } from 'vitest';

import {
  isSupportedWorkbenchTextPath,
  parseWorkbenchFileReference,
} from '@/lib/code-workbench-file-references';

describe('code workbench file references', () => {
  it('parses absolute, relative, and bare workspace paths', () => {
    expect(parseWorkbenchFileReference('/src/app.ts')).toEqual({
      original: '/src/app.ts',
      path: '/src/app.ts',
    });
    expect(parseWorkbenchFileReference('./src/app.ts')).toEqual({
      original: './src/app.ts',
      path: '/src/app.ts',
    });
    expect(parseWorkbenchFileReference('src/app.ts')).toEqual({
      original: 'src/app.ts',
      path: '/src/app.ts',
    });
  });

  it('rejects external URLs, traversal, and non-path text', () => {
    expect(parseWorkbenchFileReference('https://example.com/src/app.ts')).toBeNull();
    expect(parseWorkbenchFileReference('../../secret.txt')).toBeNull();
    expect(parseWorkbenchFileReference('not a path')).toBeNull();
  });

  it('classifies likely text paths', () => {
    expect(isSupportedWorkbenchTextPath('/src/app.tsx')).toBe(true);
    expect(isSupportedWorkbenchTextPath('/Dockerfile')).toBe(true);
    expect(isSupportedWorkbenchTextPath('/assets/logo.png')).toBe(false);
  });
});
