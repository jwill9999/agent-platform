'use client';

import {
  SessionCreateBodySchema,
  type Agent,
  type SessionRecord,
} from '@agent-platform/contracts';
import { useCallback, useEffect, useState } from 'react';

import { FormError } from '../../../components/settings/FormError';
import { ApiRequestError, apiGet, apiPath, apiPost } from '../../../lib/apiClient';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState('');
  const [sessionId, setSessionId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sData, aData] = await Promise.all([
        apiGet<SessionRecord[]>(apiPath('sessions')),
        apiGet<Agent[]>(apiPath('agents')),
      ]);
      setSessions(sData);
      setAgents(aData);
      setAgentId((prev) => (prev ? prev : aData[0]?.id ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = SessionCreateBodySchema.safeParse({
      agentId: agentId.trim(),
      ...(sessionId.trim() ? { id: sessionId.trim() } : {}),
    });
    if (!body.success) {
      setError(body.error.message);
      return;
    }
    try {
      await apiPost<SessionRecord>(apiPath('sessions'), body.data);
      setSessionId('');
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
      <h2 style={{ fontSize: '1.1rem' }}>Sessions</h2>
      <p style={{ fontSize: '0.875rem', color: '#64748b' }}>List persisted sessions; create ties a new session to an agent.</p>
      <FormError message={error} />
      {loading ? <p>Loading…</p> : null}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {sessions.map((s) => (
          <li
            key={s.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '0.75rem',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
            }}
          >
            <code>{s.id}</code> — agent <code>{s.agentId}</code>
            <div style={{ color: '#64748b', marginTop: 4 }}>
              created {new Date(s.createdAtMs).toISOString()}
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void createSession(e)} style={{ maxWidth: 480, marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1rem' }}>Create session</h3>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="sess-agent" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Agent
          </label>
          <select
            id="sess-agent"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            required
            aria-required
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="sess-id" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
            Session id (optional)
          </label>
          <input
            id="sess-id"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="auto-generated if empty"
            style={{ width: '100%', padding: '0.35rem 0.5rem' }}
          />
        </div>
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
