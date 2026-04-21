'use client';

import type { Agent } from '@agent-platform/contracts';
import { Bot } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    <div className="inline-flex items-center gap-1.5 min-w-0">
      <Bot className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <Select value={selected?.id ?? ''} onValueChange={onSelect} disabled={disabled}>
        <SelectTrigger aria-label="Active agent" className="h-8 text-sm max-w-[220px] sm:max-w-[280px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
