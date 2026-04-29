'use client';

import type { Agent, ModelConfig, SessionRecord } from '@agent-platform/contracts';
import { useCallback, useEffect, useState } from 'react';
import { Chat } from '../components/chat/chat';
import { AgentModelProvider } from '../components/chat/agent-model-context';
import { SessionDropdown } from '../components/chat/session-dropdown';
import type { ApprovalDecision } from '@/hooks/use-harness-chat';
import { useHarnessChat } from '@/hooks/use-harness-chat';
import { useContextAttachments } from '@/hooks/use-context-attachments';
import { useSessions } from '@/hooks/use-sessions';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { pickDefaultAgent } from '@/lib/default-agent';
import { resolveChatModelConfigId } from '@/lib/modelSelection';

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedModelConfigId, setSelectedModelConfigId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const {
    messages,
    sendMessage,
    status,
    error,
    setError,
    criticEventsByMessage,
    thinkingByMessage,
    approvalEventsByMessage,
    decideApproval,
    hasPendingApproval,
  } = useHarnessChat(sessionId, isResuming);
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
      const [agentList, configList] = await Promise.all([
        apiGet<Agent[]>(apiPath('agents')),
        apiGet<ModelConfig[]>(apiPath('model-configs')),
      ]);
      const nextAgents = agentList ?? [];
      setAgents(nextAgents);
      const def = pickDefaultAgent(nextAgents);
      const withKey = (configList ?? []).filter((c) => c.hasApiKey);
      if (def) {
        setSelectedAgentId((prev) => prev ?? def.id);
      }
      // Only show configs that have an API key stored; default to the selected agent's config.
      setModelConfigs(withKey);
      setSelectedModelConfigId((prev) =>
        prev && withKey.some((config) => config.id === prev)
          ? prev
          : resolveChatModelConfigId(def?.id ?? null, nextAgents, withKey),
      );
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

  const handleAgentChange = useCallback(
    (agentId: string) => {
      setIsResuming(false);
      setSelectedAgentId(agentId);
      setSelectedModelConfigId(resolveChatModelConfigId(agentId, agents, modelConfigs));
    },
    [agents, modelConfigs],
  );

  const handleSelectSession = useCallback(
    (session: SessionRecord) => {
      setIsResuming(true);
      setSelectedAgentId(session.agentId);
      setSelectedModelConfigId(resolveChatModelConfigId(session.agentId, agents, modelConfigs));
      setSessionId(session.id);
    },
    [agents, modelConfigs],
  );

  const handleNewChatForAgent = useCallback(
    (agentId: string) => {
      setIsResuming(false);
      setSelectedAgentId(agentId);
      setSelectedModelConfigId(resolveChatModelConfigId(agentId, agents, modelConfigs));
      createSessionForAgent(agentId).catch(() => {});
    },
    [agents, createSessionForAgent, modelConfigs],
  );

  const isLoading = status === 'streaming';
  const canSend = Boolean(sessionId) && !hasPendingApproval;
  const inputStatusText = hasPendingApproval
    ? 'Resolve the pending approval before sending another message.'
    : undefined;

  const handleSend = useCallback(
    (text: string) => {
      const messageForApi = formattedContext ? `${formattedContext}\n${text}` : text;
      const displayText = formattedContext ? text : undefined;
      sendMessage(messageForApi, displayText, selectedModelConfigId)
        .then(() => refreshSessions())
        .catch(() => {});
      clearAttachments();
    },
    [sendMessage, refreshSessions, formattedContext, clearAttachments, selectedModelConfigId],
  );

  const handleApprovalDecision = useCallback(
    (approvalRequestId: string, decision: ApprovalDecision) => {
      decideApproval(approvalRequestId, decision, selectedModelConfigId);
    },
    [decideApproval, selectedModelConfigId],
  );

  return (
    <div className="flex h-full min-h-0">
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
          <SessionDropdown
            sessions={sessions}
            agents={agents}
            activeSessionId={sessionId}
            selectedAgentId={selectedAgentId}
            onSelectSession={handleSelectSession}
            onNewChatForAgent={handleNewChatForAgent}
            loading={sessionsLoading}
            disabled={isLoading}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <AgentModelProvider
            value={{
              agents,
              modelConfigs,
              selectedAgentId,
              selectedModelConfigId,
              onSelectAgent: handleAgentChange,
              onSelectModelConfig: setSelectedModelConfigId,
              selectorDisabled: isLoading,
            }}
          >
            <Chat
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              canSend={canSend}
              inputStatusText={inputStatusText}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              onClearAttachments={clearAttachments}
              attachmentWarnings={attachmentWarnings}
              criticEventsByMessage={criticEventsByMessage}
              thinkingByMessage={thinkingByMessage}
              approvalEventsByMessage={approvalEventsByMessage}
              onApprovalDecision={handleApprovalDecision}
            />
          </AgentModelProvider>
        </div>
      </div>
    </div>
  );
}
