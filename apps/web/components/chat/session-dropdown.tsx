'use client';

import type { Agent, SessionRecord } from '@agent-platform/contracts';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, History, MessageSquare, Plus } from 'lucide-react';
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
  // Guard against clock drift / future timestamps.
  const diff = Math.max(Date.now() - ms, 0);
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groups = useMemo((): AgentGroup[] => {
    const map = new Map<string, SessionRecord[]>();
    for (const session of sessions) {
      const list = map.get(session.agentId) ?? [];
      list.push(session);
      map.set(session.agentId, list);
    }

    const grouped = Array.from(map.entries()).map(([agentId, groupedSessions]) => {
      const sortedSessions = [...groupedSessions].sort((a, b) => b.updatedAtMs - a.updatedAtMs);

      return {
        agentId,
        agentName: agents.find((a) => a.id === agentId)?.name ?? 'Unknown',
        sessions: sortedSessions,
      };
    });

    return grouped.sort((a, b) => {
      const latestA = a.sessions[0]?.updatedAtMs ?? 0;
      const latestB = b.sessions[0]?.updatedAtMs ?? 0;
      return latestB - latestA;
    });
  }, [sessions, agents]);

  const canStartNewChat = Boolean(selectedAgentId);

  const isGroupOpen = (agentId: string): boolean => {
    if (agentId in openGroups) return openGroups[agentId] ?? false;
    return agentId === selectedAgentId;
  };

  const toggleGroup = (agentId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [agentId]: !(agentId in prev ? prev[agentId] : agentId === selectedAgentId),
    }));
  };

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

        {loading && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading sessions...</div>
        )}

        {!loading && groups.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No sessions yet</div>
        )}

        {groups.map((group) => (
          <div key={group.agentId} className="px-1">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                toggleGroup(group.agentId);
              }}
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              <ChevronRight
                className={
                  isGroupOpen(group.agentId)
                    ? 'h-4 w-4 mr-2 rotate-90 transition-transform'
                    : 'h-4 w-4 mr-2 transition-transform'
                }
              />
              <span>
                {group.agentName} ({group.sessions.length})
              </span>
            </DropdownMenuItem>
            {isGroupOpen(group.agentId) && (
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
            )}
            <DropdownMenuSeparator />
          </div>
        ))}

        <DropdownMenuItem asChild>
          <a href="/settings/sessions">Manage sessions</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
