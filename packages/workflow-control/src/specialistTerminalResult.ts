import { agentResultSchema, type AgentResult } from './contracts.js';

/** Accept only the structured terminal answer, never tool output or arbitrary JSONL events. */
export function specialistTerminalResult(value: unknown): AgentResult | undefined {
  const direct = agentResultSchema.safeParse(value);
  if (direct.success) return direct.data;
  if (
    typeof value !== 'object' ||
    value === null ||
    !('events' in value) ||
    !Array.isArray(value.events)
  ) {
    return undefined;
  }
  for (const event of [...value.events].reverse() as unknown[]) {
    if (
      typeof event !== 'object' ||
      event === null ||
      !('type' in event) ||
      event.type !== 'item.completed' ||
      !('item' in event)
    )
      continue;
    const item = event.item;
    if (
      typeof item !== 'object' ||
      item === null ||
      !('type' in item) ||
      item.type !== 'agent_message' ||
      !('text' in item) ||
      typeof item.text !== 'string'
    )
      continue;
    try {
      const result = agentResultSchema.safeParse(JSON.parse(item.text));
      return result.success ? result.data : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
