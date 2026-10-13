import { describe, expect, it } from 'vitest';
import { admitProviderContext, estimateProviderInput } from '../src/providerContext.js';
import { buildToolNameMap, toCoreMessages } from '../src/nodes/llmReason.js';
import type { ChatMessage } from '../src/types.js';

const policy = { maxInputTokens: 8000, maxOutputTokens: 2048, strategy: 'truncate' as const };
function admit(
  messages: ChatMessage[],
  maxInputTokens = 8000,
  currentTurnStartIndex?: number,
  mappedTools: unknown = [],
) {
  return admitProviderContext({
    messages,
    mappedMessages: toCoreMessages(messages),
    mappedTools,
    contextWindow: { ...policy, maxInputTokens },
    currentTurnStartIndex,
  });
}
const group: ChatMessage[] = [
  {
    role: 'assistant',
    content: '',
    toolCalls: [
      { id: 'a', name: 'one', args: { value: '雪"\\\n' } },
      { id: 'b', name: 'two', args: {} },
    ],
  },
  { role: 'tool', toolCallId: 'b', toolName: 'two', content: 'two result' },
  { role: 'tool', toolCallId: 'a', toolName: 'one', content: 'one result' },
];

describe('provider context admission', () => {
  it('counts final mapped names, strict schema descriptions, JSON escaping and Unicode deterministically', () => {
    const messages: ChatMessage[] = [{ role: 'user', content: '雪😀"\\\n' }, ...group];
    const { mappedSchemas } = buildToolNameMap([
      {
        name: 'mcp:one',
        description: 'description雪',
        parameters: {
          type: 'object',
          properties: { value: { type: 'string', description: 'nested' } },
        },
      },
    ]);
    expect(mappedSchemas[0]).toMatchObject({
      name: 'mcp__one',
      parameters: { additionalProperties: false, required: ['value'] },
    });
    const mapped = toCoreMessages(messages);
    const expected = Math.ceil(
      JSON.stringify({ messages: mapped, tools: mappedSchemas }).length / 4,
    );
    expect(estimateProviderInput(mapped, mappedSchemas)).toBe(expected);
    expect(admit(messages, 8000, 0, mappedSchemas).decision.estimatedInputAfter).toBe(expected);
  });

  it('admits exact effective threshold and halts one token below it', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'required' },
      { role: 'user', content: 'hello'.repeat(30) },
    ];
    const estimate = admit(messages).decision.estimatedInputAfter;
    const budget = Math.ceil(estimate / 0.9);
    expect(admit(messages, budget).admitted).toBe(true);
    const below = admit(messages, budget - 1);
    expect(below.admitted).toBe(false);
    expect(below.decision.reason).toBe('required_overflow');
  });

  it('keeps multi-call/result groups atomic and does not mutate source history', () => {
    const history: ChatMessage[] = [
      { role: 'system', content: 'instructions' },
      { role: 'user', content: 'old' },
      ...group,
      { role: 'user', content: 'new' },
    ];
    const snapshot = structuredClone(history);
    const required = [history[0]!, history.at(-1)!];
    const budget = Math.ceil((estimateProviderInput(toCoreMessages(required), []) + 4) / 0.9);
    const result = admit(history, budget, 5);
    expect(result.messages).toEqual(toCoreMessages(required));
    expect(result.decision).toMatchObject({
      reason: 'windowed',
      includedGroups: 2,
      omittedGroups: 2,
    });
    expect(history).toEqual(snapshot);
  });

  it('protects all active-turn effects and feedback even if a newer user-like feedback marker exists', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'original' },
      ...group,
      { role: 'user', content: 'feedback' },
      { role: 'assistant', content: 'large'.repeat(500) },
    ];
    expect(admit(messages, 100, 0).decision.reason).toBe('required_overflow');
    expect(admit(messages, 8000, 0).messages).toEqual(toCoreMessages(messages));
  });

  it.each([
    [{ role: 'user', content: 'current' }, group[1]],
    [{ role: 'user', content: 'current' }, group[0], group[1]],
    [{ role: 'user', content: 'current' }, ...group, group[1]],
    [{ role: 'user', content: 'current' }, group[0], group[1], { ...group[2], toolName: 'wrong' }],
  ])('rejects orphan, missing, duplicate and mismatched results', (...messages) => {
    expect(admit(messages as ChatMessage[]).decision.reason).toBe('invalid_history');
  });

  it('rejects missing explicit active-turn identity and preserves both strategy compatibility values', () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'hello' }];
    expect(admit(messages, 8000, -1).admitted).toBe(false);
    const result = admitProviderContext({
      messages,
      mappedMessages: toCoreMessages(messages),
      mappedTools: [],
      contextWindow: { ...policy, strategy: 'summarize' },
    });
    expect(result.decision).toMatchObject({
      requestedStrategy: 'summarize',
      effectivePolicy: 'group_window_working_memory_v1',
      reason: 'unchanged',
    });
  });

  it('never drops tool schemas to manufacture a fit', () => {
    const result = admit([{ role: 'user', content: 'hello' }], 100, 0, [
      { description: 'x'.repeat(1000) },
    ]);
    expect(result.decision.reason).toBe('required_overflow');
    expect(result.decision.schemaEstimate).toBeGreaterThan(100);
  });
});

