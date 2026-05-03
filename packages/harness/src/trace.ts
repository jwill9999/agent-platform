import type {
  RiskTier,
  SensorAgentProfile,
  SensorResultStatus,
  SensorTrigger,
} from '@agent-platform/contracts';

/** Observability events emitted by the harness graph (append-only in state). */
export type TraceEvent =
  | { type: 'graph_start'; runId: string }
  | { type: 'plan_ready'; planId: string; taskCount: number }
  | { type: 'task_start'; taskId: string; step: number }
  | { type: 'task_done'; taskId: string; step: number; ok: boolean }
  | {
      type: 'llm_call';
      step: number;
      tokenUsage?: { promptTokens: number; completionTokens: number };
    }
  | { type: 'tool_dispatch'; toolId: string; step: number; ok: boolean }
  | { type: 'tool_approval_required'; toolId: string; step: number; riskTier?: RiskTier }
  | { type: 'tool_timeout'; toolId: string; step: number; timeoutMs: number }
  | { type: 'llm_retry'; step: number; attempt: number; error: string; delayMs: number }
  | {
      type: 'tool_retry';
      toolId: string;
      step: number;
      attempt: number;
      error: string;
      delayMs: number;
    }
  | { type: 'loop_detected'; toolSignature: string; repeats: number }
  | { type: 'limit_hit'; kind: 'max_steps' | 'timeout' | 'max_tokens' | 'max_cost' }
  | {
      type: 'rate_limit_hit';
      toolId: string;
      count: number;
      limit: number;
      windowMs: number;
    }
  | { type: 'deadline_exceeded'; elapsedMs: number; deadlineMs: number }
  | { type: 'plan_failed'; reason: string }
  | { type: 'security_warning'; detail: string }
  | { type: 'stream_aborted'; reason: 'client_disconnect' | 'timeout' }
  | {
      type: 'context_window';
      contextTokens: number;
      messagesTotal: number;
      messagesIncluded: number;
      strategy: string;
    }
  | {
      type: 'memory_retrieval';
      included: number;
      omitted: {
        expired: number;
        lowConfidence: number;
        unsafe: number;
        notRelevant: number;
        crossScope: number;
      };
    }
  | { type: 'skill_loaded'; skillId: string; loadCount: number }
  | { type: 'skill_load_loop'; skillId: string; loadCount: number }
  | {
      type: 'critic_verdict';
      iterations: number;
      verdict: 'accept' | 'revise';
      reasons: string[];
      capReached?: boolean;
    }
  | {
      type: 'dod_check';
      passed: boolean;
      criteriaCount: number;
      failedCriteria: string[];
    }
  | {
      type: 'sensor_run';
      sensorId: string;
      trigger: SensorTrigger;
      profile?: SensorAgentProfile;
      required: boolean;
    }
  | {
      type: 'sensor_result';
      sensorId: string;
      status: SensorResultStatus;
      findingCount: number;
      repairInstructionCount: number;
    }
  | {
      type: 'sensor_loop_limit';
      sensorId: string;
      repeats: number;
      reason: string;
    }
  | { type: 'graph_end' };
