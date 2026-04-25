'use client';

import { cn } from '@/lib/cn';
import { User, Sparkles, Paperclip } from 'lucide-react';
import type { UIMessage } from 'ai';
import { Markdown } from './markdown';

interface MessageProps {
  message: UIMessage;
  /** True while this assistant bubble is waiting for the first streamed token. */
  isAwaitingStreamContent?: boolean;
}

export function getMessageText(message: UIMessage): string {
  const textParts = message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text);

  if (textParts.length > 0) {
    return textParts.join('');
  }

  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content;
  }

  return '';
}

/** Count the number of files referenced in a `<file_context>` block. */
function countContextFiles(content: string): number {
  if (!content.includes('<file_context>')) return 0;
  // Each file starts with "--- path ---"
  const matches = content.match(/^--- .+ ---$/gm);
  return matches?.length ?? 0;
}

export function Message({ message, isAwaitingStreamContent = false }: Readonly<MessageProps>) {
  const isUser = message.role === 'user';
  const text = getMessageText(message);
  const contextFileCount = isUser ? countContextFiles(message.content) : 0;

  return (
    <div className={cn('flex gap-3 py-6', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className="flex flex-col items-end max-w-[85%]">
        <div
          className={cn(
            'w-full rounded-2xl px-4 py-3',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-card border border-border rounded-bl-md',
          )}
        >
          {!text && isUser && (
            <p className="text-sm text-muted-foreground italic">Empty message</p>
          )}
          {!text && !isUser && isAwaitingStreamContent && (
            <span className="sr-only" aria-busy="true" aria-live="polite">
              Assistant is responding
            </span>
          )}
          {!text && !isUser && !isAwaitingStreamContent && (
            <p className="text-sm text-muted-foreground italic">No content</p>
          )}
          {text && isUser && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
          )}
          {text && !isUser && <Markdown content={text} />}
        </div>
        {contextFileCount > 0 && (
          <span className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            {contextFileCount} {contextFileCount === 1 ? 'file' : 'files'} attached
          </span>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
