'use client';

import type { Agent, SessionRecord } from '@agent-platform/contracts';
import { useCallback, useEffect, useState } from 'react';
import { Chat } from '../components/chat/chat';
import { ChatAgentSelector } from '../components/chat/chat-agent-selector';
import { useHarnessChat } from '@/hooks/use-harness-chat';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { pickDefaultAgent } from '@/lib/default-agent';

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const { messages, sendMessage, status, error, setError } = useHarnessChat(sessionId);

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
    void bootstrapAgents();
  }, [bootstrapAgents]);

  const createSessionForAgent = useCallback(async (agentId: string) => {
    setSessionError(null);
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
    void createSessionForAgent(selectedAgentId);
  }, [selectedAgentId, createSessionForAgent]);

  const handleAgentChange = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
  }, []);

  const isLoading = status === 'streaming';

  const handleSend = useCallback(
    (text: string) => {
      void sendMessage(text);
    },
    [sendMessage],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
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
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card/50">
        <ChatAgentSelector
          agents={agents}
          selectedId={selectedAgentId}
          onSelect={handleAgentChange}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground hidden sm:block">
          Chat runs on the platform harness (agent prompt, skills, MCP allowlists).
        </p>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <Chat messages={messages} onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
