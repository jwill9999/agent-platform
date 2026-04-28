'use client';

import React, { createContext, useContext } from 'react';
import type { Agent, ModelConfig } from '@agent-platform/contracts';

export interface AgentModelContextShape {
  agents: Agent[];
  modelConfigs: ModelConfig[];
  selectedAgentId: string | null;
  selectedModelConfigId: string | null;
  onSelectAgent?: (id: string) => void;
  onSelectModelConfig?: (id: string | null) => void;
  selectorDisabled?: boolean;
}

const AgentModelContext = createContext<AgentModelContextShape | undefined>(undefined);

export function AgentModelProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AgentModelContextShape;
}) {
  return <AgentModelContext.Provider value={value}>{children}</AgentModelContext.Provider>;
}

export function useAgentModelContext(): AgentModelContextShape {
  const ctx = useContext(AgentModelContext);
  if (!ctx) throw new Error('useAgentModelContext must be used within AgentModelProvider');
  return ctx;
}

export default AgentModelContext;
