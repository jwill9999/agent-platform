'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

// TypeScript doesn't include queryPermission / requestPermission yet.
interface PermissionDescriptor {
  mode?: 'read' | 'readwrite';
}
interface FSHandleWithPermission extends FileSystemDirectoryHandle {
  queryPermission(desc: PermissionDescriptor): Promise<PermissionState>;
  requestPermission(desc: PermissionDescriptor): Promise<PermissionState>;
}

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
  return globalThis.window !== undefined && 'showDirectoryPicker' in globalThis.window;
}

// ---------------------------------------------------------------------------
// IndexedDB persistence for FileSystemDirectoryHandle
// ---------------------------------------------------------------------------

const IDB_NAME = 'agent-platform-fs';
const IDB_STORE = 'handles';
const IDB_KEY = 'rootDir';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB may be unavailable (e.g. private browsing) — non-fatal
  }
}

async function loadPersistedHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle ?? null;
  } catch {
    return null;
  }
}

async function clearPersistedHandle(): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // non-fatal
  }
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
      toast.error('Failed to load folder', { description: message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Detect FS Access API support and restore persisted handle on mount
  useEffect(() => {
    const supported = isFileSystemAccessSupported();
    setIsSupported(supported);
    if (!supported) return;

    (async () => {
      const handle = await loadPersistedHandle();
      if (!handle) return;

      const h = handle as FSHandleWithPermission;

      // queryPermission is passive — it won't prompt the user or show any UI.
      // If permission was already granted in a previous session Chrome remembers it.
      const perm = await h.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await loadTree(handle);
        return;
      }

      // Permission not already granted (user must re-open folder manually).
      // DO NOT call requestPermission here — it requires a user gesture and
      // will put Chrome into a pending-permission state that blocks
      // showDirectoryPicker with AbortError.
      await clearPersistedHandle();
    })();
  }, [loadTree]);

  const openDirectory = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      toast.error('Unsupported browser', {
        description: 'File System Access API requires Chrome or Edge.',
      });
      return;
    }

    try {
      // id helps Chrome persist permission grants across reloads.
      // mode: 'readwrite' enables saving edits back to disk.
      const handle = await window.showDirectoryPicker({
        id: 'project-folder',
        mode: 'readwrite',
      });
      await loadTree(handle);
      await persistHandle(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Chrome uses AbortError for both user-cancel and permission denial.
        // Don't toast on genuine cancels — but log so devs can diagnose.
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to open directory';
      setError(message);
      toast.error('Failed to open folder', { description: message });
    }
  }, [loadTree]);

  const readFile = useCallback(async (node: FileNode): Promise<string> => {
    const handle = node.handle;
    if (handle?.kind !== 'file') {
      throw new Error('No file handle available');
    }

    const file = await handle.getFile();
    return file.text();
  }, []);

  const writeFile = useCallback(async (node: FileNode, content: string): Promise<boolean> => {
    const handle = node.handle;
    if (handle?.kind !== 'file') return false;

    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err) {
      console.error('[useFileSystem] writeFile failed:', err);
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
    void clearPersistedHandle();
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
