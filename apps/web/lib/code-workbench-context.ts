import type { SanitisedFile } from '@/lib/file-context';
import { sanitiseFileContext } from '@/lib/file-context';

export type WorkbenchContextSource = 'active' | 'pinned';

export type WorkbenchContextInputFile = {
  path: string;
  name: string;
  content: string;
  isDirty?: boolean;
};

export type WorkbenchContextEntry = {
  path: string;
  name: string;
  source: WorkbenchContextSource;
  isDirty: boolean;
  status: 'included' | 'excluded';
  language?: string;
  characters: number;
};

export type WorkbenchContextDraft = {
  entries: WorkbenchContextEntry[];
  filesForMessage: { file: string; code: string }[];
  sanitisedFiles: SanitisedFile[];
  warnings: string[];
  includedCount: number;
  totalCharacters: number;
};

export function buildWorkbenchContextDraft({
  pinnedFiles,
  activeFile,
  includeActiveFile,
}: {
  pinnedFiles: readonly WorkbenchContextInputFile[];
  activeFile: WorkbenchContextInputFile | null | undefined;
  includeActiveFile: boolean;
}): WorkbenchContextDraft {
  const filesForMessage = new Map<string, WorkbenchContextInputFile>();
  const sources = new Map<string, WorkbenchContextSource>();

  for (const file of pinnedFiles) {
    filesForMessage.set(file.path, file);
    sources.set(file.path, 'pinned');
  }

  if (includeActiveFile && activeFile && !filesForMessage.has(activeFile.path)) {
    filesForMessage.set(activeFile.path, activeFile);
    sources.set(activeFile.path, 'active');
  }

  const rawFiles = [...filesForMessage.values()].map((file) => ({
    file: file.path,
    code: file.content,
  }));
  const { files: sanitisedFiles, warnings } = sanitiseFileContext(rawFiles);
  const includedPaths = new Map(sanitisedFiles.map((file) => [file.path, file]));

  const entries = [...filesForMessage.values()].map<WorkbenchContextEntry>((file) => {
    const sanitised = includedPaths.get(file.path);
    return {
      path: file.path,
      name: file.name,
      source: sources.get(file.path) ?? 'pinned',
      isDirty: Boolean(file.isDirty),
      status: sanitised ? 'included' : 'excluded',
      language: sanitised?.language,
      characters: sanitised?.code.length ?? file.content.length,
    };
  });

  return {
    entries,
    filesForMessage: rawFiles,
    sanitisedFiles,
    warnings,
    includedCount: sanitisedFiles.length,
    totalCharacters: sanitisedFiles.reduce((sum, file) => sum + file.code.length, 0),
  };
}
