'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MemoryRecord, MemoryUpdateBody } from '@agent-platform/contracts';
import { Check, Download, Loader2, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';

import { apiDelete, apiGet, apiPath, apiPost, apiPut, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type MemoryListResponse = {
  items: MemoryRecord[];
  total: number;
  limit: number;
  offset: number;
};

const statusOptions = ['', 'pending', 'approved', 'rejected', 'archived'] as const;
const scopeOptions = ['', 'global', 'project', 'agent', 'session'] as const;

function displayScope(memory: MemoryRecord): string {
  return memory.scopeId ? `${memory.scope}:${memory.scopeId}` : memory.scope;
}

function memoryQueryPath(
  filters: {
    scope: string;
    scopeId: string;
    status: string;
    reviewStatus: string;
    tag: string;
  },
  basePath = apiPath('memories'),
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) params.set(key, value.trim());
  }
  params.set('includeExpired', 'true');
  return `${basePath}?${params.toString()}`;
}

export function MemoryDashboard() {
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    scope: '',
    scopeId: '',
    status: '',
    reviewStatus: '',
    tag: '',
  });
  const [editing, setEditing] = useState<MemoryRecord | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = useMemo(() => memoryQueryPath(filters), [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<MemoryListResponse>(path);
      setMemories(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, [load]);

  const updateFilter = useCallback((key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const beginEdit = useCallback((memory: MemoryRecord) => {
    setEditing(memory);
    setEditContent(memory.content);
    setEditTags(memory.tags.join(', '));
  }, []);

  const reviewMemory = useCallback(
    async (memory: MemoryRecord, decision: 'approved' | 'rejected') => {
      try {
        await apiPost(apiPath('memories', memory.id, 'review'), { decision });
        await load();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      }
    },
    [load],
  );

  const deleteOne = useCallback(
    async (memory: MemoryRecord) => {
      if (!confirm(`Delete memory ${memory.id}?`)) return;
      try {
        await apiDelete(apiPath('memories', memory.id));
        await load();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      }
    },
    [load],
  );

  const saveEdit = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const body: MemoryUpdateBody = {
        content: editContent.trim(),
        tags: editTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      await apiPut(apiPath('memories', editing.id), body);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [editContent, editTags, editing, load]);

  const exportJson = useCallback(async () => {
    try {
      const exportPath = memoryQueryPath(filters, apiPath('memories', 'export'));
      const data = await apiGet<{ exportedAtMs: number; count: number; memories: MemoryRecord[] }>(
        exportPath,
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agent-platform-memories-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, [filters]);

  const clearCurrentScope = useCallback(async () => {
    if (!filters.scope) {
      setError('Choose a scope before clearing memories.');
      return;
    }
    if (filters.scope !== 'global' && !filters.scopeId.trim()) {
      setError('Non-global clear actions require a scope ID.');
      return;
    }
    if (!confirm('Clear memories matching the selected scope and status filters?')) return;
    try {
      await apiPost(apiPath('memories', 'clear'), {
        scope: filters.scope,
        ...(filters.scopeId.trim() ? { scopeId: filters.scopeId.trim() } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.reviewStatus ? { reviewStatus: filters.reviewStatus } : {}),
        includeExpired: true,
        confirm: true,
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, [filters, load]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Memory</h2>
          <p className="text-sm text-muted-foreground">
            Review durable memories, pending candidates, and retention actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportJson}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="destructive" onClick={clearCurrentScope}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Scope
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-5">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Scope</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={filters.scope}
            onChange={(e) => updateFilter('scope', e.target.value)}
          >
            {scopeOptions.map((scope) => (
              <option key={scope || 'any'} value={scope}>
                {scope || 'Any scope'}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Scope ID</span>
          <Input
            value={filters.scopeId}
            onChange={(e) => updateFilter('scopeId', e.target.value)}
            placeholder="session, agent, project"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status || 'any'} value={status}>
                {status || 'Any status'}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Review</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={filters.reviewStatus}
            onChange={(e) => updateFilter('reviewStatus', e.target.value)}
          >
            <option value="">Any review</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="needs_review">Needs review</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Tag</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={filters.tag}
              onChange={(e) => updateFilter('tag', e.target.value)}
              placeholder="candidate"
            />
          </div>
        </label>
      </section>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Showing {memories.length} of {total} memory records
      </div>

      {editing && (
        <section className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-medium text-foreground">Edit memory</h3>
            <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            <Label htmlFor="memory-content">Content</Label>
            <Textarea
              id="memory-content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
            />
            <Label htmlFor="memory-tags">Tags</Label>
            <Input
              id="memory-tags"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="tag-one, tag-two"
            />
            <Button onClick={saveEdit} disabled={saving || !editContent.trim()}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </section>
      )}

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && memories.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          No memory records match these filters.
        </div>
      )}

      {!loading && memories.length > 0 && (
        <div className="space-y-3">
          {memories.map((memory) => (
            <article key={memory.id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{displayScope(memory)}</span>
                    <span>{memory.kind}</span>
                    <span>{memory.status}</span>
                    <span>{memory.reviewStatus}</span>
                    <span>{Math.round(memory.confidence * 100)}%</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {memory.content}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => beginEdit(memory)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      reviewMemory(memory, 'approved').catch((e: unknown) => {
                        setError(e instanceof ApiRequestError ? e.message : String(e));
                      });
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      reviewMemory(memory, 'rejected').catch((e: unknown) => {
                        setError(e instanceof ApiRequestError ? e.message : String(e));
                      });
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      deleteOne(memory).catch((e: unknown) => {
                        setError(e instanceof ApiRequestError ? e.message : String(e));
                      });
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
              <dl className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                <div>
                  <dt className="font-medium">Source</dt>
                  <dd>{memory.source.label ?? memory.source.kind}</dd>
                </div>
                <div>
                  <dt className="font-medium">Safety</dt>
                  <dd>{memory.safetyState}</dd>
                </div>
                <div>
                  <dt className="font-medium">Expires</dt>
                  <dd>
                    {memory.expiresAtMs ? new Date(memory.expiresAtMs).toLocaleString() : 'Never'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Tags</dt>
                  <dd>{memory.tags.length ? memory.tags.join(', ') : 'None'}</dd>
                </div>
              </dl>
              {Object.keys(memory.source.metadata).length > 0 && (
                <details className="mt-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium">Source metadata</summary>
                  <pre className="mt-2 overflow-auto rounded-md bg-muted p-2">
                    {JSON.stringify(memory.source.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
