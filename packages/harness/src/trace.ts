/** Observability events emitted by the harness graph (append-only in state). */
export type TraceEvent =
  | { type: 'graph_start'; runId: string }
  | { type: 'plan_ready'; planId: string; taskCount: number }
  | { type: 'task_start'; taskId: string; step: number }
  | { type: 'task_done'; taskId: string; step: number; ok: boolean }
  | { type: 'limit_hit'; kind: 'max_steps' }
  | { type: 'graph_end' };
