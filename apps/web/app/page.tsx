'use client';

import type { Agent, SessionRecord } from '@agent-platform/contracts';
import { useCallback, useEffect, useState } from 'react';
import { Chat } from '../components/chat/chat';
import { ChatAgentSelector } from '../components/chat/chat-agent-selector';
import { SessionHistoryPanel } from '../components/chat/session-history-panel';
import { useHarnessChat } from '@/hooks/use-harness-chat';
import { useContextAttachments } from '@/hooks/use-context-attachments';
import { useSessions } from '@/hooks/use-sessions';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { pickDefaultAgent } from '@/lib/default-agent';

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const { messages, sendMessage, status, error, setError } = useHarnessChat(sessionId, isResuming);
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useSessions();
  const {
    attachments,
    warnings: attachmentWarnings,
    formattedContext,
    addFiles,
    removeAttachment,
    clearAll: clearAttachments,
  } = useContextAttachments();

  const bootstrapAgents = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await apiGet<Agent[]>(apiPath('agents'));
      const next = list ?? [];
      setAgents(next);
      const def = pickDefaultAgent(next);
      if (def) {
        setSelectedAgentId((prev) => prev ?? def.id);
      }
    } catch (e) {
      setLoadError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    bootstrapAgents().catch(() => {});
  }, [bootstrapAgents]);

  const createSessionForAgent = useCallback(async (agentId: string) => {
    setSessionError(null);
    setIsResuming(false);
    try {
      const session = await apiPost<SessionRecord>(apiPath('sessions'), {
        agentId,
      });
      if (!session?.id) {
        setSessionError('Failed to create session');
        setSessionId(null);
        return;
      }
      setSessionId(session.id);
    } catch (e) {
      setSessionError(e instanceof ApiRequestError ? e.message : String(e));
      setSessionId(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedAgentId) return;
    // Only create a new session when agent selection changes organically
    // (not via resume, which sets sessionId directly)
    if (!isResuming) {
      createSessionForAgent(selectedAgentId).catch(() => {});
    }
  }, [selectedAgentId, createSessionForAgent, isResuming]);

  const handleAgentChange = useCallback((agentId: string) => {
    setIsResuming(false);
    setSelectedAgentId(agentId);
  }, []);

  const handleSelectSession = useCallback((session: SessionRecord) => {
    setIsResuming(true);
    setSelectedAgentId(session.agentId);
    setSessionId(session.id);
  }, []);

  const handleNewChatForAgent = useCallback(
    (agentId: string) => {
      setIsResuming(false);
      setSelectedAgentId(agentId);
      createSessionForAgent(agentId).catch(() => {});
    },
    [createSessionForAgent],
  );

  const isLoading = status === 'streaming';

  const handleSend = useCallback(
    (text: string) => {
      const messageForApi = formattedContext ? `${formattedContext}\n${text}` : text;
      const displayText = formattedContext ? text : undefined;
      sendMessage(messageForApi, displayText)
        .then(() => refreshSessions())
        .catch(() => {});
      clearAttachments();
    },
    [sendMessage, refreshSessions, formattedContext, clearAttachments],
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Session history panel */}
      <SessionHistoryPanel
        sessions={sessions}
        agents={agents}
        activeSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChatForAgent={handleNewChatForAgent}
        loading={sessionsLoading}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        {(loadError || sessionError || error) && (
          <div className="shrink-0 z-50 bg-destructive/15 border-b border-destructive/30 text-destructive px-4 py-2 text-sm">
            {[loadError, sessionError, error].filter(Boolean).join(' — ')}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                setError(null);
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <ChatAgentSelector
            agents={agents}
            selectedId={selectedAgentId}
            onSelect={handleAgentChange}
            disabled={isLoading}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <Chat
            messages={messages}
            onSend={handleSend}
            isLoading={isLoading}
            canSend={Boolean(sessionId)}
            attachments={attachments}
            onAddFiles={addFiles}
            onRemoveAttachment={removeAttachment}
            onClearAttachments={clearAttachments}
            attachmentWarnings={attachmentWarnings}
          />
        </div>
      </div>
    </div>
  );
}
