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
import { Plus, Search, Server, MoreVertical, Pencil, Trash2, Copy, ArrowLeft, Save, Loader2, ClipboardPaste, Zap, CheckCircle2, XCircle } from 'lucide-react';

/* ─── JSON import parser ─── */

interface ParsedServer {
  name: string;
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Parse standard MCP JSON config formats into our server shape.
 *
 * Accepted formats:
 *   1. Bare URL string: "https://example.com/mcp"
 *   2. Single server object: { "command": "npx", "args": [...] }
 *   3. Named entry: { "my-server": { "command": "npx", ... } }
 *   4. mcpServers wrapper: { "mcpServers": { "my-server": { ... } } }
 */
function parseMcpJson(raw: string): { ok: true; servers: ParsedServer[] } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Paste a JSON configuration to import' };

  // Bare URL
  if (/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('{')) {
    try {
      const parsedUrl = new URL(trimmed);
      return {
        ok: true,
        servers: [{ name: parsedUrl.hostname, transport: 'http', url: trimmed }],
      };
    } catch {
      return { ok: false, error: 'Invalid URL — enter a complete http(s) endpoint' };
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'Invalid JSON — check for trailing commas or missing quotes' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Expected a JSON object' };
  }

  const obj = parsed as Record<string, unknown>;

  // Format 4: { "mcpServers": { ... } }
  if ('mcpServers' in obj && typeof obj.mcpServers === 'object' && obj.mcpServers !== null) {
    return parseNamedEntries(obj.mcpServers as Record<string, unknown>);
  }

  // Format 2: single server object with command or url at top level
  if ('command' in obj || 'url' in obj) {
    const server = buildServer('server', obj);
    if (!server.ok) return server;
    return { ok: true, servers: [server.value] };
  }

  // Format 3: { "name": { ... }, "name2": { ... } }
  return parseNamedEntries(obj);
}

function parseNamedEntries(
  entries: Record<string, unknown>,
): { ok: true; servers: ParsedServer[] } | { ok: false; error: string } {
  const keys = Object.keys(entries);
  if (keys.length === 0) return { ok: false, error: 'No server entries found in the JSON' };

  const servers: ParsedServer[] = [];
  for (const key of keys) {
    const val = entries[key];
    if (typeof val !== 'object' || val === null || Array.isArray(val)) {
      return { ok: false, error: `Entry "${key}" is not a valid server object` };
    }
    const result = buildServer(key, val as Record<string, unknown>);
    if (!result.ok) return result;
    servers.push(result.value);
  }
  return { ok: true, servers };
}

function buildServer(
  name: string,
  obj: Record<string, unknown>,
): { ok: true; value: ParsedServer } | { ok: false; error: string } {
  const command = typeof obj.command === 'string' ? obj.command : undefined;
  const url = typeof obj.url === 'string' ? obj.url : undefined;

  if (!command && !url) {
    return { ok: false, error: `Server "${name}" needs either a "command" or "url" field` };
  }

  const transport = url ? 'http' : 'stdio';

  let args: string[] | undefined;
  if (Array.isArray(obj.args)) {
    args = obj.args.filter((a): a is string => typeof a === 'string');
  }

  // Collect env and any extra fields into metadata
  let metadata: Record<string, unknown> | undefined;
  const env = typeof obj.env === 'object' && obj.env !== null ? obj.env : undefined;
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!['command', 'args', 'url', 'env'].includes(k)) {
      extras[k] = v;
    }
  }
  if (env || Object.keys(extras).length > 0) {
    metadata = { ...(env ? { env } : {}), ...extras };
  }

  return {
    ok: true,
    value: { name, transport, command, args, url, metadata },
  };
}

/* ─── Test connection ─── */

interface McpTestResult {
  status: 'ok' | 'error';
  toolCount?: number;
  tools?: { name: string; description?: string }[];
  error?: string;
  latencyMs: number;
}

async function testMcpServer(serverId: string): Promise<McpTestResult> {
  const result = await apiPost<McpTestResult>(apiPath('mcp-servers', serverId, 'test'), {});
  if (!result) throw new Error('Empty response from server');
  return result;
}

/* ─── Dashboard ─── */

