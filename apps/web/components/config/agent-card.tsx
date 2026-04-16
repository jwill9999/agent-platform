'use client';

import type { Agent } from '@agent-platform/contracts';
import { Bot, MoreVertical, Pencil, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AgentCardProps {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function AgentCard({ agent, onEdit, onDelete, onDuplicate }: AgentCardProps) {
  return (
    <div className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button type="button" onClick={onEdit} className="block text-left w-full">
        <h3 className="font-semibold text-foreground mb-1">{agent.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {agent.description || agent.systemPrompt.slice(0, 100)}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {agent.modelOverride && (
            <Badge variant="secondary" className="text-xs">
              {agent.modelOverride.model}
            </Badge>
          )}
          {agent.allowedSkillIds.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {agent.allowedSkillIds.length} skill
              {agent.allowedSkillIds.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {agent.allowedMcpServerIds.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {agent.allowedMcpServerIds.length} MCP
            </Badge>
          )}
          {agent.allowedToolIds.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {agent.allowedToolIds.length} tool{agent.allowedToolIds.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Max {agent.executionLimits.maxSteps} steps · {agent.executionLimits.timeoutMs / 1000}s
          timeout
        </p>
      </button>
    </div>
  );
}
