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
  | { type: 'plan_failed'; reason: string }
  | { type: 'stream_aborted'; reason: 'client_disconnect' | 'timeout' }
  | {
      type: 'context_window';
      contextTokens: number;
      messagesTotal: number;
      messagesIncluded: number;
      strategy: string;
    }
  | { type: 'graph_end' };
