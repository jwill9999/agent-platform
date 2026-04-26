'use client';

import type { Agent, SessionRecord } from '@agent-platform/contracts';
import { useMemo } from 'react';
import { ChevronDown, History, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SessionDropdownProps {
  sessions: SessionRecord[];
  agents: Agent[];
  activeSessionId: string | null;
  selectedAgentId: string | null;
  onSelectSession: (session: SessionRecord) => void;
  onNewChatForAgent: (agentId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

interface AgentGroup {
  agentId: string;
  agentName: string;
  sessions: SessionRecord[];
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

export function SessionDropdown({
  sessions,
  agents,
  activeSessionId,
  selectedAgentId,
  onSelectSession,
  onNewChatForAgent,
  loading,
  disabled,
}: Readonly<SessionDropdownProps>) {
  const groups = useMemo((): AgentGroup[] => {
    const map = new Map<string, SessionRecord[]>();
    for (const session of sessions) {
      const list = map.get(session.agentId) ?? [];
      list.push(session);
      map.set(session.agentId, list);
    }

    return Array.from(map.entries()).map(([agentId, groupedSessions]) => ({
      agentId,
      agentName: agents.find((a) => a.id === agentId)?.name ?? 'Unknown',
      sessions: groupedSessions,
    }));
  }, [sessions, agents]);

  const canStartNewChat = Boolean(selectedAgentId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          aria-label="Open sessions menu"
          disabled={disabled}
        >
          <History className="h-4 w-4" />
          <span>Sessions</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px] max-h-[420px] overflow-y-auto">
        <DropdownMenuLabel>Session history</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => {
            if (!selectedAgentId) return;
            onNewChatForAgent(selectedAgentId);
          }}
          disabled={!canStartNewChat}
        >
          <Plus className="h-4 w-4 mr-2" />
          New chat with current agent
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {loading && <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading sessions...</p>}

        {!loading && groups.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No sessions yet</p>
        )}

        {groups.map((group) => (
          <details key={group.agentId} className="px-1" open={group.agentId === selectedAgentId}>
            <summary className="cursor-pointer rounded-sm px-2 py-1.5 text-xs uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {group.agentName} ({group.sessions.length})
            </summary>
            <div>
              {group.sessions.map((session) => (
                <DropdownMenuItem
                  key={session.id}
                  onClick={() => onSelectSession(session)}
                  className={session.id === activeSessionId ? 'bg-secondary' : ''}
                >
                  <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{session.title ?? 'Untitled'}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {relativeTime(session.updatedAtMs)}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onClick={() => onNewChatForAgent(group.agentId)}
                className="text-muted-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                New chat with {group.agentName}
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
          </details>
        ))}

        <DropdownMenuItem asChild>
          <a href="/settings/sessions">Manage sessions</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
