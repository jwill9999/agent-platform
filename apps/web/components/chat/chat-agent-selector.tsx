'use client';

import type { Agent } from '@agent-platform/contracts';
import { cn } from '@/lib/cn';
import { Bot, ChevronDown } from 'lucide-react';

export interface ChatAgentSelectorProps {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (agentId: string) => void;
  disabled?: boolean;
}

export function ChatAgentSelector({
  agents,
  selectedId,
  onSelect,
  disabled,
}: Readonly<ChatAgentSelectorProps>) {
  if (agents.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No agents — seed or create one in Settings</p>
    );
  }

  const selected = agents.find((a) => a.id === selectedId) ?? agents[0];

  return (
    <div className="relative inline-flex items-center gap-1 min-w-0 max-w-full">
      <Bot className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <select
        aria-label="Active agent"
        disabled={disabled}
        value={selected?.id ?? ''}
        onChange={(e) => {
          onSelect(e.target.value);
        }}
        className={cn(
          'appearance-none pl-1 pr-7 py-1.5 rounded-md border border-border bg-background',
          'text-sm font-medium truncate max-w-[220px] sm:max-w-[280px]',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
