'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseMcpImport, type McpServer, type McpImportEntry } from '@agent-platform/contracts';
import { apiGet, apiDelete, apiPost, apiPut, apiPath } from '@/lib/apiClient';
import {
  credentialRows,
  currentTestResult,
  editorBody,
  mcpWriteError,
  transportLabel,
  type CredentialRow,
  type McpTestResult,
} from '@/lib/mcp-onboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { McpTrustNotice } from './mcp-trust-notice';
import {
  Plus,
  Search,
  Server,
  Pencil,
  Trash2,
  Copy,
  ArrowLeft,
  Save,
  Loader2,
  ClipboardPaste,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const fieldClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

async function testMcpServer(server: McpServer): Promise<McpTestResult> {
  try {
    const result = await apiPost<McpTestResult>(apiPath('mcp-servers', server.id, 'test'), {});
    if (result) return result;
  } catch {
    /* Transport errors must not echo a raw server response. */
  }
  return {
    status: 'error',
    error: 'Connection test could not complete. Check the API connection and try again.',
    latencyMs: 0,
    testedAt: new Date().toISOString(),
    configurationRevision: server.configurationRevision ?? 0,
  };
}

export function McpDashboard() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'import' | { edit: McpServer }>('list');
  const [testResults, setTestResults] = useState<Record<string, McpTestResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [pendingTest, setPendingTest] = useState<McpServer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setServers((await apiGet<McpServer[]>(apiPath('mcp-servers'))) ?? []);
    } catch {
      setError('Could not load MCP servers. Check the API connection.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(server: McpServer) {
    if (!confirm(`Delete ${server.name} and its stored credentials? This affects new requests.`))
      return;
    try {
      await apiDelete(apiPath('mcp-servers', server.id));
      await load();
    } catch {
      setError('Could not delete the server. Check the API connection and try again.');
    }
  }

  async function handleDuplicate(server: McpServer) {
    try {
      await apiPost(apiPath('mcp-servers', server.id, 'duplicate'), {});
      setNotice(
        'Server duplicated without credential values. Edit the copy and re-enter any required credentials before testing.',
      );
      await load();
    } catch (cause) {
      setError(mcpWriteError(cause));
    }
  }

  async function handleTest(server: McpServer) {
    setPendingTest(null);
    setTesting((old) => ({ ...old, [server.id]: true }));
    const result = await testMcpServer(server);
    setTestResults((old) => ({ ...old, [server.id]: result }));
    await load(); // Activation can migrate a legacy configuration and advance its revision.
    setTesting((old) => ({ ...old, [server.id]: false }));
  }

  function saved() {
    setTestResults({});
    setView('list');
    setNotice(
      'Configuration saved. No connection was started. Test again to verify the saved settings.',
    );
    void load();
  }

  if (view === 'import') return <McpImport onCancel={() => setView('list')} onSaved={saved} />;
  if (typeof view === 'object')
    return <McpEditor server={view.edit} onCancel={() => setView('list')} onSaved={saved} />;
  const filtered = servers.filter((server) =>
    `${server.name} ${server.transport}`.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div>
          <h1 className="text-xl font-semibold">MCP Servers</h1>
          <p className="text-sm text-muted-foreground">Connect existing trusted servers</p>
        </div>
        <Button onClick={() => setView('import')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </Button>
      </header>
      <div className="px-6 py-4 border-b border-border space-y-3">
        <McpTrustNotice />
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search MCP servers"
            placeholder="Search servers..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      {error && <Feedback error>{error}</Feedback>}
      {notice && <Feedback>{notice}</Feedback>}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {loading && <output className="block">Loading servers…</output>}
        {!loading && filtered.length === 0 && (
          <p className="text-muted-foreground">
            No MCP servers found. Add a server or change your search.
          </p>
        )}
        {!loading &&
          filtered.map((server) => {
            const result = currentTestResult(server, testResults[server.id]);
            return (
              <section
                key={server.id}
                aria-label={server.name}
                className="bg-card border border-border rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <Server className="h-5 w-5 text-primary" />
                  <button
                    type="button"
                    onClick={() => setView({ edit: server })}
                    className="flex-1 min-w-0 text-left font-semibold"
                  >
                    {server.name}
                  </button>
                  <Badge variant="secondary">{transportLabel(server.transport)}</Badge>
                  {server.needsReconfiguration && (
                    <Badge variant="destructive">Needs reconfiguration</Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingTest(server)}
                    disabled={testing[server.id] || server.needsReconfiguration}
                  >
                    {testing[server.id] ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${server.name}`}
                    onClick={() => setView({ edit: server })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Duplicate ${server.name} without credentials`}
                    onClick={() => void handleDuplicate(server)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${server.name}`}
                    onClick={() => void handleDelete(server)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground break-all">
                  {server.url || server.command || 'No endpoint configured'}
                </p>
                {server.needsReconfiguration && (
                  <p className="text-sm">
                    Edit this server to replace unsupported settings or supply missing credentials.
                    It cannot connect yet.
                  </p>
                )}
                {result && <McpTestResultPanel result={result} />}
              </section>
            );
          })}
      </div>
      <ConnectionConfirmation
        server={pendingTest}
        onCancel={() => setPendingTest(null)}
        onConfirm={(server) => void handleTest(server)}
      />
    </div>
  );
}

function Feedback({
  error = false,
  children,
}: Readonly<{ error?: boolean; children: React.ReactNode }>) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`px-6 py-3 text-sm ${error ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}
    >
      {children}
    </div>
  );
}

function ConnectionConfirmation({
  server,
  onCancel,
  onConfirm,
}: Readonly<{
  server: McpServer | null;
  onCancel: () => void;
  onConfirm: (server: McpServer) => void;
}>) {
  return (
    <Dialog
      open={server !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test {server?.name}</DialogTitle>
          <DialogDescription>
            Connect and discover tools using the saved settings. This test does not call a tool or
            grant permission to use one.
          </DialogDescription>
        </DialogHeader>
        <McpTrustNotice />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (server) onConfirm(server);
            }}
          >
            Connect and discover
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function McpImport({
  onCancel,
  onSaved,
}: Readonly<{ onCancel: () => void; onSaved: () => void }>) {
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<McpImportEntry[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function parse() {
    const result = parseMcpImport(jsonText);
    setPreview(result.entries);
    setSelected(result.entries.flatMap((entry, index) => (entry.config ? [index] : [])));
    setError(null);
    // Keep values only in the pending write payload, never in a second visible preview.
    setJsonText('');
  }

  async function save() {
    if (!preview || selected.length === 0) return;
    const servers = selected.flatMap((index) =>
      preview[index]?.config ? [preview[index].config] : [],
    );
    if (servers.length !== selected.length) {
      setError('Review the selected entries before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost(apiPath('mcp-servers', 'import'), { servers });
      setPreview(null);
      onSaved();
    } catch (cause) {
      setError(
        `${mcpWriteError(cause)} The selected batch is atomic; no partial import is accepted.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to MCP servers"
          onClick={onCancel}
          disabled={saving}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Add MCP Server</h1>
      </header>
      {error && <Feedback error>{error}</Feedback>}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <McpTrustNotice />
          {preview ? (
            <>
              <h2 className="font-semibold">Review before importing</h2>
              <p className="text-sm text-muted-foreground">
                Select the valid entries to save together. Invalid entries are excluded visibly.
                Credentials are encrypted, and their values are hidden in this review. Saving does
                not start a server.
              </p>
              {preview.map((entry, index) => (
                <McpImportReviewEntry
                  key={`${index}-${entry.name}`}
                  entry={entry}
                  selected={selected.includes(index)}
                  disabled={saving}
                  onSelect={() =>
                    setSelected((old) =>
                      old.includes(index) ? old.filter((item) => item !== index) : [...old, index],
                    )
                  }
                />
              ))}
              <div className="flex gap-3">
                <Button onClick={() => void save()} disabled={saving || selected.length === 0}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Import {selected.length} {selected.length === 1 ? 'Server' : 'Servers'}
                </Button>
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setPreview(null);
                    setError(null);
                  }}
                >
                  Paste again
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="mcp-json">Paste server JSON or endpoint URL</Label>
                <p id="mcp-json-help" className="text-sm text-muted-foreground">
                  Use a preinstalled executable and an argument array, or a Streamable HTTP
                  endpoint. Named maps and mcpServers wrappers are supported. Shell strings,
                  variable interpolation, custom cwd and unknown fields are not supported.
                </p>
                <Textarea
                  id="mcp-json"
                  aria-describedby="mcp-json-help"
                  rows={12}
                  placeholder={'{"my-server":{"command":"node","args":["/installed/server.mjs"]}}'}
                  value={jsonText}
                  onChange={(event) => setJsonText(event.target.value)}
                  className="font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Button onClick={parse} disabled={!jsonText.trim()}>
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Review configuration
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function McpImportReviewEntry({
  entry,
  selected,
  disabled,
  onSelect,
}: Readonly<{
  entry: McpImportEntry;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}>) {
  const config = entry.config;
  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled || !config}
          onChange={onSelect}
        />
        <span className="font-semibold">{entry.name}</span>
        {config && <Badge variant="secondary">{transportLabel(config.transport)}</Badge>}
      </label>
      {entry.error && (
        <p role="alert" className="text-sm text-destructive">
          {entry.error}
        </p>
      )}
      {config && (
        <>
          <p className="text-sm text-muted-foreground break-all">{config.url || config.command}</p>
          {config.args && (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">
                Review {config.args.length} executable arguments
              </summary>
              <pre className="mt-2 rounded bg-muted p-2 whitespace-pre-wrap break-all">
                {JSON.stringify(config.args, null, 2)}
              </pre>
              <p>
                Keep credentials in encrypted environment variables or headers, not in arguments.
              </p>
            </details>
          )}
          {(['env', 'headers'] as const).map((kind) => {
            const names = Object.keys(config.credentials?.[kind] ?? {});
            return (
              names.length > 0 && (
                <p key={kind} className="text-sm">
                  {kind === 'env' ? 'Environment variables' : 'Headers'}: {names.join(', ')} —
                  values hidden
                </p>
              )
            );
          })}
        </>
      )}
    </div>
  );
}

export function McpEditor({
  server,
  onCancel,
  onSaved,
}: Readonly<{ server: McpServer; onCancel: () => void; onSaved: () => void }>) {
  const [name, setName] = useState(server.name);
  const [transport, setTransport] = useState(server.transport);
  const [command, setCommand] = useState(server.command ?? '');
  const [argsText, setArgsText] = useState(JSON.stringify(server.args ?? []));
  const [url, setUrl] = useState(server.url ?? '');
  const [env, setEnv] = useState(() => credentialRows(server.credentialStatus?.env));
  const [headers, setHeaders] = useState(() => credentialRows(server.credentialStatus?.headers));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<McpTestResult | undefined>();
  const [isTesting, setIsTesting] = useState(false);
  const [confirmTest, setConfirmTest] = useState(false);
  const dirty =
    name !== server.name ||
    transport !== server.transport ||
    command !== (server.command ?? '') ||
    argsText !== JSON.stringify(server.args ?? []) ||
    url !== (server.url ?? '') ||
    [...env, ...headers].some((row) => row.action !== 'retain');

  async function test() {
    setConfirmTest(false);
    setIsTesting(true);
    setTestResult(undefined);
    setTestResult(await testMcpServer(server));
    setIsTesting(false);
  }

  async function save() {
    setError(null);
    let body;
    try {
      body = editorBody({ name, transport, command, argsText, url, env, headers });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review the configuration.');
      return;
    }
    setSaving(true);
    try {
      await apiPut(apiPath('mcp-servers', server.id), body);
      onSaved();
    } catch (cause) {
      setError(mcpWriteError(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to MCP servers"
          onClick={onCancel}
          disabled={saving}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold flex-1">Edit MCP Server</h1>
        <Button
          variant="outline"
          onClick={() => setConfirmTest(true)}
          disabled={isTesting || saving || dirty || server.needsReconfiguration}
        >
          <Zap className="h-4 w-4 mr-2" />
          Test saved settings
        </Button>
        <Button form="mcp-edit-form" type="submit" disabled={saving || isTesting}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Update
        </Button>
      </header>
      {error && <Feedback error>{error}</Feedback>}
      <div className="flex-1 overflow-y-auto p-6">
        <form
          id="mcp-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="max-w-2xl space-y-6"
        >
          <McpTrustNotice />
          {server.needsReconfiguration && (
            <output className="block">
              This server needs reconfiguration before it can connect. Replace unsupported settings
              or re-enter missing credentials.
            </output>
          )}
          {dirty && (
            <output className="block text-sm">
              Unsaved changes. Save first, then test the new configuration. Earlier test results do
              not apply.
            </output>
          )}
          <div className="space-y-2">
            <Label htmlFor="mcp-name">Name</Label>
            <Input
              required
              id="mcp-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcp-transport">Transport</Label>
            <select
              id="mcp-transport"
              className={fieldClass}
              value={transport}
              onChange={(event) => setTransport(event.target.value)}
            >
              <option value="stdio">Local process (stdio)</option>
              <option value="streamable-http">Streamable HTTP</option>
              {!['stdio', 'streamable-http'].includes(server.transport) && (
                <option value={server.transport}>{transportLabel(server.transport)}</option>
              )}
            </select>
            <p className="text-sm text-muted-foreground">
              Legacy http and sse labels use Streamable HTTP. Saving normalizes the label; the older
              SSE protocol is not supported.
            </p>
          </div>
          {transport === 'stdio' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="mcp-command">Executable</Label>
                <p id="mcp-command-help" className="text-sm text-muted-foreground">
                  One executable available on the API host. Put arguments in the array below; no
                  shell command string.
                </p>
                <Input
                  required
                  id="mcp-command"
                  aria-describedby="mcp-command-help"
                  placeholder="node"
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-args">Arguments (JSON string array)</Label>
                <Textarea
                  id="mcp-args"
                  rows={3}
                  value={argsText}
                  onChange={(event) => setArgsText(event.target.value)}
                  className="font-mono text-sm"
                  spellCheck={false}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="mcp-url">Streamable HTTP endpoint</Label>
              <p id="mcp-url-help" className="text-sm text-muted-foreground">
                HTTPS, or explicitly local HTTP. No URL credentials, query strings, fragments or
                redirects. Enter authentication as an encrypted header below.
              </p>
              <Input
                required
                type="url"
                id="mcp-url"
                aria-describedby="mcp-url-help"
                placeholder="http://localhost:3100/mcp"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
          )}
          <CredentialEditor
            kind="env"
            rows={env}
            onChange={setEnv}
            applicable={transport === 'stdio'}
          />
          <CredentialEditor
            kind="headers"
            rows={headers}
            onChange={setHeaders}
            applicable={transport !== 'stdio'}
          />
          {!dirty && testResult && <McpTestResultPanel result={testResult} />}
        </form>
      </div>
      <ConnectionConfirmation
        server={confirmTest ? server : null}
        onCancel={() => setConfirmTest(false)}
        onConfirm={() => void test()}
      />
    </div>
  );
}

function CredentialEditor({
  kind,
  rows,
  onChange,
  applicable,
}: Readonly<{
  applicable: boolean;
  kind: 'env' | 'headers';
  rows: CredentialRow[];
  onChange: (rows: CredentialRow[]) => void;
}>) {
  function change(index: number, patch: Partial<CredentialRow>) {
    onChange(rows.map((row, item) => (item === index ? { ...row, ...patch } : row)));
  }
  const title = kind === 'env' ? 'Environment variables' : 'Authentication headers';
  if (!applicable && rows.length === 0) return null;
  return (
    <fieldset className="space-y-3">
      <legend className="font-medium">{title}</legend>
      <p className="text-sm text-muted-foreground">
        All values are encrypted and never loaded into this form. Keep preserves the saved value;
        Replace supplies a new value; Clear removes it. Variables are not expanded. Environment
        values apply to local processes; headers apply to HTTP.
      </p>
      {rows.map((row, index) => (
        <div key={row.id} className="border border-border rounded p-3 space-y-2">
          <Label htmlFor={`${kind}-name-${row.id}`}>{title} name</Label>
          <Input
            id={`${kind}-name-${row.id}`}
            value={row.name}
            disabled={row.existing}
            onChange={(event) => change(index, { name: event.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            {row.configured ? 'Saved value configured' : 'No saved value — re-enter if required'}
          </p>
          <Label htmlFor={`${kind}-action-${row.id}`}>Action for {row.name || 'new value'}</Label>
          <select
            id={`${kind}-action-${row.id}`}
            className={fieldClass}
            value={row.action}
            onChange={(event) =>
              change(index, { action: event.target.value as CredentialRow['action'], value: '' })
            }
          >
            <option value="retain">Keep saved value</option>
            <option value="replace" disabled={!applicable}>
              Replace value
            </option>
            <option value="clear">Clear value</option>
          </select>
          {row.action === 'replace' && (
            <>
              <Label htmlFor={`${kind}-value-${row.id}`}>
                New value for {row.name || 'credential'}
              </Label>
              <Input
                required
                type="password"
                id={`${kind}-value-${row.id}`}
                value={row.value}
                onChange={(event) => change(index, { value: event.target.value })}
                autoComplete="new-password"
                spellCheck={false}
              />
            </>
          )}
          {!row.existing && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(rows.filter((_, item) => item !== index))}
            >
              Remove new value
            </Button>
          )}
        </div>
      ))}
      {!applicable && (
        <p className="text-sm">
          Clear these values before switching transport; they do not apply to the selected
          connection.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={!applicable}
        onClick={() =>
          onChange([
            ...rows,
            {
              id: crypto.randomUUID(),
              name: '',
              configured: false,
              existing: false,
              action: 'replace',
              value: '',
            },
          ])
        }
      >
        <Plus className="h-4 w-4 mr-2" />
        Add {kind === 'env' ? 'environment variable' : 'header'}
      </Button>
    </fieldset>
  );
}

export function McpTestResultPanel({ result }: Readonly<{ result: McpTestResult }>) {
  const successful = result.status === 'ok';
  return (
    <output
      className={`block border rounded-lg p-4 space-y-2 ${successful ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-destructive/30 bg-destructive/5'}`}
    >
      <span className="flex items-center gap-2">
        {successful ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="font-medium">
          {successful ? 'Connected; discovery completed' : 'Connection failed'}
        </span>
        <span className="text-xs text-muted-foreground">{result.latencyMs}ms</span>
      </span>
      {successful ? (
        <>
          <span className="block">
            {result.discoveredCount} discovered · {result.eligibleCount} eligible tools
          </span>
          <span className="block text-sm text-muted-foreground">
            Discovery does not grant permission. Tool use still follows the agent’s approval policy
            and context limits.
          </span>
          {result.rejections?.map((item) => (
            <span key={item.category} className="block text-sm">
              {item.category}: {item.count} rejected
            </span>
          ))}
        </>
      ) : (
        <>
          <span className="block text-sm">{result.error}</span>
          <span className="block text-sm">
            {[result.stage, result.code].filter(Boolean).join(' · ')}
          </span>
          {result.retryGuidance && <span className="block text-sm">{result.retryGuidance}</span>}
        </>
      )}
      <span className="block text-xs text-muted-foreground">
        Tested {result.testedAt} · configuration revision {result.configurationRevision}. Changes
        require another test.
      </span>
    </output>
  );
}
