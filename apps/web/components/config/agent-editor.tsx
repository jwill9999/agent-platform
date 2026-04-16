'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Agent, AgentCreateBody, Skill, McpServer } from '@agent-platform/contracts';
import { apiGet, apiPost, apiPut, apiPath, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const PROVIDERS = ['openai', 'anthropic', 'ollama'] as const;

interface AgentEditorProps {
  agent?: Agent;
  onCancel: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  maxSteps: number;
  maxParallelTasks: number;
  timeoutMs: number;
  selectedSkillIds: string[];
  selectedToolIds: string[];
  selectedMcpServerIds: string[];
}

function buildInitialState(agent?: Agent): FormState {
  return {
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    systemPrompt: agent?.systemPrompt ?? 'You are a helpful assistant.',
    provider: agent?.modelOverride?.provider ?? '',
    model: agent?.modelOverride?.model ?? '',
    maxSteps: agent?.executionLimits.maxSteps ?? 10,
    maxParallelTasks: agent?.executionLimits.maxParallelTasks ?? 2,
    timeoutMs: agent?.executionLimits.timeoutMs ?? 60_000,
    selectedSkillIds: agent?.allowedSkillIds ?? [],
    selectedToolIds: agent?.allowedToolIds ?? [],
    selectedMcpServerIds: agent?.allowedMcpServerIds ?? [],
  };
}

export function AgentEditor({ agent, onCancel, onSaved }: Readonly<AgentEditorProps>) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(agent));
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      apiGet<Skill[]>(apiPath('skills')).then((d) => setSkills(d ?? [])),
      apiGet<McpServer[]>(apiPath('mcp-servers')).then((d) => setMcpServers(d ?? [])),
    ]).catch(() => {
      /* ignore — lists may be empty */
    });
  }, []);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleArrayItem = useCallback((key: 'selectedSkillIds' | 'selectedMcpServerIds', id: string) => {
    setForm((prev) => {
      const current = prev[key];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      return { ...prev, [key]: next };
    });
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.systemPrompt.trim()) {
      setError('System prompt is required');
      return;
    }

    setSaving(true);
    try {
      const modelOverride =
        form.provider && form.model ? { provider: form.provider, model: form.model } : undefined;

      const body: AgentCreateBody = {
        name: form.name.trim(),
        systemPrompt: form.systemPrompt.trim(),
        description: form.description.trim() || undefined,
        allowedSkillIds: form.selectedSkillIds,
        allowedToolIds: form.selectedToolIds,
        allowedMcpServerIds: form.selectedMcpServerIds,
        executionLimits: {
          maxSteps: form.maxSteps,
          maxParallelTasks: form.maxParallelTasks,
          timeoutMs: form.timeoutMs,
        },
        modelOverride,
      };

      if (agent) {
        await apiPut(apiPath('agents', agent.id), body);
      } else {
        await apiPost(apiPath('agents'), body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [form, agent, onSaved]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {agent ? 'Edit Agent' : 'New Agent'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {agent ? `Editing ${agent.name}` : 'Create a new AI agent'}
          </p>
        </div>
        <Button onClick={() => { handleSave(); }} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {agent ? 'Update' : 'Create'}
        </Button>
      </header>

      {/* Error */}
      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Basic Info */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Basic Information</h2>

            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                placeholder="My Agent"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-desc">Description</Label>
              <Input
                id="agent-desc"
                placeholder="A short description of what this agent does"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-prompt">System Prompt</Label>
              <Textarea
                id="agent-prompt"
                rows={6}
                placeholder="You are a helpful assistant..."
                value={form.systemPrompt}
                onChange={(e) => setField('systemPrompt', e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </section>

          {/* Model Override */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Model Override</h2>
            <p className="text-sm text-muted-foreground">
              Leave blank to use the platform default model.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-provider">Provider</Label>
                <select
                  id="agent-provider"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
                  value={form.provider}
                  onChange={(e) => setField('provider', e.target.value)}
                >
                  <option value="">None (use default)</option>
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-model">Model</Label>
                <Input
                  id="agent-model"
                  placeholder="e.g. gpt-4o"
                  value={form.model}
                  onChange={(e) => setField('model', e.target.value)}
                  disabled={!form.provider}
                />
              </div>
            </div>
          </section>

          {/* Execution Limits */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Execution Limits</h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-steps">Max Steps</Label>
                <Input
                  id="agent-steps"
                  type="number"
                  min={1}
                  max={100}
                  value={form.maxSteps}
                  onChange={(e) => setField('maxSteps', Number.parseInt(e.target.value, 10) || 10)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-parallel">Parallel Tasks</Label>
                <Input
                  id="agent-parallel"
                  type="number"
                  min={1}
                  max={10}
                  value={form.maxParallelTasks}
                  onChange={(e) => setField('maxParallelTasks', Number.parseInt(e.target.value, 10) || 2)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-timeout">Timeout (ms)</Label>
                <Input
                  id="agent-timeout"
                  type="number"
                  min={1000}
                  step={1000}
                  value={form.timeoutMs}
                  onChange={(e) => setField('timeoutMs', Number.parseInt(e.target.value, 10) || 60_000)}
                />
              </div>
            </div>
          </section>

          {/* Skills */}
          {skills.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-foreground">Skills</h2>
              <div className="space-y-2">
                {skills.map((skill) => (
                  <label
                    key={skill.id}
                    aria-label={skill.name}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={form.selectedSkillIds.includes(skill.id)}
                      onChange={() => toggleArrayItem('selectedSkillIds', skill.id)}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{skill.name}</p>
                      <p className="text-xs text-muted-foreground">{skill.goal}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* MCP Servers */}
          {mcpServers.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-foreground">MCP Servers</h2>
              <div className="space-y-2">
                {mcpServers.map((server) => (
                  <label
                    key={server.id}
                    aria-label={server.name}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={form.selectedMcpServerIds.includes(server.id)}
                      onChange={() => toggleArrayItem('selectedMcpServerIds', server.id)}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{server.name}</p>
                      <p className="text-xs text-muted-foreground">{server.transport}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
