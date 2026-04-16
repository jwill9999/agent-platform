'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Tool, ToolCreateBody } from '@agent-platform/contracts';
import { apiGet, apiDelete, apiPost, apiPut, apiPath, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Wrench, MoreVertical, Pencil, Trash2, Copy, ArrowLeft, Save, Loader2 } from 'lucide-react';

/* ─── Dashboard ─── */

export function ToolsDashboard() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<Tool | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Tool[]>(apiPath('tools'));
      setTools(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this tool?')) return;
    try {
      await apiDelete(apiPath('tools', id));
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, [load]);

  const handleDuplicate = useCallback(async (tool: Tool) => {
    try {
      const body: ToolCreateBody = {
        name: `${tool.name} (Copy)`,
        description: tool.description,
        config: tool.config,
      };
      await apiPost(apiPath('tools'), body);
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, [load]);

  const filtered = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (editing !== null) {
    return (
      <ToolEditor
        tool={editing === 'new' ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tools</h1>
          <p className="text-sm text-muted-foreground">Manage tools available to agents</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Tool
        </Button>
      </header>

      <div className="px-6 py-4 border-b border-border">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">No tools found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Register your first tool'}
            </p>
            {!searchQuery && (
              <Button variant="outline" onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Tool
              </Button>
            )}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((tool) => (
              <div
                key={tool.id}
                className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(tool)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { handleDuplicate(tool); }}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { handleDelete(tool.id); }} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <button type="button" onClick={() => setEditing(tool)} className="block text-left w-full">
                  <h3 className="font-semibold text-foreground mb-1">{tool.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tool.description || 'No description'}
                  </p>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Editor ─── */

interface ToolEditorProps {
  tool?: Tool;
  onCancel: () => void;
  onSaved: () => void;
}

function ToolEditor({ tool, onCancel, onSaved }: Readonly<ToolEditorProps>) {
  const [name, setName] = useState(tool?.name ?? '');
  const [description, setDescription] = useState(tool?.description ?? '');
  const [configText, setConfigText] = useState(
    tool?.config ? JSON.stringify(tool.config, null, 2) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }

    let config: Record<string, unknown> | undefined;
    if (configText.trim()) {
      try {
        config = JSON.parse(configText) as Record<string, unknown>;
      } catch {
        setError('Config must be valid JSON');
        return;
      }
    }

    setSaving(true);
    try {
      const body: ToolCreateBody = {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(config ? { config } : {}),
      };

      if (tool) {
        await apiPut(apiPath('tools', tool.id), body);
      } else {
        await apiPost(apiPath('tools'), body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [name, description, configText, tool, onSaved]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {tool ? 'Edit Tool' : 'New Tool'}
          </h1>
        </div>
        <Button onClick={() => { handleSave(); }} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {tool ? 'Update' : 'Create'}
        </Button>
      </header>

      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tool-name">Name</Label>
            <Input id="tool-name" placeholder="my_tool" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tool-desc">Description</Label>
            <Input id="tool-desc" placeholder="What this tool does..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tool-config">Config (JSON, optional)</Label>
            <Textarea
              id="tool-config"
              rows={6}
              placeholder='{"endpoint": "https://...", "timeout": 5000}'
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
