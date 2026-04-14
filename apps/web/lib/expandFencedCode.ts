import type { Output } from '@agent-platform/contracts';

/**
 * Split assistant/user text into {@link Output} chunks: plain text and fenced `code` blocks.
 */
export function expandFencedCodeToOutputs(text: string): Output[] {
  const out: Output[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = /```([\w-]*)\r?\n([\s\S]*?)```/g;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(lastIndex, m.index);
    if (before.trim()) {
      out.push({ type: 'text', content: before });
    }
    const language = m[1]?.trim() || 'plaintext';
    const raw = m[2] ?? '';
    const content = raw.replace(/\r\n/g, '\n').replace(/\n$/, '');
    out.push({ type: 'code', language, content });
    lastIndex = m.index + m[0].length;
  }
  const rest = text.slice(lastIndex);
  if (rest.trim()) {
    out.push({ type: 'text', content: rest });
  }
  if (out.length === 0 && text.length > 0) {
    out.push({ type: 'text', content: text });
  }
  return out;
}