export function McpDashboard() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'import' | { edit: McpServer }>('list');
  const [testResults, setTestResults] = useState<Record<string, McpTestResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

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

  const handleTest = useCallback(async (id: string) => {
    setTesting((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await testMcpServer(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { status: 'error', error: e instanceof Error ? e.message : String(e), latencyMs: 0 },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }));
    }
  }, []);

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.transport ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (view === 'import') {
    return (
      <McpImport
        onCancel={() => setView('list')}
        onSaved={() => { setView('list'); load(); }}
      />
    );
  }

  if (typeof view === 'object' && 'edit' in view) {
    return (
      <McpEditor
        server={view.edit}
        onCancel={() => setView('list')}
        onSaved={() => { setView('list'); load(); }}
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
        <Button onClick={() => setView('import')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Server
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
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">No MCP servers found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Paste a JSON config to add your first server'}
            </p>
            {!searchQuery && (
              <Button variant="outline" onClick={() => setView('import')}>
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Add Server
              </Button>
            )}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((server) => {
              const result = testResults[server.id];
              const isTesting = testing[server.id];
              return (
                <div
                  key={server.id}
                  className="group flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 relative">
                    <Server className="h-5 w-5 text-primary" />
                    {result && (
                      <span className="absolute -top-1 -right-1">
                        {result.status === 'ok'
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => setView({ edit: server })} className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{server.name}</h3>
                      <Badge variant="secondary" className="text-xs shrink-0">{server.transport}</Badge>
                      {result?.status === 'ok' && (
                        <Badge variant="outline" className="text-xs shrink-0 text-emerald-600 border-emerald-300">
                          {result.toolCount} {result.toolCount === 1 ? 'tool' : 'tools'} &middot; {result.latencyMs}ms
                        </Badge>
                      )}
                      {result?.status === 'error' && (
                        <Badge variant="outline" className="text-xs shrink-0 text-destructive border-destructive/30">
                          Failed
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {result?.status === 'error' ? result.error : (server.url || server.command || 'No endpoint configured')}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={isTesting}
                    onClick={() => { handleTest(server.id); }}
                    title="Test connection"
                  >
                    {isTesting
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Zap className="h-4 w-4" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { handleTest(server.id); }} disabled={isTesting}>
                        <Zap className="h-4 w-4 mr-2" /> Test Connection
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setView({ edit: server })}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { handleDuplicate(server); }}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { handleDelete(server.id); }} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── JSON Import ─── */

interface McpImportProps {
  onCancel: () => void;
  onSaved: () => void;
}

function McpImport({ onCancel, onSaved }: Readonly<McpImportProps>) {
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<ParsedServer[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleParse = useCallback(() => {
    const result = parseMcpJson(jsonText);
    if (result.ok) {
      setPreview(result.servers);
      setParseError(null);
    } else {
      setPreview(null);
      setParseError(result.error);
    }
  }, [jsonText]);

  const handleImport = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    setSaveError(null);
    try {
      for (const server of preview) {
        const body: McpServerCreateBody = {
          name: server.name,
          transport: server.transport,
          ...(server.command ? { command: server.command } : {}),
          ...(server.args?.length ? { args: server.args } : {}),
          ...(server.url ? { url: server.url } : {}),
          ...(server.metadata ? { metadata: server.metadata } : {}),
        };
        await apiPost(apiPath('mcp-servers'), body);
      }
      onSaved();
    } catch (e) {
      setSaveError(e instanceof ApiRequestError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [preview, onSaved]);

  const error = parseError || saveError;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Add MCP Server</h1>
        </div>
      </header>

      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {preview ? (
            <>
              <div className="space-y-2">
                <Label>Review before importing</Label>
                <p className="text-sm text-muted-foreground">
                  {preview.length === 1
                    ? '1 server will be added:'
                    : `${preview.length} servers will be added:`}
                </p>
              </div>

              <div className="space-y-3">
                {preview.map((s) => (
                  <div key={s.name} className="border border-border rounded-lg p-4 bg-card space-y-2">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">{s.name}</span>
                      <Badge variant="secondary" className="text-xs">{s.transport}</Badge>
                    </div>
                    {s.command && (
                      <p className="text-sm text-muted-foreground font-mono">
                        {s.command}{s.args?.length ? ` ${s.args.join(' ')}` : ''}
                      </p>
                    )}
                    {s.url && (
                      <p className="text-sm text-muted-foreground font-mono">{s.url}</p>
                    )}
                    {s.metadata && (
                      <details className="text-sm">
                        <summary className="text-muted-foreground cursor-pointer">Metadata</summary>
                        <pre className="mt-1 text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto">
                          {JSON.stringify(s.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button onClick={handleImport} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {preview.length === 1 ? 'Import Server' : `Import ${preview.length} Servers`}
                </Button>
                <Button variant="outline" onClick={() => { setPreview(null); setSaveError(null); }}>
                  Back
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="mcp-json">Paste server JSON</Label>
                <p className="text-sm text-muted-foreground">
                  Paste the config from your MCP server&apos;s documentation.
                  Supports Claude Desktop, Cursor, and standard MCP formats.
                </p>
                <Textarea
                  id="mcp-json"
                  rows={12}
                  placeholder={`{
  "my-server": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-example"]
  }
}`}
                  value={jsonText}
                  onChange={(e) => { setJsonText(e.target.value); setParseError(null); }}
                  className="font-mono text-sm"
                  autoFocus
                />
              </div>
              <Button onClick={handleParse} disabled={!jsonText.trim()}>
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Parse
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Editor (for existing servers) ─── */

interface McpEditorProps {
  server: McpServer;
  onCancel: () => void;
  onSaved: () => void;
}

function McpEditor({ server, onCancel, onSaved }: Readonly<McpEditorProps>) {
  const [name, setName] = useState(server.name);
  const [transport, setTransport] = useState(server.transport);
  const [command, setCommand] = useState(server.command ?? '');
  const [argsText, setArgsText] = useState(
    server.args ? JSON.stringify(server.args, null, 2) : '[]',
  );
  const [url, setUrl] = useState(server.url ?? '');
  const [metadataText, setMetadataText] = useState(
    server.metadata ? JSON.stringify(server.metadata, null, 2) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<McpTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testMcpServer(server.id);
      setTestResult(result);
    } catch (e) {
      setTestResult({ status: 'error', error: e instanceof Error ? e.message : String(e), latencyMs: 0 });
    } finally {
      setIsTesting(false);
    }
  }, [server.id]);

  const handleSave = useCallback(async () => {
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }
    if (!transport.trim()) { setError('Transport is required'); return; }

    const argsResult = parseJsonField<string[]>(argsText, 'Args must be a JSON array of strings', (v) =>
      Array.isArray(v) && v.every((x) => typeof x === 'string'),
    );
    if (!argsResult.ok) { setError(argsResult.error); return; }

    const metadataResult = parseJsonField<Record<string, unknown>>(metadataText, 'Metadata must be valid JSON', (v) =>
      typeof v === 'object' && v !== null && !Array.isArray(v),
    );
    if (!metadataResult.ok) { setError(metadataResult.error); return; }

    setSaving(true);
    try {
      const body: McpServerCreateBody = {
        name: name.trim(),
        transport: transport.trim(),
        ...(command.trim() ? { command: command.trim() } : {}),
        ...(argsResult.value?.length ? { args: argsResult.value } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
        ...(metadataResult.value ? { metadata: metadataResult.value } : {}),
      };
      await apiPut(apiPath('mcp-servers', server.id), body);
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
          <h1 className="text-xl font-semibold text-foreground">Edit MCP Server</h1>
        </div>
        <Button variant="outline" onClick={handleTest} disabled={isTesting}>
          {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
          Test
        </Button>
        <Button onClick={() => { handleSave(); }} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Update
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
            <Input id="mcp-name" value={name} onChange={(e) => setName(e.target.value)} />
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
            <Label htmlFor="mcp-command">Command</Label>
            <Input id="mcp-command" placeholder="npx -y @modelcontextprotocol/server-fs" value={command} onChange={(e) => setCommand(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-args">Args (JSON array)</Label>
            <Textarea id="mcp-args" rows={3} value={argsText} onChange={(e) => setArgsText(e.target.value)} className="font-mono text-sm" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-url">URL</Label>
            <Input id="mcp-url" placeholder="http://localhost:3100/mcp" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-metadata">Metadata (JSON)</Label>
            <Textarea
              id="mcp-metadata"
              rows={4}
              placeholder='{"env": {"API_KEY": "..."}}'
              value={metadataText}
              onChange={(e) => setMetadataText(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          {testResult && (
            <McpTestResultPanel result={testResult} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Test Result Panel ─── */

function McpTestResultPanel({ result }: Readonly<{ result: McpTestResult }>) {
  if (result.status === 'error') {
    return (
      <div className="border border-destructive/30 rounded-lg p-4 bg-destructive/5 space-y-1">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="font-medium text-destructive text-sm">Connection failed</span>
          <span className="text-xs text-muted-foreground">{result.latencyMs}ms</span>
        </div>
        <p className="text-sm text-destructive/80 pl-6">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="border border-emerald-300 rounded-lg p-4 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="font-medium text-emerald-700 dark:text-emerald-400 text-sm">
          Connected — {result.toolCount} {result.toolCount === 1 ? 'tool' : 'tools'} available
        </span>
        <span className="text-xs text-muted-foreground">{result.latencyMs}ms</span>
      </div>
      {result.tools && result.tools.length > 0 && (
        <div className="pl-6 space-y-1">
          {result.tools.map((t) => (
            <div key={t.name} className="text-sm">
              <span className="font-mono text-foreground">{t.name}</span>
              {t.description && (
                <span className="text-muted-foreground"> — {t.description}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─── */

function parseJsonField<T>(
  text: string,
  errorMsg: string,
  validate: (v: unknown) => boolean,
): { ok: true; value: T | undefined } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed || trimmed === '[]' || trimmed === '{}') return { ok: true, value: undefined };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!validate(parsed)) return { ok: false, error: errorMsg };
    return { ok: true, value: parsed as T };
  } catch {
    return { ok: false, error: errorMsg };
  }
}
