'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { UIMessage } from 'ai';
import { Sparkles } from 'lucide-react';
import { Message, getMessageText } from './message';
import { ChatInput } from './chat-input';
import type { AttachmentEntry } from '@/hooks/use-context-attachments';

export interface ChatProps {
  messages: UIMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  /** When false, input is disabled until a session id exists. */
  canSend?: boolean;
  /** Context attachments (optional — pass to enable attachment UI). */
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

export function Chat({
  messages,
  onSend,
  isLoading,
  canSend = true,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  onClearAttachments,
  attachmentWarnings,
}: Readonly<ChatProps>) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gradient-to-b from-background to-secondary/20">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {messages.map((message, index) => (
                <Message
                  key={message.id}
                  message={message}
                  isAwaitingStreamContent={
                    isLoading &&
                    message.role === 'assistant' &&
                    index === messages.length - 1 &&
                    !getMessageText(message).trim()
                  }
                />
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={onSend}
        isLoading={isLoading}
        canSend={canSend}
        attachments={attachments}
        onAddFiles={onAddFiles}
        onRemoveAttachment={onRemoveAttachment}
        onClearAttachments={onClearAttachments}
        attachmentWarnings={attachmentWarnings}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-200 via-purple-200 to-cyan-200 blur-2xl opacity-80" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-pink-300 via-purple-300 to-cyan-300 blur-xl opacity-60" />
        <div className="absolute inset-8 rounded-full bg-gradient-to-br from-pink-400 via-purple-400 to-cyan-400 blur-lg opacity-40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">AI Studio</h2>
      <p className="text-muted-foreground max-w-md leading-relaxed">
        Send a message to begin chatting with the AI assistant
      </p>
    </div>
  );
}
