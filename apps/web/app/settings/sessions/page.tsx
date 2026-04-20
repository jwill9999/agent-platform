'use client';

import { SessionCreateBodySchema, type Agent, type SessionRecord } from '@agent-platform/contracts';
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPath, apiPost, ApiRequestError } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageSquare, Loader2 } from 'lucide-react';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sData, aData] = await Promise.all([
        apiGet<SessionRecord[]>(apiPath('sessions')),
        apiGet<Agent[]>(apiPath('agents')),
      ]);
      setSessions(sData ?? []);
      setAgents(aData ?? []);
      setAgentId((prev) => prev || ((aData ?? [])[0]?.id ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (agents.length === 0) return;
    setError(null);
    const body = SessionCreateBodySchema.safeParse({
      agentId: agentId.trim(),
      ...(sessionId.trim() ? { id: sessionId.trim() } : {}),
    });
    if (!body.success) { setError(body.error.message); return; }
    setCreating(true);
    try {
      await apiPost<SessionRecord>(apiPath('sessions'), body.data);
      setSessionId('');
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border bg-card/50">
        <h1 className="text-xl font-semibold text-foreground">Sessions</h1>
        <p className="text-sm text-muted-foreground">View and create agent sessions</p>
      </header>

      {error && (
        <div className="px-6 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl space-y-6">
          {/* Create session form */}
          <div className="p-5 rounded-xl border border-border bg-card">
            <h2 className="text-lg font-medium text-foreground mb-4">New Session</h2>
            {agents.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground">
                No agents available.{' '}
                <a href="/settings/agents" className="text-primary hover:underline">Create an agent</a> first.
              </p>
            ) : (
              <form onSubmit={(e) => { createSession(e); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sess-agent">Agent</Label>
                    <select
                      id="sess-agent"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      disabled={agents.length === 0}
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sess-id">Session ID (optional)</Label>
                    <Input
                      id="sess-id"
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={agents.length === 0 || creating}>
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Session
                </Button>
              </form>
            )}
          </div>

          {/* Session list */}
          <div>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Active Sessions {!loading && <span className="text-muted-foreground text-sm font-normal">({sessions.length})</span>}
            </h2>

            {loading && (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No sessions yet</p>
              </div>
            )}
            {!loading && sessions.length > 0 && (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                    <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.title ?? 'Untitled'}
                      </p>
                      <code className="text-xs font-mono text-muted-foreground truncate block mt-0.5">{s.id}</code>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created {new Date(s.createdAtMs).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {agents.find((a) => a.id === s.agentId)?.name ?? s.agentId}
                    </Badge>
                    <a
                      href="/"
                      className="text-xs text-primary hover:underline shrink-0"
                      title="Open this session in chat"
                    >
                      Open in Chat
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
