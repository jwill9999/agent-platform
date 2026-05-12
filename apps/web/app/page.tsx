'use client';

import type {
  Agent,
  ModelConfig,
  ProjectMode,
  SensorDashboardResponse,
  SessionRecord,
} from '@agent-platform/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Chat } from '../components/chat/chat';
import { AgentModelProvider } from '../components/chat/agent-model-context';
import { SessionDropdown } from '../components/chat/session-dropdown';
import type { ApprovalDecision } from '@/hooks/use-harness-chat';
import { useHarnessChat } from '@/hooks/use-harness-chat';
import { useContextAttachments } from '@/hooks/use-context-attachments';
import { useSessions } from '@/hooks/use-sessions';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { pickDefaultAgentForMode } from '@/lib/default-agent';
import { resolveChatModelConfigId } from '@/lib/modelSelection';
import { createWorkspaceNavigationState, workspaceEntryCopy } from '@/lib/project-navigation';

export default function HomePage() {
  const [selectedMode, setSelectedMode] = useState<ProjectMode | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedModelConfigId, setSelectedModelConfigId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sensorDashboard, setSensorDashboard] = useState<SensorDashboardResponse | null>(null);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorError, setSensorError] = useState<string | null>(null);

  const {
    messages,
    sendMessage,
    status,
    error,
    setError,
    criticEventsByMessage,
    thinkingByMessage,
    toolEventsByMessage,
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
      const def = pickDefaultAgentForMode(nextAgents, 'chat');
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

  const refreshSensors = useCallback(async (id: string, retry = false) => {
    setSensorLoading(true);
    setSensorError(null);
    try {
      const path = apiPath('sessions', id, 'sensors');
      const data = retry
        ? await apiPost<SensorDashboardResponse>(`${path}/retry`, {})
        : await apiGet<SensorDashboardResponse>(path);
      setSensorDashboard(data ?? null);
    } catch (e) {
      setSensorError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setSensorLoading(false);
    }
  }, []);

  const createSessionForAgent = useCallback(
    async (agentId: string) => {
      setSessionError(null);
      setIsResuming(false);
      try {
        const session = await apiPost<SessionRecord>(apiPath('sessions'), {
          agentId,
          mode: 'chat',
        });
        if (!session?.id) {
          setSessionError('Failed to create session');
          setSessionId(null);
          setSensorDashboard(null);
          return;
        }
        setSessionId(session.id);
        await refreshSensors(session.id);
      } catch (e) {
        setSessionError(e instanceof ApiRequestError ? e.message : String(e));
        setSessionId(null);
        setSensorDashboard(null);
      }
    },
    [refreshSensors],
  );

  useEffect(() => {
    if (selectedMode !== 'chat') return;
    if (!selectedAgentId) return;
    // Only create a new session when agent selection changes organically
    // (not via resume, which sets sessionId directly)
    if (!isResuming) {
      createSessionForAgent(selectedAgentId).catch(() => {});
    }
  }, [selectedAgentId, createSessionForAgent, isResuming, selectedMode]);

  const handleAgentChange = useCallback(
    (agentId: string) => {
      setIsResuming(false);
      setSelectedAgentId(agentId);
      setSelectedModelConfigId(resolveChatModelConfigId(agentId, agents, modelConfigs));
    },
    [agents, modelConfigs],
  );

  const handleOpenChat = useCallback(() => {
    setSelectedMode('chat');
    const def = pickDefaultAgentForMode(agents, 'chat');
    if (def) {
      setSelectedAgentId(def.id);
      setSelectedModelConfigId(resolveChatModelConfigId(def.id, agents, modelConfigs));
    }
  }, [agents, modelConfigs]);

  const handleSelectSession = useCallback(
    (session: SessionRecord) => {
      setIsResuming(true);
      setSelectedAgentId(session.agentId);
      setSelectedModelConfigId(resolveChatModelConfigId(session.agentId, agents, modelConfigs));
      setSessionId(session.id);
      refreshSensors(session.id).catch(() => {});
    },
    [agents, modelConfigs, refreshSensors],
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
  const navigationState = createWorkspaceNavigationState({
    surface: selectedMode === 'chat' ? 'chat' : 'home',
    sessionId,
  });

  const handleSend = useCallback(
    (text: string) => {
      const messageForApi = formattedContext ? `${formattedContext}\n${text}` : text;
      const displayText = formattedContext ? text : undefined;
      sendMessage(messageForApi, displayText, selectedModelConfigId)
        .then(async () => {
          await refreshSessions();
          if (sessionId) await refreshSensors(sessionId);
        })
        .catch(() => {});
      clearAttachments();
    },
    [
      sendMessage,
      refreshSessions,
      formattedContext,
      clearAttachments,
      selectedModelConfigId,
      sessionId,
      refreshSensors,
    ],
  );

  const handleApprovalDecision = useCallback(
    (approvalRequestId: string, decision: ApprovalDecision) => {
      decideApproval(approvalRequestId, decision, selectedModelConfigId);
    },
    [decideApproval, selectedModelConfigId],
  );

  if (!selectedMode) {
    return (
      <main className="flex h-full min-h-0 flex-col bg-background">
        <section className="border-b border-border px-6 py-5">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-1">
            <h2 className="text-2xl font-semibold text-foreground">
              {workspaceEntryCopy.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {workspaceEntryCopy.description}
            </p>
          </div>
        </section>
        <section className="flex flex-1 items-center px-6 py-8">
          <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
            <button
              type="button"
              className="group flex min-h-44 flex-col items-start justify-between rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary"
              onClick={handleOpenChat}
            >
              <span>
                <span className="block text-lg font-semibold text-foreground">
                  {workspaceEntryCopy.chatTitle}
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                  {workspaceEntryCopy.chatDescription}
                </span>
              </span>
              <span className="text-sm font-medium text-primary">
                {workspaceEntryCopy.chatProfile}
              </span>
            </button>
            <Button
              asChild
              variant="outline"
              className="group flex h-auto min-h-44 flex-col items-start justify-between rounded-lg p-5 text-left"
            >
              <Link href="/ide">
                <span>
                  <span className="block text-lg font-semibold text-foreground">
                    {workspaceEntryCopy.projectTitle}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {workspaceEntryCopy.projectDescription}
                  </span>
                </span>
                <span className="text-sm font-medium text-primary">
                  {workspaceEntryCopy.projectProfile}
                </span>
              </Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

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
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50"
          data-workspace-surface={navigationState.surface}
          data-workspace-scope={navigationState.scope}
        >
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
              toolEventsByMessage={toolEventsByMessage}
              approvalEventsByMessage={approvalEventsByMessage}
              onApprovalDecision={handleApprovalDecision}
              sensorDashboard={sensorDashboard}
              sensorLoading={sensorLoading}
              sensorError={sensorError}
              onRetrySensors={() => {
                if (sessionId) refreshSensors(sessionId, true).catch(() => {});
              }}
            />
          </AgentModelProvider>
        </div>
      </div>
    </div>
  );
}
