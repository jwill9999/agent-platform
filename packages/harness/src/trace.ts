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
  | { type: 'loop_detected'; toolSignature: string; repeats: number }
  | { type: 'limit_hit'; kind: 'max_steps' | 'timeout' | 'max_tokens' | 'max_cost' }
  | { type: 'plan_failed'; reason: string }
  | { type: 'graph_end' };
