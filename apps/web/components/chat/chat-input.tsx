'use client';

import { useState, useRef, useCallback, type KeyboardEvent, type DragEvent } from 'react';
import { Send, Loader2, Paperclip, X, FileText, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AttachmentEntry } from '@/hooks/use-context-attachments';

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
  /** When false, sending is blocked (e.g. session not ready yet). */
  canSend?: boolean;
  /** Attached files/snippets (optional — pass to enable attachment UI). */
  attachments?: AttachmentEntry[];
  /** Callback when user picks or drops files. */
  onAddFiles?: (files: File[]) => Promise<void>;
  /** Remove an attachment by index. */
  onRemoveAttachment?: (index: number) => void;
  /** Clear all attachments. */
  onClearAttachments?: () => void;
  /** Sanitisation warnings from file validation. */
  attachmentWarnings?: string[];
}

export function ChatInput({
  onSend,
  isLoading,
  canSend = true,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  onClearAttachments,
  attachmentWarnings,
}: Readonly<ChatInputProps>) {
  const [input, setInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasAttachments = attachments && attachments.length > 0;
  const hasWarnings = attachmentWarnings && attachmentWarnings.length > 0;

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  const doSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !canSend) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, onSend, canSend]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      doSend();
    },
    [doSend],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    },
    [doSend],
  );

  const handleFilePickerClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && onAddFiles) {
        onAddFiles(Array.from(files)).catch(() => {});
      }
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [onAddFiles],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && onAddFiles) {
        onAddFiles(Array.from(files)).catch(() => {});
      }
    },
    [onAddFiles],
  );

  return (
    <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <section
          aria-label="Chat input and file drop zone"
          className={cn(
            'relative flex flex-col bg-card border rounded-2xl shadow-sm transition-all',
            isDragOver
              ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
              : 'border-border focus-within:ring-2 focus-within:ring-ring/50',
          )}
          onDragOver={onAddFiles ? handleDragOver : undefined}
          onDragLeave={onAddFiles ? handleDragLeave : undefined}
          onDrop={onAddFiles ? handleDrop : undefined}
        >
          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-primary/10 border-2 border-dashed border-primary pointer-events-none">
              <p className="text-sm font-medium text-primary">Drop files to attach</p>
            </div>
          )}

          {/* Attachment chips */}
          {hasAttachments && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-1">
              {attachments.map((att, i) => (
                <span
                  key={`${att.name}-${i}`}
                  className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground rounded-lg px-2 py-1 max-w-[200px]"
                >
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{att.name}</span>
                  {onRemoveAttachment && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(i)}
                      className="flex-shrink-0 hover:text-destructive transition-colors"
                      aria-label={`Remove ${att.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {onClearAttachments && attachments.length > 1 && (
                <button
                  type="button"
                  onClick={onClearAttachments}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="flex items-start gap-1.5 px-4 pt-1 pb-1">
              <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {attachmentWarnings[0]}
                {attachmentWarnings.length > 1 && ` (+${attachmentWarnings.length - 1} more)`}
              </span>
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2 px-4 py-3">
            {/* Attach button */}
            {onAddFiles && (
              <>
                <button
                  type="button"
                  onClick={handleFilePickerClick}
                  disabled={isLoading}
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  aria-label="Attach files"
                  title="Attach files"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                  tabIndex={-1}
                />
              </>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                onAddFiles ? 'Send a message... (drop files to attach)' : 'Send a message...'
              }
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none text-sm leading-relaxed max-h-[200px]"
              rows={1}
              disabled={isLoading || !canSend}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !canSend}
              className={cn(
                'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                input.trim() && !isLoading
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </section>
        <p className="text-xs text-muted-foreground text-center mt-2">
          {canSend
            ? 'Press Enter to send, Shift+Enter for new line'
            : 'Waiting for chat session…'}
        </p>
      </form>
    </div>
  );
}
