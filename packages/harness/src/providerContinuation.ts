import { isDeepStrictEqual } from 'node:util';
import { modelMessageSchema, type ModelMessage } from 'ai';
import type { ProviderContinuationBinding, ProviderContinuationRecord } from '@agent-platform/db';
import type { ChatMessage, ToolCallIntent } from './types.js';

const continuation = Symbol('provider-continuation');
export type PrivateChatMetadata = {
  id?: string;
  /** Survives graph checkpoints; opaque material must be rehydrated from encrypted storage. */
  providerContinuationRequired?: boolean;
  [continuation]?: ProviderContinuationRecord;
};

export const PROVIDER_CONTINUATION_RECOVERY_MESSAGE =
  'Provider continuation is unavailable or invalid. Start a new chat. If this persists, check the existing model and private-storage settings.';

function invalidContinuation(): never {
  throw new Error(PROVIDER_CONTINUATION_RECOVERY_MESSAGE);
}

export function getProviderContinuation(
  message: ChatMessage,
): ProviderContinuationRecord | undefined {
  const record = message[continuation];
  if (message.providerContinuationRequired && !record) invalidContinuation();
  return record;
}

/** Symbol keys survive object spreads but are absent from JSON/checkpoints/public projections. */
export function attachProviderContinuation(
  message: ChatMessage,
  record: ProviderContinuationRecord,
): ChatMessage {
  return { ...message, providerContinuationRequired: true, [continuation]: record };
}

export function withoutProviderContinuation(message: ChatMessage): ChatMessage {
  const result = { ...message };
  delete result[continuation];
  delete result.providerContinuationRequired;
  return result;
}

export function continuationBindingMatches(
  actual: ProviderContinuationBinding,
  expected: ProviderContinuationBinding,
): boolean {
  return isDeepStrictEqual(actual, expected);
}

type OpaquePart = {
  type: string;
  text?: string;
  providerOptions?: Record<string, Record<string, unknown>>;
};
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function validateSignedReasoning(part: OpaquePart, provider: string): void {
  const options = part.providerOptions?.[provider];
  if (provider === 'openai' || provider === 'xai') {
    if (!nonempty(options?.reasoningEncryptedContent) || !nonempty(options?.itemId))
      invalidContinuation();
  } else if (provider === 'anthropic') {
    if (nonempty(options?.signature) === nonempty(options?.redactedData)) invalidContinuation();
    if (options?.redactedData !== undefined && part.text !== '') invalidContinuation();
  }
}
function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function validateRouterDetail(value: unknown): Record<string, unknown> {
  const detail = object(value);
  if (!detail || typeof detail.type !== 'string') invalidContinuation();
  if (detail.id != null && typeof detail.id !== 'string') invalidContinuation();
  if (
    detail.index !== undefined &&
    (typeof detail.index !== 'number' || !Number.isFinite(detail.index))
  )
    invalidContinuation();
  if (detail.format != null && typeof detail.format !== 'string') invalidContinuation();
  if (detail.signature != null && typeof detail.signature !== 'string') invalidContinuation();
  if (detail.type === 'reasoning.encrypted' && !nonempty(detail.data)) invalidContinuation();
  if (detail.type === 'reasoning.summary' && typeof detail.summary !== 'string')
    invalidContinuation();
  if (detail.type === 'reasoning.text') {
    if (detail.text != null && typeof detail.text !== 'string') invalidContinuation();
    const format = detail.format ?? 'anthropic-claude-v1';
    if (
      (format === 'anthropic-claude-v1' || format === 'google-gemini-v1') &&
      !nonempty(detail.signature)
    )
      invalidContinuation();
  } else if (!['reasoning.encrypted', 'reasoning.summary'].includes(detail.type))
    invalidContinuation();
  return detail;
}
function validateRouterArray(details: unknown[], seen: Map<string, Record<string, unknown>>): void {
  const local = new Set<string>();
  for (const value of details) {
    const detail = validateRouterDetail(value);
    const identity = `${String(detail.type)}:${typeof detail.id === 'string' ? detail.id : typeof detail.index === 'number' ? detail.index : JSON.stringify(detail)}`;
    if (local.has(identity)) invalidContinuation();
    local.add(identity);
    const previous = seen.get(identity);
    if (previous && !isDeepStrictEqual(previous, detail)) invalidContinuation();
    seen.set(identity, detail);
  }
}
function validateRouterDetails(containers: (OpaquePart['providerOptions'] | undefined)[]): void {
  const seen = new Map<string, Record<string, unknown>>();
  for (const container of containers) {
    const details = container?.openrouter?.reasoning_details;
    if (details === undefined) continue;
    if (!Array.isArray(details)) invalidContinuation();
    validateRouterArray(details, seen);
  }
}

