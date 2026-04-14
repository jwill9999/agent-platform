import type { Output } from '@agent-platform/contracts';
import type { UIMessage } from 'ai';

import { expandFencedCodeToOutputs } from './expandFencedCode';

type UiPart = UIMessage['parts'][number];

/**
 * Prefer structured `parts`; if empty, fall back to legacy `content` string so we never iterate `undefined`
 * and user-only-text messages still render (Sourcery / runtime-safety).
 */
function partsForRendering(message: UIMessage): UiPart[] {
  if (message.parts.length > 0) {
    return message.parts;
  }
  const c = message.content;
  if (typeof c === 'string' && c.trim()) {
    return [{ type: 'text', text: c }];
  }
  return [];
}

function reasoningToText(part: {
  reasoning: string;
  details: Array<
    { type: 'text'; text: string; signature?: string } | { type: 'redacted'; data: string }
  >;
}): string {
  if (part.reasoning.trim()) {
    return part.reasoning;
  }
  return part.details
    .filter((d): d is { type: 'text'; text: string } => d.type === 'text')
    .map((d) => d.text)
    .join('\n');
}

/**
 * Map a Vercel AI SDK {@link UIMessage} to contract {@link Output} items for rendering.
 */
export function uiMessageToOutputs(message: UIMessage): Output[] {
  const out: Output[] = [];
  for (const part of partsForRendering(message)) {
    if (part.type === 'text') {
      out.push(...expandFencedCodeToOutputs(part.text));
    } else if (part.type === 'reasoning') {
      out.push({ type: 'thinking', content: reasoningToText(part) });
    } else if (part.type === 'tool-invocation') {
      const inv = part.toolInvocation;
      if (inv.state === 'result') {
        out.push({
          type: 'tool_result',
          toolId: inv.toolName,
          data: inv.result,
        });
      } else {
        out.push({
          type: 'text',
          content: `Calling \`${inv.toolName}\`…`,
        });
      }
    } else if (part.type === 'source') {
      out.push({
        type: 'text',
        content: `[Source: ${part.source.url}]`,
      });
    } else if (part.type === 'file') {
      out.push({
        type: 'text',
        content: `[File attachment: ${part.mimeType}]`,
      });
    }
    // step-start: omit
  }
  return out;
}
