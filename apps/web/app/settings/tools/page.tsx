'use client';

import { ToolSchema, type Tool } from '@agent-platform/contracts';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '../../../components/settings/FormError';
import { ApiRequestError, apiDelete, apiGet, apiPath, apiPost, apiPut } from '../../../lib/apiClient';

export default function ToolsPage() {
  const [rows, setRows] = useState<Tool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Tool[]>(apiPath('tools'));
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
    setId('');
    setName('');
    setDescription('');
    setConfigJson('');
  }

  function fillForm(t: Tool) {
    setEditingId(t.id);
    setId(t.id);
    setName(t.name);
    setDescription(t.description ?? '');
    setConfigJson(t.config ? JSON.stringify(t.config, null, 2) : '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let config: Record<string, unknown> | undefined;
    if (configJson.trim()) {
      try {
        config = JSON.parse(configJson) as Record<string, unknown>;
      } catch {
        setError('Config must be valid JSON');
        return;
      }
    }
    const draft: Tool = {
      id: id.trim(),
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(config ? { config } : {}),
    };
    const parsed = ToolSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.message);
      return;
    }
    try {
      if (editingId === null) {
        await apiPost<Tool>(apiPath('tools'), parsed.data);
      } else {
        await apiPut<Tool>(apiPath('tools', parsed.data.id), parsed.data);
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

  async function remove(toolId: string) {
    if (!confirm(`Delete tool ${toolId}?`)) return;
    setError(null);
    try {
      await apiDelete(apiPath('tools', toolId));
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
      <h2 style={{ fontSize: '1.1rem' }}>Tools</h2>
      <FormError message={error} />
      {loading ? <p>Loading…</p> : null}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rows.map((t) => (
          <li
            key={t.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <strong>{t.id}</strong> — {t.name}
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => fillForm(t)}>
                Edit
              </button>
              <button type="button" onClick={() => void remove(t.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void submit(e)} style={{ maxWidth: 560, marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem' }}>{editingId ? 'Edit tool' : 'Create tool'}</h3>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="tool-id" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Id
          </label>
          <input
            id="tool-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={editingId !== null}
            required
            aria-required
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="tool-name" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Name
          </label>
          <input
            id="tool-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-required
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="tool-desc" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Description (optional)
          </label>
          <input
            id="tool-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="tool-config" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Config (JSON, optional)
          </label>
          <textarea
            id="tool-config"
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={5}
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
