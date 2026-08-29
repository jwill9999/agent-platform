'use client';

import { useRef, useEffect, useCallback, type ReactNode } from 'react';
import type { UIMessage } from 'ai';
import { Sparkles } from 'lucide-react';
import { Message, getMessageText } from './message';
import { ChatInput } from './chat-input';
import { SensorStatusPanel } from './sensor-status-panel';
import type { AttachmentEntry } from '@/hooks/use-context-attachments';
import type { CriticEvent } from '@/lib/critic-events';
import type { ApprovalCardState, ApprovalDecision, ToolTraceEvent } from '@/hooks/use-harness-chat';
import type { SensorDashboardResponse } from '@agent-platform/contracts';
import type { WorkspaceEvent } from '@agent-platform/contracts';
import { WorkspaceResourcePreviewProvider } from './workspace-resource-cards';

export interface ChatProps {
  messages: UIMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  inputPlaceholder?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
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
  /** Tool execution events keyed by assistant message id. */
  toolEventsByMessage?: Record<string, readonly ToolTraceEvent[]>;
  /** Workspace resource events keyed by assistant message id. */
  workspaceEventsByMessage?: Record<string, readonly WorkspaceEvent[]>;
  /** Project id used to route assistant Markdown links into the desktop WebView panel. */
  workspaceWebViewProjectId?: string | null;
  /** Approval requests keyed by assistant message id. */
  approvalEventsByMessage?: Record<string, readonly ApprovalCardState[]>;
  /** User decision handler for approval requests. */
  onApprovalDecision?: (approvalRequestId: string, decision: ApprovalDecision) => void;
  /** Session-scoped sensor status, kept outside the chat transcript. */
  showSensors?: boolean;
  sensorDashboard?: SensorDashboardResponse | null;
  sensorLoading?: boolean;
  sensorError?: string | null;
  onRetrySensors?: () => void;
  /** Optional Project/session review content rendered in the main chat column. */
  conversationAccessory?: ReactNode;
  /** Optional dock rendered below the composer without entering the chat transcript. */
  bottomAccessory?: ReactNode;
  /** Optional right-side operational panel rendered outside the chat transcript. */
  sideAccessory?: ReactNode;
  /** Optional control rendered beside the composer agent/model selectors. */
  inputSelectorAccessory?: ReactNode;
  /** Resets the transcript scroll position when the logical chat changes. */
  resetKey?: string;
}

export function Chat({
  messages,
  onSend,
  isLoading,
  inputPlaceholder,
  emptyStateTitle,
  emptyStateDescription,
  canSend = true,
  inputStatusText,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  onClearAttachments,
  attachmentWarnings,
  criticEventsByMessage,
  thinkingByMessage,
  toolEventsByMessage,
  workspaceEventsByMessage,
  workspaceWebViewProjectId,
  approvalEventsByMessage,
  onApprovalDecision,
  showSensors = true,
  sensorDashboard,
  sensorLoading,
  sensorError,
  onRetrySensors,
  conversationAccessory,
  bottomAccessory,
  sideAccessory,
  inputSelectorAccessory,
  resetKey,
}: Readonly<ChatProps>) {
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const scrollContainer = messagesScrollRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, approvalEventsByMessage, workspaceEventsByMessage, scrollToBottom]);

  useEffect(() => {
    const firstFrame = requestAnimationFrame(() => {
      scrollToBottom('auto');
      requestAnimationFrame(() => scrollToBottom('auto'));
    });
    return () => cancelAnimationFrame(firstFrame);
  }, [resetKey, scrollToBottom]);

  return (
    <WorkspaceResourcePreviewProvider
      scopeKey={resetKey ?? workspaceWebViewProjectId ?? 'general-chat'}
      projectId={workspaceWebViewProjectId ?? undefined}
    >
      <div className="grid h-full max-h-full min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] overflow-hidden bg-gradient-to-b from-background to-secondary/20">
        <div className="grid h-full max-h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden">
          {/* Messages */}
          <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto min-h-full max-w-3xl px-4 pb-8">
              {messages.length === 0 ? (
                <>
                  <EmptyState title={emptyStateTitle} description={emptyStateDescription} />
                  {conversationAccessory}
                </>
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
                        message.role === 'assistant'
                          ? criticEventsByMessage?.[message.id]
                          : undefined
                      }
                      thinking={
                        message.role === 'assistant' ? thinkingByMessage?.[message.id] : undefined
                      }
                      toolEvents={
                        message.role === 'assistant' ? toolEventsByMessage?.[message.id] : undefined
                      }
                      workspaceEvents={
                        message.role === 'assistant'
                          ? workspaceEventsByMessage?.[message.id]
                          : undefined
                      }
                      workspaceWebViewProjectId={
                        message.role === 'assistant' ? workspaceWebViewProjectId : null
                      }
                      approvals={
                        message.role === 'assistant'
                          ? approvalEventsByMessage?.[message.id]
                          : undefined
                      }
                      onApprovalDecision={onApprovalDecision}
                    />
                  ))}
                  {conversationAccessory}
                  <div ref={messagesEndRef} className="h-4" />
                </>
              )}
            </div>
          </div>

          {/* Input */}
          <ChatInput
            onSend={onSend}
            isLoading={isLoading}
            placeholder={inputPlaceholder}
            canSend={canSend}
            statusText={inputStatusText}
            attachments={attachments}
            onAddFiles={onAddFiles}
            onRemoveAttachment={onRemoveAttachment}
            onClearAttachments={onClearAttachments}
            attachmentWarnings={attachmentWarnings}
            selectorAccessory={inputSelectorAccessory}
          />

          {bottomAccessory}
        </div>

        {sideAccessory}

        {showSensors && (
          <SensorStatusPanel
            dashboard={sensorDashboard ?? null}
            loading={sensorLoading}
            error={sensorError}
            onRetry={onRetrySensors}
          />
        )}
      </div>
    </WorkspaceResourcePreviewProvider>
  );
}

function EmptyState({
  title = 'AI Studio',
  description = 'Send a message to begin chatting with the AI assistant',
}: Readonly<{
  title?: string;
  description?: string;
}>) {
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
      <h2 className="text-2xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-md leading-relaxed">{description}</p>
    </div>
  );
}
