'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
}

export interface UseFileSystemReturn {
  /** Whether the browser supports the File System Access API */
  isSupported: boolean;
  /** Whether a directory is currently open */
  isDirectoryOpen: boolean;
  /** The root directory name */
  rootName: string | null;
  /** The file tree loaded from the filesystem */
  fileTree: FileNode[];
  /** Whether the tree is currently loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Open a directory picker and load the tree */
  openDirectory: () => Promise<void>;
  /** Read a file's content by its handle */
  readFile: (node: FileNode) => Promise<string>;
  /** Write content back to a file via its handle */
  writeFile: (node: FileNode, content: string) => Promise<boolean>;
  /** Refresh the current directory tree */
  refresh: () => Promise<void>;
  /** Close the current directory */
  closeDirectory: () => void;
}

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

function isFileSystemAccessSupported(): boolean {
  return typeof globalThis.window !== 'undefined' && 'showDirectoryPicker' in globalThis.window;
}

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.cache',
  '__pycache__',
  '.turbo',
  'coverage',
]);

const MAX_DEPTH = 8;
const MAX_FILES = 2000;

async function buildTree(
  dirHandle: FileSystemDirectoryHandle,
  parentPath: string,
  depth: number,
  counter: { count: number },
): Promise<FileNode[]> {
  if (depth > MAX_DEPTH || counter.count > MAX_FILES) return [];

  const entries: FileNode[] = [];

  for await (const [name, handle] of dirHandle.entries()) {
    if (counter.count > MAX_FILES) break;

    if (handle.kind === 'directory') {
      if (IGNORED_DIRS.has(name) || name.startsWith('.')) continue;

      const dirPath = `${parentPath}/${name}`;
      counter.count++;

      const children = await buildTree(
        handle as FileSystemDirectoryHandle,
        dirPath,
        depth + 1,
        counter,
      );

      entries.push({
        name,
        path: dirPath,
        type: 'directory',
        children,
        handle: handle as FileSystemDirectoryHandle,
      });
    } else {
      counter.count++;
      entries.push({
        name,
        path: `${parentPath}/${name}`,
        type: 'file',
        handle: handle as FileSystemFileHandle,
      });
    }
  }

  // Sort: directories first, then alphabetical
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFileSystem(): UseFileSystemReturn {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootName, setRootName] = useState<string | null>(null);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const rootHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  // Detect FS Access API support only on the client (avoids SSR hydration mismatch)
  useEffect(() => {
    setIsSupported(isFileSystemAccessSupported());
  }, []);

  const loadTree = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setIsLoading(true);
    setError(null);
    try {
      const counter = { count: 0 };
      const tree = await buildTree(handle, '', 0, counter);
      setFileTree(tree);
      setRootName(handle.name);
      setIsDirectoryOpen(true);
      rootHandleRef.current = handle;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read directory';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openDirectory = useCallback(async () => {
    if (!isSupported) {
      setError('File System Access API is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    try {
      const handle = await globalThis.window.showDirectoryPicker({ mode: 'readwrite' });
      await loadTree(handle);
    } catch (err) {
      // User cancelled the picker — not an error
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to open directory';
      setError(message);
    }
  }, [isSupported, loadTree]);

  const readFile = useCallback(async (node: FileNode): Promise<string> => {
    const handle = node.handle;
    if (!handle || handle.kind !== 'file') {
      throw new Error('No file handle available');
    }

    const file = await handle.getFile();
    return file.text();
  }, []);

  const writeFile = useCallback(async (node: FileNode, content: string): Promise<boolean> => {
    const handle = node.handle;
    if (!handle || handle.kind !== 'file') return false;

    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!rootHandleRef.current) return;
    await loadTree(rootHandleRef.current);
  }, [loadTree]);

  const closeDirectory = useCallback(() => {
    setFileTree([]);
    setRootName(null);
    setIsDirectoryOpen(false);
    rootHandleRef.current = null;
    setError(null);
  }, []);

  return {
    isSupported,
    isDirectoryOpen,
    rootName,
    fileTree,
    isLoading,
    error,
    openDirectory,
    readFile,
    writeFile,
    refresh,
    closeDirectory,
  };
}
