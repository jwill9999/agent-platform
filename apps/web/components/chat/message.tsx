'use client';

import { cn } from '@/lib/cn';
import { User, Sparkles } from 'lucide-react';
import type { UIMessage } from 'ai';
import { Markdown } from './markdown';

interface MessageProps {
  message: UIMessage;
}

function getMessageText(message: UIMessage): string {
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

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';
  const text = getMessageText(message);

  return (
    <div className={cn('flex gap-3 py-6', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-card border border-border rounded-bl-md',
        )}
      >
        {text ? (
          isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
          ) : (
            <Markdown content={text} />
          )
        ) : (
          <p className="text-sm text-muted-foreground italic">Empty message</p>
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
