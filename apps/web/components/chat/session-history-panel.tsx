'use client';

import type { Agent, SessionRecord } from '@agent-platform/contracts';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { MessageSquare, Plus, PanelLeftClose, PanelLeft } from 'lucide-react';

export interface SessionHistoryPanelProps {
  sessions: SessionRecord[];
  agents: Agent[];
  activeSessionId: string | null;
  onSelectSession: (session: SessionRecord) => void;
  onNewChatForAgent: (agentId: string) => void;
  loading?: boolean;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

interface AgentGroup {
  agentId: string;
  agentName: string;
  sessions: SessionRecord[];
}

export function SessionHistoryPanel({
  sessions,
  agents,
  activeSessionId,
  onSelectSession,
  onNewChatForAgent,
  loading,
}: Readonly<SessionHistoryPanelProps>) {
  const [collapsed, setCollapsed] = useState(false);

  const groups = useMemo((): AgentGroup[] => {
    const map = new Map<string, SessionRecord[]>();
    for (const s of sessions) {
      const list = map.get(s.agentId) ?? [];
      list.push(s);
      map.set(s.agentId, list);
    }
    return Array.from(map.entries()).map(([agentId, items]) => ({
      agentId,
      agentName: agents.find((a) => a.id === agentId)?.name ?? 'Unknown',
      sessions: items,
    }));
  }, [sessions, agents]);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 px-1 border-r border-border bg-card/50">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-md hover:bg-muted/50 text-muted-foreground"
          aria-label="Expand session panel"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 shrink-0 border-r border-border bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">Sessions</h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground"
          aria-label="Collapse panel"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {loading && sessions.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <span className="text-xs text-muted-foreground">Loading…</span>
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No sessions yet</p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.agentId} className="border-b border-border/50 last:border-b-0">
            {/* Agent group header */}
            <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {group.agentName}
              </span>
              <button
                type="button"
                onClick={() => onNewChatForAgent(group.agentId)}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                aria-label={`New chat with ${group.agentName}`}
                title={`New chat with ${group.agentName}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Sessions in this group */}
            {group.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession(session)}
                className={cn(
                  'w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors',
                  'focus:outline-none focus:bg-muted/50',
                  session.id === activeSessionId && 'bg-muted/70',
                )}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate leading-tight">
                      {session.title ?? 'Untitled'}
                    </p>
                    <span className="text-[11px] text-muted-foreground/60">
                      {relativeTime(session.updatedAtMs)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
