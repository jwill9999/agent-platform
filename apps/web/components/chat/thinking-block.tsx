'use client';

import { Brain } from 'lucide-react';

interface ThinkingBlockProps {
  /** Accumulated reasoning text streamed by the assistant. */
  content: string;
  /** Open by default while the message is still streaming. */
  defaultOpen?: boolean;
}

/**
 * Collapsible, visually-distinct block for assistant reasoning ("thinking")
 * tokens, so they are not confused with the final answer.
 */
export function ThinkingBlock({ content, defaultOpen = false }: Readonly<ThinkingBlockProps>) {
  if (!content.trim()) return null;
  return (
    <details
      open={defaultOpen}
      className="mb-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground"
    >
      <summary className="flex cursor-pointer select-none items-center gap-1.5 font-medium text-muted-foreground/90">
        <Brain className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Thinking</span>
      </summary>
      <div className="mt-1.5 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground/80">
        {content}
      </div>
    </details>
  );
}
