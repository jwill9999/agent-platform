'use client';

import { cn } from '@/lib/cn';
import { User, Paperclip } from 'lucide-react';
import type { UIMessage } from 'ai';
import { CriticBadges, CriticReviewBlock } from './critic-badges';
import { ThinkingBlock } from './thinking-block';
import { Markdown } from './markdown';
import type { CriticEvent } from '@/lib/critic-events';

interface MessageProps {
  message: UIMessage;
  /** True while this assistant bubble is waiting for the first streamed token. */
  isAwaitingStreamContent?: boolean;
  /** Critic lifecycle events emitted for this assistant message (if any). */
  criticEvents?: readonly CriticEvent[];
  /** Aggregated thinking-channel text for this assistant message (if any). */
  thinking?: string;
  /** True while this assistant turn is still receiving streamed content. */
  isStreaming?: boolean;
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

export function Message({
  message,
  isAwaitingStreamContent = false,
  criticEvents,
  thinking,
  isStreaming = false,
}: Readonly<MessageProps>) {
  const isUser = message.role === 'user';
  const text = getMessageText(message);
  const hasText = Boolean(text.trim());
  const contextFileCount = isUser ? countContextFiles(message.content) : 0;
  const hasCritic = !isUser && criticEvents && criticEvents.length > 0;
  // Find the final accept event for review block
  const finalAccept =
    hasCritic && criticEvents
      ? criticEvents
          .slice()
          .reverse()
          .find((ev) => ev.kind === 'accept')
      : null;
  const hasThinking = !isUser && Boolean(thinking?.trim());
  const showFinalReview = Boolean(finalAccept) && !isStreaming;

  if (!isUser) {
    return (
      <div className="flex justify-start py-6">
        <div className="flex flex-col max-w-[85%] w-full">
          {hasThinking && (
            <ThinkingBlock content={thinking ?? ''} defaultOpen={isAwaitingStreamContent} />
          )}
          {hasText && <Markdown content={text} className="text-sm" />}
          {showFinalReview && finalAccept && <CriticReviewBlock event={finalAccept} />}
          {hasCritic && !finalAccept && <CriticBadges events={criticEvents} />}
          {!hasText && !showFinalReview && !hasCritic && !hasThinking && (
            <span className="sr-only" aria-busy={isAwaitingStreamContent} aria-live="polite">
              Assistant feedback pending
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-3 py-6 justify-end')}>
      <div className="flex flex-col items-end max-w-[85%]">
        <div
          className={cn(
            'w-full rounded-2xl px-4 py-3',
            'bg-primary text-primary-foreground rounded-br-md',
          )}
        >
          {!text && <p className="text-sm text-muted-foreground italic">Empty message</p>}
          {text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>}
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
