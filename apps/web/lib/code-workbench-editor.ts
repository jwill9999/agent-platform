export type WorkbenchLanguage =
  | 'typescript'
  | 'javascript'
  | 'json'
  | 'css'
  | 'html'
  | 'markdown'
  | 'python'
  | 'plaintext';

export type EditableWorkbenchTab = {
  path: string;
  content: string;
  isDirty: boolean;
};

export function getWorkbenchLanguage(filename: string): WorkbenchLanguage {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
    case 'scss':
      return 'css';
    case 'html':
      return 'html';
    case 'md':
    case 'mdx':
    case 'txt':
      return 'markdown';
    case 'py':
      return 'python';
    default:
      return 'plaintext';
  }
}

export function updateWorkbenchTabContent<T extends EditableWorkbenchTab>(
  tabs: readonly T[],
  activePath: string | null,
  content: string,
): T[] {
  if (!activePath) return [...tabs];
  return tabs.map((tab) => (tab.path === activePath ? { ...tab, content, isDirty: true } : tab));
}
