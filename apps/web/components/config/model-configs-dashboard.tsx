'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  ModelConfig,
  ModelConfigCreateBody,
  ModelConfigUpdateBody,
  ModelProvider,
} from '@agent-platform/contracts';
import { ModelProviderSchema } from '@agent-platform/contracts';
import { apiGet, apiPost, apiPut, apiDelete, apiPath, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  KeyRound,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowLeft,
  Save,
  Loader2,
  Plug,
  CheckCircle,
  XCircle,
} from 'lucide-react';

type ProviderOption = {
  id: ModelProvider;
  label: string;
  requiresApiKey: boolean;
  apiMode: string;
};

function providerLabel(provider: string, providers: ProviderOption[]): string {
  return providers.find((entry) => entry.id === provider)?.label ?? provider;
}

function providerBadgeColor(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
    case 'anthropic':
      return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20';
    case 'ollama':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/* ─── Dashboard ─── */

export function ModelConfigsDashboard() {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ModelConfig | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, catalogue] = await Promise.all([
        apiGet<ModelConfig[]>(apiPath('model-configs')),
        apiGet<ProviderOption[]>(apiPath('model-configs', 'providers')),
      ]);
      if (!catalogue?.length) throw new Error('Provider catalogue unavailable');
      setConfigs(data ?? []);
      setProviders(catalogue);
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
      if (
        !confirm('Delete this model config? Agents using it will fall back to env-var resolution.')
      )
        return;
      try {
        await apiDelete(apiPath('model-configs', id));
        await load();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      }
    },
    [load],
  );

  if (editing !== null) {
    return (
      <ModelConfigEditor
        config={editing === 'new' ? undefined : editing}
        providers={providers}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Models &amp; API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Save model configurations with encrypted API keys and assign them to agents
          </p>
        </div>
        <Button onClick={() => setEditing('new')} disabled={!providers.length}>
          <Plus className="h-4 w-4 mr-2" />
          Add Model
        </Button>
      </header>

      {error && (
        <div
          role="alert"
          className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm"
        >
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && configs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <KeyRound className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">No model configs yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add a model config to store provider credentials securely and assign them to agents
            </p>
            <Button
              variant="outline"
              onClick={() => setEditing('new')}
              disabled={!providers.length}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Model
            </Button>
          </div>
        )}

        {!loading && configs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map((cfg) => (
              <ModelConfigCard
                key={cfg.id}
                config={cfg}
                providers={providers}
                onEdit={() => setEditing(cfg)}
                onDelete={() => {
                  handleDelete(cfg.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Card ─── */

interface ModelConfigCardProps {
  config: ModelConfig;
  providers: ProviderOption[];
  onEdit: () => void;
  onDelete: () => void;
}

type TestState = 'idle' | 'testing' | { ok: boolean; latencyMs: number; error?: string };

function ModelConfigCard({ config, providers, onEdit, onDelete }: Readonly<ModelConfigCardProps>) {
  const [testState, setTestState] = useState<TestState>('idle');

  const handleTest = useCallback(async () => {
    setTestState('testing');
    try {
      const result = await apiPost<{ ok: boolean; latencyMs: number; error?: string }>(
        apiPath('model-configs', config.id, 'test'),
        {},
      );
      setTestState(result ?? { ok: false, latencyMs: 0, error: 'No response' });
    } catch {
      setTestState({
        ok: false,
        latencyMs: 0,
        error: 'Connection test could not complete. Check the application and try again.',
      });
    }
  }, [config.id]);

  return (
    <div className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              aria-label={`Actions for ${config.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h3 className="font-semibold text-foreground mb-1">{config.name}</h3>
      <p className="text-sm text-muted-foreground font-mono mb-3">{config.model}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${providerBadgeColor(config.provider)}`}
        >
          {providerLabel(config.provider, providers)}
        </span>
        <Badge variant="outline" className="text-xs">
          {config.hasApiKey ? '🔑 Key stored' : 'No key'}
        </Badge>
      </div>

      {/* Test connection */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            handleTest();
          }}
          disabled={testState === 'testing'}
        >
          {testState === 'testing' ? (
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
          ) : (
            <Plug className="h-3 w-3 mr-1.5" />
          )}
          Test Connection
        </Button>
        {typeof testState === 'object' &&
          (testState.ok ? (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="h-3.5 w-3.5" />
              {testState.latencyMs}ms
            </span>
          ) : (
            <span role="alert" className="flex items-start gap-1 text-xs text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              Failed: {testState.error ?? 'The provider rejected the connection.'}
            </span>
          ))}
      </div>
    </div>
  );
}

/* ─── Editor ─── */

interface ModelConfigEditorProps {
  config?: ModelConfig;
  providers: ProviderOption[];
  onCancel: () => void;
  onSaved: () => void;
}

interface EditorFormState {
  name: string;
  provider: ModelProvider | '';
  baseURL: string;
  model: string;
  apiKey: string;
}

function buildEditorState(providers: ProviderOption[], config?: ModelConfig): EditorFormState {
  return {
    name: config?.name ?? '',
    provider: config?.provider ?? providers[0]?.id ?? '',
    baseURL: config?.baseURL ?? '',
    model: config?.model ?? '',
    apiKey: '',
  };
}

function ModelConfigEditor({
  config,
  providers,
  onCancel,
  onSaved,
}: Readonly<ModelConfigEditorProps>) {
  const [form, setForm] = useState<EditorFormState>(() => buildEditorState(providers, config));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = useCallback(
    <K extends keyof EditorFormState>(key: K, value: EditorFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.model.trim()) {
      setError('Model is required');
      return;
    }
    if (!form.provider) {
      setError('Provider is required');
      return;
    }

    setSaving(true);
    try {
      if (config) {
        const body: ModelConfigUpdateBody = {
          name: form.name.trim(),
          provider: form.provider,
          model: form.model.trim(),
          baseURL: form.baseURL.trim() || null,
          ...(form.apiKey ? { apiKey: form.apiKey } : {}),
        };
        await apiPut(apiPath('model-configs', config.id), body);
      } else {
        const body: ModelConfigCreateBody = {
          name: form.name.trim(),
          provider: form.provider,
          model: form.model.trim(),
          ...(form.baseURL.trim() ? { baseURL: form.baseURL.trim() } : {}),
          ...(form.apiKey ? { apiKey: form.apiKey } : {}),
        };
        await apiPost(apiPath('model-configs'), body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [form, config, onSaved]);

  const selectedProvider = providers.find((entry) => entry.id === form.provider);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50">
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Back to models">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {config ? 'Edit Model Config' : 'Add Model Config'}
          </h1>
          <p className="text-sm text-muted-foreground">
            API keys are encrypted at rest with AES-256-GCM
          </p>
        </div>
        <Button
          onClick={() => {
            handleSave();
          }}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {config ? 'Update' : 'Save'}
        </Button>
      </header>

      {error && (
        <div
          role="alert"
          className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm"
        >
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mc-name">Name</Label>
            <Input
              id="mc-name"
              placeholder="My model configuration"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mc-provider">Provider</Label>
              <select
                id="mc-provider"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
                value={form.provider}
                onChange={(e) => {
                  const value = ModelProviderSchema.parse(e.target.value);
                  setForm((previous) => ({
                    ...previous,
                    provider: value,
                    apiKey: '',
                    baseURL: '',
                  }));
                }}
              >
                {providers.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mc-model">Model</Label>
              <Input
                id="mc-model"
                placeholder="Provider model ID"
                value={form.model}
                onChange={(e) => setField('model', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mc-endpoint">API endpoint (optional)</Label>
            <Input
              id="mc-endpoint"
              value={form.baseURL}
              placeholder="Use provider default"
              aria-describedby="mc-endpoint-help"
              onChange={(e) => setField('baseURL', e.target.value)}
            />
            <p id="mc-endpoint-help" className="text-xs text-muted-foreground">
              A custom endpoint receives this configuration's key. Use HTTPS, or loopback HTTP for a
              local service. For OpenRouter, enter the full provider/model ID in Model.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mc-key">
              API Key
              {selectedProvider && !selectedProvider.requiresApiKey && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (optional for this provider)
                </span>
              )}
              {config?.hasApiKey && config.provider === form.provider && !form.apiKey && (
                <span className="ml-2 text-xs text-muted-foreground">
                  leave blank to keep existing key
                </span>
              )}
            </Label>
            <Input
              id="mc-key"
              type="password"
              placeholder={
                config?.hasApiKey && config.provider === form.provider
                  ? '••••••••••••••••'
                  : 'Provider API key'
              }
              value={form.apiKey}
              onChange={(e) => setField('apiKey', e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Keys are encrypted with AES-256-GCM before storage and never returned by the API.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
