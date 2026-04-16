'use client';

import { useCallback, useEffect, useState } from 'react';
import type { McpServer, McpServerCreateBody } from '@agent-platform/contracts';
import { apiGet, apiDelete, apiPost, apiPut, apiPath, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Server, MoreVertical, Pencil, Trash2, Copy, ArrowLeft, Save, Loader2 } from 'lucide-react';

/* ─── Dashboard ─── */

export function McpDashboard() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<McpServer | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<McpServer[]>(apiPath('mcp-servers'));
      setServers(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this MCP server?')) return;
    try {
      await apiDelete(apiPath('mcp-servers', id));
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, [load]);

  const handleDuplicate = useCallback(async (server: McpServer) => {
    try {
      const body: McpServerCreateBody = {
        name: `${server.name} (Copy)`,
        transport: server.transport,
        command: server.command,
        args: server.args,
        url: server.url,
        metadata: server.metadata,
      };
      await apiPost(apiPath('mcp-servers'), body);
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    }
  }, [load]);

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.transport ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (editing !== null) {
    return (
      <McpEditor
        server={editing === 'new' ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); void load(); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold text-foreground">MCP Servers</h1>
          <p className="text-sm text-muted-foreground">Manage Model Context Protocol server connections</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Server
        </Button>
      </header>

      <div className="px-6 py-4 border-b border-border">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search servers..."
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
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">No MCP servers found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Connect your first MCP server'}
            </p>
            {!searchQuery && (
              <Button variant="outline" onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Server
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((server) => (
              <div
                key={server.id}
                className="group flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <button type="button" onClick={() => setEditing(server)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{server.name}</h3>
                    <Badge variant="secondary" className="text-xs shrink-0">{server.transport}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {server.url || server.command || 'No endpoint configured'}
                  </p>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(server)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleDuplicate(server)}>
                      <Copy className="h-4 w-4 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void handleDelete(server.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Editor ─── */

interface McpEditorProps {
  server?: McpServer;
  onCancel: () => void;
  onSaved: () => void;
}

function McpEditor({ server, onCancel, onSaved }: McpEditorProps) {
  const [name, setName] = useState(server?.name ?? '');
  const [transport, setTransport] = useState(server?.transport ?? 'stdio');
  const [command, setCommand] = useState(server?.command ?? '');
  const [argsText, setArgsText] = useState(
    server?.args ? JSON.stringify(server.args, null, 2) : '[]',
  );
  const [url, setUrl] = useState(server?.url ?? '');
  const [metadataText, setMetadataText] = useState(
    server?.metadata ? JSON.stringify(server.metadata, null, 2) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }
    if (!transport.trim()) { setError('Transport is required'); return; }

    let args: string[] | undefined;
    if (argsText.trim() && argsText.trim() !== '[]') {
      try {
        const parsed = JSON.parse(argsText) as unknown;
        if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
          setError('Args must be a JSON array of strings');
          return;
        }
        args = parsed;
      } catch {
        setError('Args must be valid JSON');
        return;
      }
    }

    let metadata: Record<string, unknown> | undefined;
    if (metadataText.trim()) {
      try {
        metadata = JSON.parse(metadataText) as Record<string, unknown>;
      } catch {
        setError('Metadata must be valid JSON');
        return;
      }
    }

    setSaving(true);
    try {
      const body: McpServerCreateBody = {
        name: name.trim(),
        transport: transport.trim(),
        ...(command.trim() ? { command: command.trim() } : {}),
        ...(args?.length ? { args } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
        ...(metadata ? { metadata } : {}),
      };

      if (server) {
        await apiPut(apiPath('mcp-servers', server.id), body);
      } else {
        await apiPost(apiPath('mcp-servers'), body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [name, transport, command, argsText, url, metadataText, server, onSaved]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {server ? 'Edit MCP Server' : 'New MCP Server'}
          </h1>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {server ? 'Update' : 'Create'}
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
            <Label htmlFor="mcp-name">Name</Label>
            <Input id="mcp-name" placeholder="My MCP Server" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-transport">Transport</Label>
            <select
              id="mcp-transport"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
            >
              <option value="stdio">stdio</option>
              <option value="http">http</option>
              <option value="sse">sse</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-command">Command (for stdio)</Label>
            <Input id="mcp-command" placeholder="npx -y @modelcontextprotocol/server-fs" value={command} onChange={(e) => setCommand(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-args">Args (JSON array, for stdio)</Label>
            <Textarea id="mcp-args" rows={3} value={argsText} onChange={(e) => setArgsText(e.target.value)} className="font-mono text-sm" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-url">URL (for http/sse)</Label>
            <Input id="mcp-url" placeholder="http://localhost:3100/mcp" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-metadata">Metadata (JSON, optional)</Label>
            <Textarea
              id="mcp-metadata"
              rows={4}
              placeholder='{"description": "..."}'
              value={metadataText}
              onChange={(e) => setMetadataText(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
