'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MemoryRecord, MemoryUpdateBody } from '@agent-platform/contracts';
import { Check, Download, Loader2, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';

import { apiDelete, apiGet, apiPath, apiPost, apiPut, ApiRequestError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
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

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function displayScope(memory: MemoryRecord): string {
  return memory.scopeId ? `${memory.scope}:${memory.scopeId}` : memory.scope;
}

function statusBadgeClass(status: MemoryRecord['status']): string {
  switch (status) {
    case 'approved':
      return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    case 'pending':
      return 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300';
    case 'rejected':
      return 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300';
    case 'archived':
      return 'border-slate-500/40 bg-slate-500/15 text-slate-700 dark:text-slate-300';
  }
}

function reviewBadgeClass(reviewStatus: MemoryRecord['reviewStatus']): string {
  switch (reviewStatus) {
    case 'approved':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'unreviewed':
    case 'needs_review':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'rejected':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
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
  const [busyMemoryId, setBusyMemoryId] = useState<string | null>(null);

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
      setBusyMemoryId(memory.id);
      try {
        await apiPost(apiPath('memories', memory.id, 'review'), { decision });
        await load();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      } finally {
        setBusyMemoryId(null);
      }
    },
    [load],
  );

  const deleteOne = useCallback(
    async (memory: MemoryRecord) => {
      if (!confirm(`Delete memory ${memory.id}?`)) return;
      setBusyMemoryId(memory.id);
      try {
        await apiDelete(apiPath('memories', memory.id));
        await load();
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : String(e));
      } finally {
        setBusyMemoryId(null);
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
          {memories.map((memory) => {
            const isBusy = busyMemoryId === memory.id;
            const isApproved = memory.status === 'approved' && memory.reviewStatus === 'approved';
            const isRejected = memory.status === 'rejected' || memory.reviewStatus === 'rejected';

            return (
              <article
                key={memory.id}
                className={cn(
                  'rounded-lg border bg-card p-4 shadow-sm transition-colors',
                  isBusy ? 'border-primary/50 bg-primary/5' : 'border-border',
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'px-3 py-1 text-sm font-semibold',
                          statusBadgeClass(memory.status),
                        )}
                      >
                        {titleCase(memory.status)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          'px-2.5 py-1 text-xs font-semibold',
                          reviewBadgeClass(memory.reviewStatus),
                        )}
                      >
                        {titleCase(memory.reviewStatus)}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground">
                        {Math.round(memory.confidence * 100)}% confidence
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {memory.content}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => beginEdit(memory)}
                      disabled={isBusy}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={isApproved ? 'secondary' : 'outline'}
                      className={cn(
                        'border-emerald-500/40 hover:border-emerald-600 hover:bg-emerald-500/15 hover:text-emerald-700 active:bg-emerald-500/25 dark:hover:text-emerald-300',
                        isApproved && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                      )}
                      disabled={isBusy || isApproved}
                      onClick={() => {
                        reviewMemory(memory, 'approved').catch((e: unknown) => {
                          setError(e instanceof ApiRequestError ? e.message : String(e));
                        });
                      }}
                    >
                      {isBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant={isRejected ? 'secondary' : 'outline'}
                      className={cn(
                        'border-rose-500/40 hover:border-rose-600 hover:bg-rose-500/15 hover:text-rose-700 active:bg-rose-500/25 dark:hover:text-rose-300',
                        isRejected && 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
                      )}
                      disabled={isBusy || isRejected}
                      onClick={() => {
                        reviewMemory(memory, 'rejected').catch((e: unknown) => {
                          setError(e instanceof ApiRequestError ? e.message : String(e));
                        });
                      }}
                    >
                      {isBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <X className="mr-2 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isBusy}
                      className="active:bg-destructive/80"
                      onClick={() => {
                        deleteOne(memory).catch((e: unknown) => {
                          setError(e instanceof ApiRequestError ? e.message : String(e));
                        });
                      }}
                    >
                      {isBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 rounded-md bg-muted/35 p-3 text-xs text-muted-foreground md:grid-cols-4">
                  <div>
                    <dt className="font-medium text-foreground">Scope</dt>
                    <dd className="mt-1 break-all">{displayScope(memory)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Kind</dt>
                    <dd className="mt-1">{titleCase(memory.kind)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Source</dt>
                    <dd className="mt-1">{memory.source.label ?? memory.source.kind}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Safety</dt>
                    <dd className="mt-1">{titleCase(memory.safetyState)}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Expires:{' '}
                    {memory.expiresAtMs ? new Date(memory.expiresAtMs).toLocaleString() : 'Never'}
                  </span>
                  {memory.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {memory.tags.length === 0 && <span>No tags</span>}
                </div>

                {Object.keys(memory.source.metadata).length > 0 && (
                  <details className="mt-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium">Source metadata</summary>
                    <pre className="mt-2 overflow-auto rounded-md bg-muted p-2">
                      {JSON.stringify(memory.source.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
