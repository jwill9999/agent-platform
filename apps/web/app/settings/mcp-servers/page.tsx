'use client';

import { McpServerSchema, type McpServer } from '@agent-platform/contracts';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '../../../components/settings/FormError';
import { ApiRequestError, apiDelete, apiGet, apiPath, apiPost, apiPut } from '../../../lib/apiClient';

export default function McpServersPage() {
  const [rows, setRows] = useState<McpServer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    id: '',
    name: '',
    transport: 'stdio',
    command: '',
    argsJson: '[]',
    url: '',
    metadataJson: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<McpServer[]>(apiPath('mcp-servers'));
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setForm({
      id: '',
      name: '',
      transport: 'stdio',
      command: '',
      argsJson: '[]',
      url: '',
      metadataJson: '',
    });
  }

  function fillForm(m: McpServer) {
    setEditingId(m.id);
    setForm({
      id: m.id,
      name: m.name,
      transport: m.transport,
      command: m.command ?? '',
      argsJson: JSON.stringify(m.args ?? [], null, 2),
      url: m.url ?? '',
      metadataJson: m.metadata ? JSON.stringify(m.metadata, null, 2) : '',
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let args: string[] | undefined;
    try {
      const parsed = JSON.parse(form.argsJson || '[]') as unknown;
      if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
        throw new Error('Args must be a JSON array of strings');
      }
      args = parsed;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid args JSON');
      return;
    }
    let metadata: Record<string, unknown> | undefined;
    if (form.metadataJson.trim()) {
      try {
        metadata = JSON.parse(form.metadataJson) as Record<string, unknown>;
      } catch {
        setError('Metadata must be valid JSON');
        return;
      }
    }
    const draft: McpServer = {
      id: form.id.trim(),
      name: form.name.trim(),
      transport: form.transport.trim(),
      ...(form.command.trim() ? { command: form.command.trim() } : {}),
      ...(args?.length ? { args } : {}),
      ...(form.url.trim() ? { url: form.url.trim() } : {}),
      ...(metadata ? { metadata } : {}),
    };
    const parsed = McpServerSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.message);
      return;
    }
    try {
      if (editingId === null) {
        await apiPost<McpServer>(apiPath('mcp-servers'), parsed.data);
      } else {
        await apiPut<McpServer>(apiPath('mcp-servers', parsed.data.id), parsed.data);
      }
      resetForm();
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  async function remove(id: string) {
    if (!confirm(`Delete MCP server ${id}?`)) return;
    setError(null);
    try {
      await apiDelete(apiPath('mcp-servers', id));
      resetForm();
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem' }}>MCP servers</h2>
      <FormError message={error} />
      {loading ? <p>Loading…</p> : null}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rows.map((m) => (
          <li
            key={m.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <strong>{m.id}</strong> — {m.name} ({m.transport})
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => fillForm(m)}>
                Edit
              </button>
              <button type="button" onClick={() => void remove(m.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void submit(e)} style={{ maxWidth: 560, marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem' }}>{editingId ? 'Edit MCP server' : 'Create MCP server'}</h3>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="mcp-id" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Id
          </label>
          <input
            id="mcp-id"
            value={form.id}
            onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            disabled={editingId !== null}
            required
            aria-required
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="mcp-name" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Name
          </label>
          <input
            id="mcp-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            aria-required
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="mcp-transport" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Transport
          </label>
          <input
            id="mcp-transport"
            value={form.transport}
            onChange={(e) => setForm((f) => ({ ...f, transport: e.target.value }))}
            required
            aria-required
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="mcp-command" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Command (optional)
          </label>
          <input
            id="mcp-command"
            value={form.command}
            onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="mcp-args" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Args (JSON string array)
          </label>
          <textarea
            id="mcp-args"
            value={form.argsJson}
            onChange={(e) => setForm((f) => ({ ...f, argsJson: e.target.value }))}
            rows={3}
            style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="mcp-url" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            URL (optional)
          </label>
          <input
            id="mcp-url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="mcp-metadata" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Metadata (JSON, optional)
          </label>
          <textarea
            id="mcp-metadata"
            value={form.metadataJson}
            onChange={(e) => setForm((f) => ({ ...f, metadataJson: e.target.value }))}
            rows={3}
            style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit">{editingId ? 'Save' : 'Create'}</button>
          {editingId ? (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
