'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { UIMessage } from 'ai';
import { Sparkles } from 'lucide-react';
import { Message, getMessageText } from './message';
import { ChatInput } from './chat-input';
import type { AttachmentEntry } from '@/hooks/use-context-attachments';
import type { CriticEvent } from '@/lib/critic-events';
import type { ApprovalCardState, ApprovalDecision } from '@/hooks/use-harness-chat';

export interface ChatProps {
  messages: UIMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  /** When false, input is disabled until a session id exists. */
  canSend?: boolean;
  /** Optional input helper text shown below the composer. */
  inputStatusText?: string;
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
  /** Critic lifecycle events keyed by assistant message id. */
  criticEventsByMessage?: Record<string, readonly CriticEvent[]>;
  /** Aggregated thinking-channel text keyed by assistant message id. */
  thinkingByMessage?: Record<string, string>;
  /** Approval requests keyed by assistant message id. */
  approvalEventsByMessage?: Record<string, readonly ApprovalCardState[]>;
  /** User decision handler for approval requests. */
  onApprovalDecision?: (approvalRequestId: string, decision: ApprovalDecision) => void;
}

export function Chat({
  messages,
  onSend,
  isLoading,
  canSend = true,
  inputStatusText,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  onClearAttachments,
  attachmentWarnings,
  criticEventsByMessage,
  thinkingByMessage,
  approvalEventsByMessage,
  onApprovalDecision,
}: Readonly<ChatProps>) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, approvalEventsByMessage, scrollToBottom]);

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
                  isStreaming={
                    isLoading && message.role === 'assistant' && index === messages.length - 1
                  }
                  isAwaitingStreamContent={
                    isLoading &&
                    message.role === 'assistant' &&
                    index === messages.length - 1 &&
                    !getMessageText(message).trim()
                  }
                  criticEvents={
                    message.role === 'assistant' ? criticEventsByMessage?.[message.id] : undefined
                  }
                  thinking={
                    message.role === 'assistant' ? thinkingByMessage?.[message.id] : undefined
                  }
                  approvals={
                    message.role === 'assistant' ? approvalEventsByMessage?.[message.id] : undefined
                  }
                  onApprovalDecision={onApprovalDecision}
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
        statusText={inputStatusText}
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
