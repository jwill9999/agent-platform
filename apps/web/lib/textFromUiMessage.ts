import type { UIMessage } from 'ai';

/** Concatenate text parts from a Vercel AI SDK UI message for display. */
export function textFromUiMessage(m: UIMessage): string {
  if (m.parts?.length) {
    return m.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('');
  }
  return '';
}
