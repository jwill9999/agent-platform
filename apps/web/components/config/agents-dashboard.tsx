'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Agent } from '@agent-platform/contracts';
import { apiGet, apiDelete, apiPost, apiPath, ApiRequestError } from '@/lib/apiClient';
import { AgentCard } from './agent-card';
import { AgentEditor } from './agent-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Bot, Loader2 } from 'lucide-react';

export function AgentsDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Agent[]>(apiPath('agents'));
      setAgents(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(`Delete this agent?`)) return;
      setError(null);
      try {
        await apiDelete(apiPath('agents', id));
        await load();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      }
    },
    [load],
  );

  const handleDuplicate = useCallback(
    async (agent: Agent) => {
      setError(null);
      try {
        const { name, systemPrompt, description, allowedSkillIds, allowedToolIds, allowedMcpServerIds, executionLimits, modelOverride, contextWindow, pluginAllowlist, pluginDenylist } = agent;
        await apiPost(apiPath('agents'), { name: `${name} (Copy)`, systemPrompt, description, allowedSkillIds, allowedToolIds, allowedMcpServerIds, executionLimits, modelOverride, contextWindow, pluginAllowlist, pluginDenylist });
        await load();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      }
    },
    [load],
  );

  const handleSaved = useCallback(async () => {
    setEditing(null);
    await load();
  }, [load]);

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agent.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (editing !== null) {
    return (
      <AgentEditor
        agent={editing === 'new' ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Agents</h1>
          <p className="text-sm text-muted-foreground">Configure and manage your AI agents</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Agent
        </Button>
      </header>

      {/* Search */}
      <div className="px-6 py-4 border-b border-border">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">No agents found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? 'Try a different search term'
                : 'Get started by creating your first agent'}
            </p>
            {!searchQuery && (
              <Button variant="outline" onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={() => setEditing(agent)}
                onDelete={() => void handleDelete(agent.id)}
                onDuplicate={() => void handleDuplicate(agent)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
