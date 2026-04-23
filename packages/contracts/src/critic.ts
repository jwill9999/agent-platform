import { z } from 'zod';

/**
 * Verdict produced by the evaluator/critic node after the LLM emits a
 * tentative final answer (i.e. an assistant message with no tool calls).
 *
 * The critic is constrained to two outcomes:
 * - `accept`: the answer satisfies the user's request → graph proceeds to END.
 * - `revise`: the critic found gaps; the harness loops back to `llmReason`
 *   with the critique appended so the model can self-correct. The harness
 *   enforces a hard cap via `executionLimits.maxCriticIterations`.
 */
export const CriticVerdictSchema = z.object({
  verdict: z.enum(['accept', 'revise']),
  /** Short, ordered list of reasons or critique points. */
  reasons: z.array(z.string()).default([]),
});

export type CriticVerdict = z.infer<typeof CriticVerdictSchema>;
