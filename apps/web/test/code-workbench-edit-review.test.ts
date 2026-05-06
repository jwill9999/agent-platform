import { describe, expect, it, vi } from 'vitest';

import { createWorkbenchDiff, createWorkbenchEditProposal } from '@/lib/code-workbench-edit-review';

describe('code workbench edit review', () => {
  it('creates a line diff with removed and added rows', () => {
    expect(createWorkbenchDiff('one\ntwo\nthree', 'one\nchanged\nthree')).toEqual([
      { kind: 'unchanged', content: 'one', oldLineNumber: 1, newLineNumber: 1 },
      { kind: 'removed', content: 'two', oldLineNumber: 2, newLineNumber: null },
      { kind: 'added', content: 'changed', oldLineNumber: null, newLineNumber: 2 },
      { kind: 'unchanged', content: 'three', oldLineNumber: 3, newLineNumber: 3 },
    ]);
  });

  it('marks proposals with no before content as new files', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);

    expect(
      createWorkbenchEditProposal({
        path: '/src/new.ts',
        before: '',
        after: 'export const value = 1;',
      }),
    ).toMatchObject({
      id: '/src/new.ts:123',
      path: '/src/new.ts',
      name: 'new.ts',
      isNewFile: true,
      diff: [{ kind: 'added', content: 'export const value = 1;', newLineNumber: 1 }],
    });
  });
});
