'use client';

import type { ModelConfig } from '@agent-platform/contracts';
import { Cpu } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ChatModelSelectorProps {
  modelConfigs: ModelConfig[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}

export function ChatModelSelector({
  modelConfigs,
  selectedId,
  onSelect,
  disabled,
}: Readonly<ChatModelSelectorProps>) {
  if (modelConfigs.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 min-w-0">
      <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <Select
        value={selectedId ?? '__default__'}
        onValueChange={(v) => {
          onSelect(v === '__default__' ? null : v);
        }}
        disabled={disabled}
      >
        <SelectTrigger aria-label="Active model" className="h-8 text-sm max-w-[220px] sm:max-w-[280px]">
          <SelectValue placeholder="Default (agent config)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">Default (agent config)</SelectItem>
          <SelectSeparator />
          {modelConfigs.map((cfg) => (
            <SelectItem key={cfg.id} value={cfg.id}>
              <span>{cfg.name}</span>
              <span className="text-muted-foreground text-xs ml-1">
                · {cfg.provider}/{cfg.model}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
