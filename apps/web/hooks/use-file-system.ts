'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

import { fsDebugLog } from '@/lib/fs-debug';

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
  /** True when a folder handle exists in IndexedDB but access must be re-granted (e.g. after refresh). */
  needsFolderReconnect: boolean;
  /** Display name for the reconnect banner (persisted folder). */
  pendingReconnectFolderName: string | null;
  /** Call from a button click to re-request permission and load the persisted folder. */
  reconnectFolder: () => Promise<void>;
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
    req.onerror = () => reject(new Error('Failed to open IndexedDB'));
  });
}

async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Failed to persist handle'));
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
      req.onerror = () => reject(new Error('Failed to load persisted handle'));
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
      tx.onerror = () => reject(new Error('Failed to clear persisted handle'));
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
// Restore logic — extracted to reduce cognitive complexity of the hook
// ---------------------------------------------------------------------------

type RestoreResult = { needsReconnect: true; handle: FileSystemDirectoryHandle } | null;

/** Try to obtain permission for a mode, returning true if granted. */
async function tryPermission(
  h: FSHandleWithPermission,
  mode: 'readwrite' | 'read',
  isCancelled: () => boolean,
): Promise<boolean> {
  const perm = await h.queryPermission({ mode });
  if (isCancelled()) return false;
  if (perm === 'granted') return true;
  if (perm !== 'prompt') return false;
  try {
    const result = await h.requestPermission({ mode });
    if (isCancelled()) return false;
    return result === 'granted';
  } catch {
    fsDebugLog(`restore:requestPermission_${mode}_threw`);
    return false;
  }
}

