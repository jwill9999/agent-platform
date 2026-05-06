export type WorkbenchDiffLineKind = 'unchanged' | 'removed' | 'added';

export type WorkbenchDiffLine = {
  kind: WorkbenchDiffLineKind;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
};

export type WorkbenchEditProposal = {
  id: string;
  path: string;
  name: string;
  before: string;
  after: string;
  isNewFile: boolean;
  diff: WorkbenchDiffLine[];
};

function splitLines(value: string): string[] {
  return value.length === 0 ? [] : value.split('\n');
}

export function createWorkbenchDiff(before: string, after: string): WorkbenchDiffLine[] {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const maxLength = Math.max(beforeLines.length, afterLines.length);
  const diff: WorkbenchDiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (let index = 0; index < maxLength; index += 1) {
    const oldContent = beforeLines[index];
    const newContent = afterLines[index];
    if (oldContent === newContent && oldContent !== undefined) {
      diff.push({
        kind: 'unchanged',
        content: oldContent,
        oldLineNumber: oldLine,
        newLineNumber: newLine,
      });
      oldLine += 1;
      newLine += 1;
      continue;
    }

    if (oldContent !== undefined) {
      diff.push({
        kind: 'removed',
        content: oldContent,
        oldLineNumber: oldLine,
        newLineNumber: null,
      });
      oldLine += 1;
    }
    if (newContent !== undefined) {
      diff.push({
        kind: 'added',
        content: newContent,
        oldLineNumber: null,
        newLineNumber: newLine,
      });
      newLine += 1;
    }
  }

  return diff;
}

export function createWorkbenchEditProposal({
  path,
  before,
  after,
}: {
  path: string;
  before: string;
  after: string;
}): WorkbenchEditProposal {
  const name = path.split('/').pop() ?? 'untitled';
  return {
    id: `${path}:${Date.now()}`,
    path,
    name,
    before,
    after,
    isNewFile: before.length === 0,
    diff: createWorkbenchDiff(before, after),
  };
}
