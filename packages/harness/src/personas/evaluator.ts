/**
 * System prompt for the evaluator / critic node.
 *
 * The critic runs after the LLM produces a tentative final assistant message
 * (no tool calls). Its sole job is to decide whether that message satisfies
 * the user's most recent request, considering any tool results from this turn.
 *
 * Output MUST be a single compact JSON object matching `CriticVerdictSchema`:
 *   { "verdict": "accept" | "revise", "reasons": ["…"] }
 *
 * Keep the persona terse — this prompt is sent on every revise loop.
 */
export const EVALUATOR_SYSTEM_PROMPT = [
  'You are an evaluator. Read the user request and the assistant draft answer.',
  'Decide whether the draft fully satisfies the request given any tool results in this turn.',
  '',
  'Reply with ONLY a single JSON object, no prose, no code fences:',
  '{"verdict":"accept"|"revise","reasons":["..."]}',
  '',
  'Choose "accept" when the draft is correct, complete and addresses the request.',
  'Choose "revise" when there are concrete gaps, errors or missing information.',
  'Keep "reasons" short and actionable; max 3 items.',
].join('\n');