describe('approval-backed history projection', () => {
  function withApprovals(
    messages: ChatMessage[],
    boundary: number,
    approvalToolCallIds: string[],
    pendingApprovalToolCallIds: string[] = [],
  ) {
    return admitProviderContext({
      messages,
      mappedMessages: toCoreMessages(messages),
      mappedTools: [],
      currentTurnStartIndex: boundary,
      approvalToolCallIds,
      pendingApprovalToolCallIds,
    });
  }
  const ask: ChatMessage = {
    role: 'assistant',
    content: '',
    toolCalls: [{ id: 'ask', name: 'write', args: { text: 'reviewed' } }],
  };
  const actual: ChatMessage = {
    role: 'tool',
    toolCallId: 'ask',
    toolName: 'write',
    content: 'actual persisted outcome',
  };

  it('omits only a corroborated older pending group and counts the omission without inventing results', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'old' },
      ask,
      { role: 'user', content: 'new' },
    ];
    const snapshot = structuredClone(messages);
    const result = withApprovals(messages, 2, ['ask'], ['ask']);
    expect(result.admitted).toBe(true);
    expect(result.decision).toMatchObject({ reason: 'windowed', omittedGroups: 1 });
    expect(result.messages).toEqual(toCoreMessages([messages[0]!, messages[2]!]));
    expect(messages).toEqual(snapshot);
    expect(withApprovals(messages, 2, [], []).decision.reason).toBe('invalid_history');
  });

  it('never drops a required pending group and requires every missing sibling to be corroborated', () => {
    const active: ChatMessage[] = [{ role: 'user', content: 'current' }, ask];
    expect(withApprovals(active, 0, ['ask'], ['ask']).decision.reason).toBe('invalid_history');
    const messages: ChatMessage[] = [
      { role: 'user', content: 'old' },
      group[0]!,
      { role: 'user', content: 'new' },
    ];
    expect(withApprovals(messages, 2, ['a'], ['a']).decision.reason).toBe('invalid_history');
    expect(withApprovals(messages, 2, ['a', 'b'], ['a', 'b']).admitted).toBe(true);
  });

  it('pairs a delayed actual result only with approval provenance, preserving raw graph order and arguments', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'original' },
      ask,
      { role: 'user', content: 'later ordinary turn' },
      { role: 'assistant', content: 'later answer' },
      actual,
    ];
    const snapshot = structuredClone(messages);
    const result = withApprovals(messages, 0, ['ask']);
    expect(result.admitted).toBe(true);
    expect(result.messages).toEqual(
      toCoreMessages([messages[0]!, ask, actual, messages[2]!, messages[3]!]),
    );
    expect(messages).toEqual(snapshot);
    expect(withApprovals(messages, 0, []).decision.reason).toBe('invalid_history');
  });

  it('retains completed sibling effects and pairs only the later approval result in a multi-call group', () => {
    const multi: ChatMessage = {
      role: 'assistant',
      content: '',
      toolCalls: [
        { id: 'read', name: 'read', args: {} },
        { id: 'ask', name: 'write', args: { text: 'reviewed' } },
      ],
    };
    const read: ChatMessage = {
      role: 'tool',
      toolCallId: 'read',
      toolName: 'read',
      content: 'already completed',
    };
    const messages: ChatMessage[] = [
      { role: 'user', content: 'original' },
      multi,
      read,
      { role: 'user', content: 'later' },
      actual,
    ];
    const result = withApprovals(messages, 0, ['ask']);
    expect(result.messages).toEqual(
      toCoreMessages([messages[0]!, multi, read, actual, messages[3]!]),
    );
    expect(result.messages.filter((m) => m.role === 'tool')).toHaveLength(2);
    expect(withApprovals([...messages, actual], 0, ['ask']).decision.reason).toBe(
      'invalid_history',
    );
    expect(withApprovals(messages.slice(0, -1), 0, ['ask'], ['ask']).decision.reason).toBe(
      'invalid_history',
    );
  });
});
