'use client';

import { SkillSchema, type Skill } from '@agent-platform/contracts';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '../../../components/settings/FormError';
import { ApiRequestError, apiDelete, apiGet, apiPath, apiPost, apiPut } from '../../../lib/apiClient';

export default function SkillsPage() {
  const [rows, setRows] = useState<Skill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState('');
  const [goal, setGoal] = useState('');
  const [constraintsText, setConstraintsText] = useState('');
  const [toolsText, setToolsText] = useState('');
  const [outputSchemaText, setOutputSchemaText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Skill[]>(apiPath('skills'));
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
    setId('');
    setGoal('');
    setConstraintsText('');
    setToolsText('');
    setOutputSchemaText('');
  }

  function fillForm(s: Skill) {
    setEditingId(s.id);
    setId(s.id);
    setGoal(s.goal);
    setConstraintsText(s.constraints.join('\n'));
    setToolsText(s.tools.join('\n'));
    setOutputSchemaText(s.outputSchema ? JSON.stringify(s.outputSchema, null, 2) : '');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const constraints = constraintsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const tools = toolsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    let outputSchema: Record<string, unknown> | undefined;
    if (outputSchemaText.trim()) {
      try {
        outputSchema = JSON.parse(outputSchemaText) as Record<string, unknown>;
      } catch {
        setError('Output schema must be valid JSON');
        return;
      }
    }
    const draft: Skill = {
      id: id.trim(),
      goal,
      constraints,
      tools,
      ...(outputSchema ? { outputSchema } : {}),
    };
    const parsed = SkillSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.message);
      return;
    }
    try {
      if (editingId === null) {
        await apiPost<Skill>(apiPath('skills'), parsed.data);
      } else {
        await apiPut<Skill>(apiPath('skills', parsed.data.id), parsed.data);
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

  async function remove(skillId: string) {
    if (!confirm(`Delete skill ${skillId}?`)) return;
    setError(null);
    try {
      await apiDelete(apiPath('skills', skillId));
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
      <h2 style={{ fontSize: '1.1rem' }}>Skills</h2>
      <FormError message={error} />
      {loading ? <p>Loading…</p> : null}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rows.map((s) => (
          <li
            key={s.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            <strong>{s.id}</strong>
            <div style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.25rem' }}>{s.goal}</div>
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => fillForm(s)}>
                Edit
              </button>
              <button type="button" onClick={() => void remove(s.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void submit(e)} style={{ maxWidth: 560, marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem' }}>{editingId ? 'Edit skill' : 'Create skill'}</h3>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="skill-id" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Id
          </label>
          <input
            id="skill-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={editingId !== null}
            required
            aria-required
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="skill-goal" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Goal
          </label>
          <textarea
            id="skill-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={4}
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="skill-constraints" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Constraints (one per line)
          </label>
          <textarea
            id="skill-constraints"
            value={constraintsText}
            onChange={(e) => setConstraintsText(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="skill-tools" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Tools (one per line)
          </label>
          <textarea
            id="skill-tools"
            value={toolsText}
            onChange={(e) => setToolsText(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="skill-output-schema" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Output schema (JSON, optional)
          </label>
          <textarea
            id="skill-output-schema"
            value={outputSchemaText}
            onChange={(e) => setOutputSchemaText(e.target.value)}
            rows={4}
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
