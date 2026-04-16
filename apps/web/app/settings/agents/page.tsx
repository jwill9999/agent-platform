'use client';

import { AgentSchema, type Agent } from '@agent-platform/contracts';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '../../../components/settings/FormError';
import { ApiRequestError, apiDelete, apiGet, apiPath, apiPost, apiPut } from '../../../lib/apiClient';

const template: Agent = {
  id: 'new-agent',
  name: 'New agent',
  systemPrompt: 'You are a helpful assistant.',
  allowedSkillIds: [],
  allowedToolIds: [],
  allowedMcpServerIds: [],
  executionLimits: {
    maxSteps: 16,
    maxParallelTasks: 2,
    timeoutMs: 120_000,
  },
};

export default function AgentsPage() {
  const [rows, setRows] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jsonText, setJsonText] = useState(JSON.stringify(template, null, 2));
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Agent[]>(apiPath('agents'));
      setRows(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setJsonText(JSON.stringify(template, null, 2));
  }

  function fillForm(a: Agent) {
    setEditingId(a.id);
    setJsonText(JSON.stringify(a, null, 2));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText) as unknown;
    } catch {
      setError('Body must be valid JSON');
      return;
    }
    const parsed = AgentSchema.safeParse(parsedJson);
    if (!parsed.success) {
      setError(parsed.error.message);
      return;
    }
    try {
      if (editingId === null) {
        await apiPost<Agent>(apiPath('agents'), parsed.data);
      } else {
        await apiPut<Agent>(apiPath('agents', parsed.data.id), parsed.data);
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
    if (!confirm(`Delete agent ${id}?`)) return;
    setError(null);
    try {
      await apiDelete(apiPath('agents', id));
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
      <h2 style={{ fontSize: '1.1rem' }}>Agents</h2>
      <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
        Edit the full agent record as JSON (validated with <code>AgentSchema</code>). Use{' '}
        <code>modelOverride</code> for provider/model; plugin lists are optional.
      </p>
      <FormError message={error} />
      {loading ? <p>Loading…</p> : null}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rows.map((a) => (
          <li
            key={a.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <strong>{a.id}</strong> — {a.name}
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => fillForm(a)}>
                Edit
              </button>
              <button type="button" onClick={() => void remove(a.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void submit(e)} style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem' }}>{editingId ? 'Edit agent' : 'Create agent'}</h3>
        <label htmlFor="agent-json" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
          Agent JSON
        </label>
        <textarea
          id="agent-json"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={18}
          style={{
            width: '100%',
            maxWidth: 720,
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.8125rem',
            padding: '0.5rem',
          }}
          spellCheck={false}
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button type="submit">{editingId ? 'Save' : 'Create'}</button>
          {editingId ? (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          ) : (
            <button type="button" onClick={resetForm}>
              Reset template
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