// Matches pinned @ai-sdk/google 4.0.99 getGoogleModelCapabilities. Validation only;
// the maintained adapter remains the sole owner of request serialization.
function usesSignedGoogleCalls(model: string): boolean {
  const gemini = /(^|[/.])gemini-/i.test(model);
  const legacy =
    /(^|[/.])gemini-[12](?:[.-]|$)/i.test(model) ||
    /(^|[/.])gemini-pro(?:-vision)?$/i.test(model) ||
    /(^|[/.])gemini-robotics-er-1\.5(?:[.-]|$)/i.test(model);
  return gemini && !legacy;
}
/** Canonical SDK parts that cannot safely be reduced to public text/tool history. */
export function requiresProviderContinuation(
  responseMessages: unknown[],
  model?: Pick<ProviderContinuationBinding, 'provider' | 'model'>,
): boolean {
  for (const value of responseMessages) {
    const message = object(value);
    if (!message || message.role !== 'assistant') continue;
    const parts = Array.isArray(message.content) ? message.content : [];
    const containers = [message, ...parts.map(object).filter((part) => part !== undefined)];
    if (parts.some((part) => object(part)?.type === 'reasoning')) return true;
    if (
      model?.provider === 'google' &&
      usesSignedGoogleCalls(model.model) &&
      parts.some((part) => object(part)?.type === 'tool-call')
    )
      return true;
    for (const container of containers) {
      const options = object(container.providerOptions);
      if (!options) continue;
      for (const vendor of Object.values(options)) {
        const metadata = object(vendor);
        if (!metadata) continue;
        if (
          ['reasoningEncryptedContent', 'signature', 'redactedData', 'thoughtSignature'].some(
            (key) => metadata[key] != null,
          )
        )
          return true;
        const details = metadata.reasoning_details;
        if (details !== undefined && (!Array.isArray(details) || details.length > 0)) return true;
      }
    }
  }
  return false;
}
function validateGoogleGroup(parts: OpaquePart[], binding: ProviderContinuationBinding): void {
  if (binding.provider !== 'google' || !usesSignedGoogleCalls(binding.model)) return;
  const first = parts.find((part) => part.type === 'tool-call');
  // Only the first function in a parallel group requires a signature; unsigned
  // siblings and unsigned reasoning text are valid native Google responses.
  if (first && !nonempty(first.providerOptions?.google?.thoughtSignature)) invalidContinuation();
}
function validateOpaqueParts(parts: OpaquePart[], binding: ProviderContinuationBinding): void {
  const provider = binding.provider;
  validateGoogleGroup(parts, binding);
  const reasoning = new Map<string, { encrypted: unknown; empty: boolean }>();
  const serialized = new Set<string>();
  for (const part of parts) {
    if (!['text', 'reasoning', 'tool-call'].includes(part.type)) invalidContinuation();
    const options = part.providerOptions?.[provider];
    if (options?.thoughtSignature != null && !nonempty(options.thoughtSignature))
      invalidContinuation();
    if (part.type !== 'reasoning') continue;
    validateSignedReasoning(part, provider);
    const fingerprint = JSON.stringify(part);
    if (serialized.has(fingerprint)) invalidContinuation();
    serialized.add(fingerprint);
    const id = options?.itemId;
    if (typeof id !== 'string') continue;
    const previous = reasoning.get(id);
    if (
      previous &&
      (part.text === '' ||
        previous.empty ||
        previous.encrypted !== options?.reasoningEncryptedContent)
    )
      invalidContinuation();
    reasoning.set(id, { encrypted: options?.reasoningEncryptedContent, empty: part.text === '' });
  }
}

/** Validate canonical SDK/public capture before display-only project path sanitization. */
export function validateCapturedProviderText(
  message: ChatMessage,
  record: ProviderContinuationRecord,
): void {
  const assistant = validateProviderContinuation(message, record);
  const parts =
    typeof assistant.content === 'string'
      ? [{ type: 'text', text: assistant.content }]
      : assistant.content;
  const text = parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
  if (message.content !== text) invalidContinuation();
}

/** Single external SDK step must contain exactly its assistant response, including opaque parts. */
export function validateProviderContinuation(
  message: ChatMessage,
  record: ProviderContinuationRecord,
): ModelMessage {
  if (message.role !== 'assistant' || record.version !== 1 || record.responseMessages.length !== 1)
    invalidContinuation();
  if (Buffer.byteLength(JSON.stringify(record)) > 256 * 1024) invalidContinuation();
  const parsed = modelMessageSchema.safeParse(record.responseMessages[0]);
  if (!parsed.success || parsed.data.role !== 'assistant') invalidContinuation();
  const assistant = parsed.data;
  const parts = typeof assistant.content === 'string' ? [] : assistant.content;
  validateOpaqueParts(parts, record.binding);
  if (record.binding.provider === 'openrouter')
    validateRouterDetails([
      assistant.providerOptions,
      ...parts.map((part) => ('providerOptions' in part ? part.providerOptions : undefined)),
    ]);
  const calls = parts.filter((part) => part.type === 'tool-call');
  const expected: ToolCallIntent[] = message.toolCalls ?? [];
  if (calls.length !== expected.length) invalidContinuation();
  const ids = new Set<string>();
  for (const call of calls) {
    if (ids.has(call.toolCallId)) invalidContinuation();
    ids.add(call.toolCallId);
    const matched = expected.find((item) => item.id === call.toolCallId);
    if (
      !matched ||
      call.toolName !== matched.name.replaceAll(':', '__') ||
      !isDeepStrictEqual(call.input, matched.args)
    )
      invalidContinuation();
  }
  return assistant;
}

/** Apply binding before admission, never replay another provider's opaque data. */
export function projectProviderContinuation(
  message: ChatMessage,
  expected: ProviderContinuationBinding | undefined,
  pendingIds: readonly string[] = [],
): ModelMessage | undefined {
  const record = getProviderContinuation(message);
  if (!record) return undefined;
  const validated = validateProviderContinuation(message, record);
  if (!expected || !continuationBindingMatches(record.binding, expected)) {
    if (
      message.role === 'assistant' &&
      message.toolCalls?.some((call) => pendingIds.includes(call.id))
    )
      invalidContinuation();
    return undefined;
  }
  return validated;
}
