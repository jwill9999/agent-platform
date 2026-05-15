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
  /** Attachment category used to avoid parsing binary files as text. */
  kind: 'text' | 'image' | 'unsupported';
  /** File content for text attachments. */
  content?: string;
  /** Browser-reported MIME type, when available. */
  mimeType?: string;
  /** Browser-reported size in bytes, when available. */
  sizeBytes?: number;
  /** Whether this is a text snippet (vs a file). */
  isSnippet?: boolean;
}

interface AttachmentDraft {
  name: string;
  type?: string;
  size?: number;
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

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const UNSUPPORTED_BINARY_EXTENSIONS = new Set([
  '7z',
  'avif',
  'bin',
  'bmp',
  'dmg',
  'doc',
  'docx',
  'exe',
  'heic',
  'ico',
  'mov',
  'mp3',
  'mp4',
  'pdf',
  'ppt',
  'pptx',
  'psd',
  'rar',
  'tif',
  'tiff',
  'wav',
  'xls',
  'xlsx',
  'zip',
]);

function readFileAsText(file: File): Promise<string> {
  return file.text();
}

function toFileContextEntries(attachments: AttachmentEntry[]): FileContextEntry[] {
  return attachments
    .filter((a) => a.kind === 'text')
    .map((a) => ({
      file: a.name,
      code: a.content ?? '',
    }));
}

function extensionFromName(name: string): string {
  const base = name.split('/').pop()?.split('\\').pop() ?? name;
  const dotIndex = base.lastIndexOf('.');
  return dotIndex >= 0 ? base.slice(dotIndex + 1).toLowerCase() : '';
}

function isImageFile(file: AttachmentDraft): boolean {
  const mime = file.type?.toLowerCase() ?? '';
  return mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extensionFromName(file.name));
}

function isKnownUnsupportedBinary(file: AttachmentDraft): boolean {
  const mime = file.type?.toLowerCase() ?? '';
  return (
    mime.startsWith('application/octet-stream') ||
    mime.startsWith('audio/') ||
    mime.startsWith('video/') ||
    UNSUPPORTED_BINARY_EXTENSIONS.has(extensionFromName(file.name))
  );
}

export function classifyAttachmentFile(file: AttachmentDraft): AttachmentEntry['kind'] {
  if (isImageFile(file)) return 'image';
  if (isKnownUnsupportedBinary(file)) return 'unsupported';
  return 'text';
}

function formatBytes(bytes: number | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return 'unknown size';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatImageAttachmentContext(attachments: AttachmentEntry[]): string {
  const images = attachments.filter((attachment) => attachment.kind === 'image');
  if (images.length === 0) return '';
  const lines = images.map((attachment) => {
    const details = [attachment.mimeType || 'image', formatBytes(attachment.sizeBytes)].join(', ');
    return `- ${attachment.name} (${details})`;
  });
  return [
    '<attachment_context>',
    'The user attached these image files. The current chat runtime keeps binary image content as an attachment and does not parse it as text:',
    ...lines,
    '</attachment_context>',
    '',
  ].join('\n');
}

export function unsupportedAttachmentWarnings(attachments: AttachmentEntry[]): string[] {
  return attachments
    .filter((attachment) => attachment.kind === 'unsupported')
    .map(
      (attachment) =>
        `"${attachment.name}" is attached but cannot be sent as chat context in this version.`,
    );
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

  const warnings = useMemo(
    () => [...sanitised.warnings, ...unsupportedAttachmentWarnings(attachments)],
    [attachments, sanitised.warnings],
  );

  const formattedContext = useMemo(
    () => [formatFileContext(sanitised.files), formatImageAttachmentContext(attachments)].join(''),
    [attachments, sanitised.files],
  );

  const addFiles = useCallback(async (files: File[]) => {
    const entries: AttachmentEntry[] = [];
    for (const file of files) {
      const baseEntry = {
        name: file.name,
        mimeType: file.type || undefined,
        sizeBytes: file.size,
        isSnippet: false,
      } satisfies Omit<AttachmentEntry, 'kind' | 'content'>;
      const kind = classifyAttachmentFile(file);
      if (kind === 'image') {
        entries.push({ ...baseEntry, kind: 'image' });
        continue;
      }
      if (kind === 'unsupported') {
        entries.push({ ...baseEntry, kind: 'unsupported' });
        continue;
      }
      try {
        const content = await readFileAsText(file);
        entries.push({ ...baseEntry, kind: 'text', content });
      } catch {
        entries.push({ ...baseEntry, kind: 'unsupported' });
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
      return [
        ...prev,
        { name, kind: 'text', content: text, isSnippet: true, mimeType: 'text/plain' },
      ];
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
    warnings,
    formattedContext,
    validFileCount: sanitised.files.length,
    addFiles,
    addSnippet,
    removeAttachment,
    clearAll,
  };
}
