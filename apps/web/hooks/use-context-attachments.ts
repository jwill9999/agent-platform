'use client';

import { useState, useMemo, useCallback } from 'react';
import type { FileContextEntry, SanitiseResult } from '@/lib/file-context';
import { sanitiseFileContext, formatFileContext, MAX_FILE_COUNT } from '@/lib/file-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttachmentEntry {
  /** Display name (filename or snippet label). */
  name: string;
  /** File content (text). */
  content: string;
  /** Whether this is a text snippet (vs a file). */
  isSnippet?: boolean;
}

export interface UseContextAttachments {
  /** Currently attached entries. */
  attachments: AttachmentEntry[];
  /** Sanitisation warnings (file too large, bad extension, etc.). */
  warnings: string[];
  /** Pre-formatted context block ready to prepend to a message (empty string if none). */
  formattedContext: string;
  /** Number of valid files that will be sent. */
  validFileCount: number;
  /** Add files selected via file picker or drop. */
  addFiles: (files: File[]) => Promise<void>;
  /** Add a raw text snippet. */
  addSnippet: (text: string, label?: string) => void;
  /** Remove an attachment by index. */
  removeAttachment: (index: number) => void;
  /** Clear all attachments. */
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let snippetCounter = 0;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function toFileContextEntries(attachments: AttachmentEntry[]): FileContextEntry[] {
  return attachments.map((a) => ({
    file: a.name,
    code: a.content,
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContextAttachments(): UseContextAttachments {
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([]);

  const sanitised: SanitiseResult = useMemo(
    () => sanitiseFileContext(toFileContextEntries(attachments)),
    [attachments],
  );

  const formattedContext = useMemo(() => formatFileContext(sanitised.files), [sanitised.files]);

  const addFiles = useCallback(async (files: File[]) => {
    const entries: AttachmentEntry[] = [];
    for (const file of files) {
      try {
        const content = await readFileAsText(file);
        entries.push({ name: file.name, content, isSnippet: false });
      } catch {
        // Skip unreadable files silently — sanitise will catch issues
      }
    }
    setAttachments((prev) => {
      const combined = [...prev, ...entries];
      // Respect the max file count early to avoid confusing UX
      return combined.slice(0, MAX_FILE_COUNT);
    });
  }, []);

  const addSnippet = useCallback((text: string, label?: string) => {
    if (!text.trim()) return;
    snippetCounter += 1;
    const name = label?.trim() || `snippet-${snippetCounter}.txt`;
    setAttachments((prev) => {
      if (prev.length >= MAX_FILE_COUNT) return prev;
      return [...prev, { name, content: text, isSnippet: true }];
    });
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    warnings: sanitised.warnings,
    formattedContext,
    validFileCount: sanitised.files.length,
    addFiles,
    addSnippet,
    removeAttachment,
    clearAll,
  };
}