async function restorePersistedFolder(
  isCancelled: () => boolean,
  loadTree: (handle: FileSystemDirectoryHandle, source: 'restore') => Promise<void>,
): Promise<RestoreResult> {
  fsDebugLog('restore:begin');
  const handle = await loadPersistedHandle();
  if (isCancelled() || !handle) {
    fsDebugLog('restore:no_handle', { hasHandle: Boolean(handle) });
    return null;
  }

  fsDebugLog('restore:idb_hit', handle.name);
  const h = handle as FSHandleWithPermission;

  // Try read/write first, then fall back to read-only
  if (await tryPermission(h, 'readwrite', isCancelled)) {
    if (!isCancelled()) await loadTree(handle, 'restore');
    return null;
  }
  if (isCancelled()) return null;

  if (await tryPermission(h, 'read', isCancelled)) {
    if (!isCancelled()) {
      fsDebugLog('restore:read_only');
      await loadTree(handle, 'restore');
    }
    return null;
  }
  if (isCancelled()) return null;

  // No permission — user must click "Restore folder" (requires user gesture)
  return { needsReconnect: true, handle };
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
  /** Bumps on each loadTree start; only the latest completion may commit state (avoids races with restore vs picker). */
  const loadGenerationRef = useRef(0);
  /**
   * Set when the user completes showDirectoryPicker (this session). Mount-time IndexedDB restore
   * must not call loadTree after this, or it can overwrite the user's new folder with the old handle.
   */
  const userPickedFolderThisSessionRef = useRef(false);
  /** Persisted handle waiting for user gesture (requestPermission) after refresh */
  const pendingRestoreHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [needsFolderReconnect, setNeedsFolderReconnect] = useState(false);
  const [pendingReconnectFolderName, setPendingReconnectFolderName] = useState<string | null>(null);

  const clearReconnectState = useCallback(() => {
    pendingRestoreHandleRef.current = null;
    setNeedsFolderReconnect(false);
    setPendingReconnectFolderName(null);
  }, []);

  const loadTree = useCallback(
    async (handle: FileSystemDirectoryHandle, source: 'restore' | 'picker' | 'refresh') => {
      const generation = ++loadGenerationRef.current;
      fsDebugLog('loadTree:start', { source, generation, name: handle.name });
      setIsLoading(true);
      setError(null);
      try {
        const counter = { count: 0 };
        const tree = await buildTree(handle, '', 0, counter);
        if (generation !== loadGenerationRef.current) {
          fsDebugLog('loadTree:drop_stale_after_build', {
            source,
            generation,
            current: loadGenerationRef.current,
          });
          return;
        }
        fsDebugLog('loadTree:commit', { source, generation, nodes: tree.length });
        setFileTree(tree);
        setRootName(handle.name);
        setIsDirectoryOpen(true);
        rootHandleRef.current = handle;
      } catch (err) {
        if (generation !== loadGenerationRef.current) {
          fsDebugLog('loadTree:error_stale_ignored', { source, generation });
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to read directory';
        fsDebugLog('loadTree:error', { source, generation, message });
        setError(message);
      } finally {
        if (generation === loadGenerationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  // Detect FS Access API support and restore persisted handle on mount.
  // Defer restore by one macrotask so the first paint / user gestures are less likely to race with IDB.
  useEffect(() => {
    let cancelled = false;
    const supported = isFileSystemAccessSupported();
    setIsSupported(supported);
    if (!supported) return;

    const isCancelled = () => cancelled || userPickedFolderThisSessionRef.current;

    const timerId = globalThis.setTimeout(() => {
      if (cancelled) return;
      fsDebugLog('restore:timer_fired');
      restorePersistedFolder(isCancelled, loadTree)
        .then((result) => {
          if (result?.needsReconnect) {
            pendingRestoreHandleRef.current = result.handle;
            setNeedsFolderReconnect(true);
            setPendingReconnectFolderName(result.handle.name);
            fsDebugLog('restore:needs_reconnect_banner', result.handle.name);
          }
        })
        .catch(() => {
          /* restore is best-effort */
        });
    }, 0);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timerId);
    };
  }, [loadTree]);

  const reconnectFolder = useCallback(async () => {
    const handle = pendingRestoreHandleRef.current ?? (await loadPersistedHandle());
    if (!handle) {
      clearReconnectState();
      return;
    }
    if (!isFileSystemAccessSupported()) {
      setError('File System Access API is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    setError(null);
    const h = handle as FSHandleWithPermission;
    try {
      let rw = await h.queryPermission({ mode: 'readwrite' });
      if (rw !== 'granted') {
        rw = await h.requestPermission({ mode: 'readwrite' });
      }
      if (rw === 'granted') {
        userPickedFolderThisSessionRef.current = false;
        await loadTree(handle, 'restore');
        await persistHandle(handle);
        clearReconnectState();
        fsDebugLog('reconnect:ok_readwrite');
        return;
      }

      let r = await h.queryPermission({ mode: 'read' });
      if (r !== 'granted') {
        r = await h.requestPermission({ mode: 'read' });
      }
      if (r === 'granted') {
        userPickedFolderThisSessionRef.current = false;
        await loadTree(handle, 'restore');
        await persistHandle(handle);
        clearReconnectState();
        fsDebugLog('reconnect:ok_read');
        return;
      }

      setError('Permission was not granted. Try Open Folder again.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore folder';
      fsDebugLog('reconnect:error', message);
      setError(message);
    }
  }, [loadTree, clearReconnectState]);

  const openDirectory = useCallback(async () => {
    if (!isFileSystemAccessSupported()) {
      setError('File System Access API is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    try {
      const handle = await globalThis.window.showDirectoryPicker({ mode: 'readwrite' });
      fsDebugLog('picker:resolved', handle.name);
      // Before loadTree: block mount-time restore from applying a stale persisted handle after this.
      userPickedFolderThisSessionRef.current = true;
      await loadTree(handle, 'picker');
      await persistHandle(handle);
      clearReconnectState();
      fsDebugLog('picker:persisted');
    } catch (err) {
      // User cancelled the picker — not an error
      if (err instanceof DOMException && err.name === 'AbortError') {
        fsDebugLog('picker:cancelled');
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to open directory';
      fsDebugLog('picker:error', message);
      setError(message);
    }
  }, [loadTree, clearReconnectState]);

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
    await loadTree(rootHandleRef.current, 'refresh');
  }, [loadTree]);

  const closeDirectory = useCallback(() => {
    setFileTree([]);
    setRootName(null);
    setIsDirectoryOpen(false);
    rootHandleRef.current = null;
    setError(null);
    userPickedFolderThisSessionRef.current = false;
    clearReconnectState();
    void clearPersistedHandle();
  }, [clearReconnectState]);

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
    needsFolderReconnect,
    pendingReconnectFolderName,
    reconnectFolder,
  };
}
