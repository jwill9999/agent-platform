'use client';

import { useMemo, useState } from 'react';

import type { ToolTraceEvent } from '@/hooks/use-harness-chat';
import {
  summarizeBrowserToolResult,
  type BrowserToolArtifactPreview,
} from '@/lib/browser-tool-results';
import { formatFileSize } from '@/lib/workspace-files';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = Readonly<{
  events: readonly ToolTraceEvent[];
}>;

type PreviewArtifact = BrowserToolArtifactPreview & {
  pageTitle?: string;
  pageUrl?: string;
};

function browserImageArtifacts(events: readonly ToolTraceEvent[]): PreviewArtifact[] {
  const seen = new Set<string>();
  const artifacts: PreviewArtifact[] = [];
  for (const event of events) {
    if (event.type !== 'result') continue;
    const summary = summarizeBrowserToolResult(event.data);
    if (!summary) continue;
    for (const artifact of summary.artifacts) {
      if (!artifact.previewHref || seen.has(artifact.id)) continue;
      seen.add(artifact.id);
      artifacts.push({
        ...artifact,
        pageTitle: summary.title,
        pageUrl: summary.url,
      });
    }
  }
  return artifacts;
}

export function BrowserArtifactPreviews({ events }: Props) {
  const artifacts = useMemo(() => browserImageArtifacts(events), [events]);
  const [selected, setSelected] = useState<PreviewArtifact | null>(null);

  if (artifacts.length === 0) return null;

  return (
    <>
      <div className="my-3 grid gap-3">
        {artifacts.map((artifact) => (
          <figure
            key={artifact.id}
            className="overflow-hidden rounded-md border border-border bg-background"
          >
            <button
              type="button"
              onClick={() => setSelected(artifact)}
              className="block w-full cursor-zoom-in bg-muted/30 text-left"
              aria-label={`Open ${artifact.label}`}
            >
              <img
                src={artifact.previewHref}
                alt={artifact.label}
                className="max-h-[420px] w-full object-contain"
              />
            </button>
            <figcaption className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{artifact.label}</span>
              <span>{formatFileSize(artifact.sizeBytes)}</span>
              {artifact.truncated && <span className="text-amber-700">truncated</span>}
              {artifact.pageUrl && <span className="min-w-0 break-all">{artifact.pageUrl}</span>}
            </figcaption>
          </figure>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] max-w-[92vw] border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{selected?.label ?? 'Browser screenshot'}</DialogTitle>
          <DialogDescription className="sr-only">
            Click outside the screenshot or use the close button to return to the chat.
          </DialogDescription>
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="block max-h-[92vh] max-w-[92vw] cursor-zoom-out overflow-hidden rounded-md bg-background"
              aria-label="Close screenshot preview"
            >
              <img
                src={selected.previewHref}
                alt={selected.label}
                className="max-h-[92vh] max-w-[92vw] object-contain"
              />
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
