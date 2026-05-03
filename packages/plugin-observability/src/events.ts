import type {
  SensorAgentProfile,
  SensorProviderAvailability,
  SensorResult,
  SensorRunRecord,
  SensorRuntimeLimitation,
  SensorTrigger,
} from '@agent-platform/contracts';

/**
 * Structured observability events — **no** raw prompt text or tool args unless explicitly enabled
 * in {@link ObservabilityPluginOptions}.
 */
export type SensorMcpCapabilityAvailability = Readonly<{
  serverId: string;
  serverName?: string;
  capability: string;
  state: SensorProviderAvailability['state'];
  selectedForReflection: boolean;
  message?: string;
}>;

export type ObservabilityEvent = Readonly<
  | { kind: 'session_start'; sessionId: string; agentId: string }
  | {
      kind: 'task_start';
      sessionId: string;
      runId: string;
      planId: string;
      taskId: string;
      toolIds: readonly string[];
    }
  | {
      kind: 'prompt_build';
      sessionId: string;
      runId: string;
      planId: string | null;
      messageCount: number;
    }
  | {
      kind: 'tool_call';
      sessionId: string;
      runId: string;
      toolId: string;
      /** Present only when {@link ObservabilityPluginOptions.includeToolArgs} is true. */
      args?: Readonly<Record<string, unknown>>;
    }
  | {
      kind: 'task_end';
      sessionId: string;
      runId: string;
      taskId: string;
      ok: boolean;
      detail?: string;
    }
  | {
      kind: 'dod_check';
      sessionId: string;
      runId: string;
      passed: boolean;
      criteriaCount: number;
      failedCriteriaCount: number;
    }
  | {
      kind: 'sensor_run';
      sessionId: string;
      runId: string;
      trigger: SensorTrigger;
      agentProfile: SensorAgentProfile;
      taskContexts: readonly string[];
      records: readonly SensorRunRecord[];
      results: readonly SensorResult[];
      providerAvailability: readonly SensorProviderAvailability[];
      runtimeLimitations: readonly SensorRuntimeLimitation[];
      mcpCapabilities: readonly SensorMcpCapabilityAvailability[];
    }
  | {
      kind: 'error';
      sessionId: string;
      runId: string;
      phase: 'session' | 'task' | 'prompt' | 'tool' | 'unknown';
      message: string;
    }
>;
